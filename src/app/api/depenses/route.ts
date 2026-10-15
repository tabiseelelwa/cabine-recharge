import { body, dateISO, nombre, route, texte } from '@/lib/api';
import { query, queryOne, transaction } from '@/lib/db';
import { caisseOuverteId, libelleMode, lireMode } from '@/lib/caisse';
import type { ResultSetHeader } from 'mysql2/promise';

// ?mois=AAAA-MM pour filtrer. En vue « Tous les sites », l'administrateur voit aussi les dépenses générales.
export const GET = route(async (req, { site }) => {
  const mois = req.nextUrl.searchParams.get('mois');
  const f = site.filtre('d.site_id', true);
  const where = [f.sql];
  const params: unknown[] = [...f.params];
  if (mois && /^\d{4}-\d{2}$/.test(mois)) {
    where.push("DATE_FORMAT(d.date_depense, '%Y-%m') = ?");
    params.push(mois);
  }
  return query(
    `SELECT d.*, u.nom AS operateur_nom, s.code AS site_code, s.nom AS site_nom
     FROM depenses d
     LEFT JOIN utilisateurs u ON u.id = d.operateur_id
     LEFT JOIN sites s ON s.id = d.site_id
     WHERE ${where.join(' AND ')}
     ORDER BY d.date_depense DESC, d.id DESC LIMIT 500`,
    params
  );
});

/**
 * Nouvelle dépense : pour le site choisi dans le menu.
 * En vue « Tous les sites », l'administrateur peut préciser site_id, ou rien pour une dépense générale (siège).
 */
export const POST = route(async (req, { session, site, journal }) => {
  const b = await body(req);
  let siteId: number | null;
  if (site.actif) siteId = site.actif;
  else if (session.role === 'admin') siteId = nombre(b.site_id, 'Site', { entier: true });
  else siteId = site.exiger();
  if (siteId !== null) site.verifier(siteId);

  const date = dateISO(b.date_depense, 'Date', true);
  const categorie = texte(b.categorie, 'Catégorie', { requis: true, max: 50 });
  const description = texte(b.description, 'Description', { requis: true, max: 255 });
  const montant = nombre(b.montant, 'Montant', { requis: true, min: 0 });
  const mode = lireMode(b.mode);

  const { id, caisseId } = await transaction(async (conn) => {
    // Une dépense en espèces « prise dans la caisse » du site diminue les espèces attendues à la clôture
    // (pas en vue « Tous les sites » : l'administrateur paie alors depuis le siège, pas depuis la caisse d'une cabine)
    const caisseId = site.actif && siteId && mode === 'especes' && b.depuis_caisse !== false ? await caisseOuverteId(conn, siteId) : null;
    const [res] = await conn.query<ResultSetHeader>(
      'INSERT INTO depenses (site_id, date_depense, categorie, description, montant, mode, caisse_id, operateur_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [siteId, date, categorie, description, montant, mode, caisseId, session.id]
    );
    return { id: res.insertId, caisseId };
  });

  await journal(
    'creation',
    'depense',
    id,
    `${siteId ? '' : 'Dépense générale · '}${categorie} · ${description} · ${montant} en ${libelleMode(mode)}${caisseId ? ' (pris dans la caisse)' : ''}`,
    siteId
  );
  return queryOne('SELECT * FROM depenses WHERE id = ?', [id]);
});
