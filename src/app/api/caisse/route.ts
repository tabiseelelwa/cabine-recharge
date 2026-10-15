import type { ResultSetHeader } from 'mysql2/promise';
import { body, HttpError, nombre, route, texte } from '@/lib/api';
import { pool, query, queryOne, transaction } from '@/lib/db';
import { caisseOuverteId, resumeCaisse } from '@/lib/caisse';

const SELECT_CAISSE = `
  SELECT c.id, c.site_id, s.code AS site_code, s.nom AS site_nom,
         c.statut, c.ouverte_le, c.fond_initial, c.fermee_le, c.especes_attendues, c.especes_comptees, c.ecart, c.notes,
         uo.nom AS ouverte_par_nom, uf.nom AS fermee_par_nom
  FROM caisses c
  JOIN sites s ON s.id = c.site_id
  LEFT JOIN utilisateurs uo ON uo.id = c.ouverte_par
  LEFT JOIN utilisateurs uf ON uf.id = c.fermee_par`;

/**
 * État de la caisse.
 *  - Un site choisi : sa caisse ouverte (avec bilan en direct) + l'historique de ses clôtures.
 *  - « Tous les sites » : l'état de la caisse de chaque site + l'historique de tous les sites.
 */
export const GET = route(async (_req, { site }) => {
  const f = site.filtre('c.site_id');
  const historique = await query(`${SELECT_CAISSE} WHERE c.statut = 'fermee' AND ${f.sql} ORDER BY c.fermee_le DESC LIMIT 100`, f.params);

  if (site.actif) {
    const ouverte = await queryOne(`${SELECT_CAISSE} WHERE c.statut = 'ouverte' AND c.site_id = ?`, [site.actif]);
    return {
      actif: site.actif,
      ouverte: ouverte ? { ...ouverte, resume: await resumeCaisse(pool, ouverte.id) } : null,
      historique,
      sites: [],
    };
  }

  const sites = await query<{ id: number; code: string; nom: string }>('SELECT id, code, nom FROM sites WHERE id IN (?) ORDER BY code', [
    site.vue,
  ]);
  const ouvertes = await query(`${SELECT_CAISSE} WHERE c.statut = 'ouverte' AND c.site_id IN (?)`, [site.vue]);
  const parSite = await Promise.all(
    sites.map(async (s) => {
      const c = ouvertes.find((o) => o.site_id === s.id);
      return { ...s, caisse: c ? { ...c, resume: await resumeCaisse(pool, c.id) } : null };
    })
  );
  return { actif: null, ouverte: null, historique, sites: parSite };
});

/**
 *  { action: 'ouvrir', fond_initial }            → ouvre la caisse du site choisi (une seule à la fois par site)
 *  { action: 'fermer', especes_comptees, notes } → compte les espèces, calcule l'écart, ferme
 */
export const POST = route(async (req, { session, site, journal }) => {
  const siteId = site.exiger();
  const b = await body(req);

  if (b.action === 'ouvrir') {
    const fond = nombre(b.fond_initial, 'Fond de caisse', { min: 0 }) ?? 0;
    try {
      const [res] = await pool.query<ResultSetHeader>('INSERT INTO caisses (site_id, ouverte_par, fond_initial) VALUES (?, ?, ?)', [
        siteId,
        session.id,
        fond,
      ]);
      await journal('ouverture', 'caisse', res.insertId, `Fond de caisse : ${fond}`);
      return { id: res.insertId };
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY') throw new HttpError(409, 'La caisse de ce site est déjà ouverte');
      throw e;
    }
  }

  if (b.action === 'fermer') {
    const comptees = nombre(b.especes_comptees, 'Espèces comptées', { requis: true, min: 0 })!;
    const notes = texte(b.notes, 'Notes', { max: 255 });
    const bilan = await transaction(async (conn) => {
      const id = await caisseOuverteId(conn, siteId); // verrouille : aucun paiement ne peut s'y ajouter pendant la clôture
      if (!id) throw new HttpError(409, 'Aucune caisse ouverte sur ce site');
      const resume = await resumeCaisse(conn, id);
      const ecart = Math.round((comptees - resume.especes_attendues) * 100) / 100;
      await conn.query(
        `UPDATE caisses SET statut = 'fermee', fermee_par = ?, fermee_le = NOW(),
         especes_attendues = ?, especes_comptees = ?, ecart = ?, notes = ? WHERE id = ?`,
        [session.id, resume.especes_attendues, comptees, ecart, notes, id]
      );
      return { id, ecart, resume };
    });
    await journal(
      'cloture',
      'caisse',
      bilan.id,
      `Attendu ${bilan.resume.especes_attendues} · compté ${comptees} · écart ${bilan.ecart > 0 ? '+' : ''}${bilan.ecart}` +
        ` · mobile money ${bilan.resume.total_mobile}` +
        (notes ? ` · ${notes}` : '')
    );
    return { id: bilan.id, ecart: bilan.ecart };
  }

  throw new HttpError(400, 'Action inconnue');
});
