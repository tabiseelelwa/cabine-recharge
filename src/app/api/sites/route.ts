import type { ResultSetHeader } from 'mysql2/promise';
import { body, HttpError, nombre, route, texte } from '@/lib/api';
import { lireSite } from '@/lib/sites-formulaire';
import { query, queryOne, transaction } from '@/lib/db';

const COLS = `s.id, s.code, s.nom, s.adresse, s.telephone, s.seuil_batterie, s.message_ticket, s.actif, s.cree_le,
  (SELECT COUNT(*) FROM emplacements e WHERE e.site_id = s.id) AS nb_emplacements,
  (SELECT COUNT(*) FROM utilisateur_sites us WHERE us.site_id = s.id) AS nb_utilisateurs`;

/**
 * Sites visibles par l'utilisateur et site choisi dans le menu.
 * L'administrateur voit aussi les sites désactivés (pour pouvoir les réactiver).
 */
export const GET = route(async (_req, { session, site }) => {
  const sites =
    session.role === 'admin'
      ? await query(`SELECT ${COLS} FROM sites s ORDER BY s.actif DESC, s.code`)
      : await query(`SELECT ${COLS} FROM sites s WHERE s.id IN (?) ORDER BY s.code`, [site.ids.length ? site.ids : [0]]);
  return {
    sites,
    actif: site.actif,
    accessibles: site.ids,
    peut_tous: session.role === 'admin' || site.ids.length > 1,
  };
});

// Nouveau site (administrateur), avec si besoin ses premiers emplacements P01, P02…
export const POST = route(
  async (req, { journal }) => {
    const b = await body(req);
    const code = texte(b.code, 'Code du site', { requis: true, max: 10 })!.toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(code)) throw new HttpError(400, 'Code du site : lettres, chiffres, - ou _ uniquement');
    const s = lireSite(b);
    const nbEmplacements = nombre(b.nb_emplacements, "Nombre d'emplacements", { min: 0, max: 200, entier: true }) ?? 0;

    const id = await transaction(async (conn) => {
      const [res] = await conn.query<ResultSetHeader>(
        'INSERT INTO sites (code, nom, adresse, telephone, seuil_batterie, message_ticket) VALUES (?, ?, ?, ?, ?, ?)',
        [
          code,
          s.nom,
          s.adresse,
          s.telephone,
          s.seuil_batterie,
          s.message_ticket || 'Conservez ce ticket. Le code est exigé pour récupérer votre téléphone.',
        ]
      );
      if (nbEmplacements > 0) {
        const lignes = Array.from({ length: nbEmplacements }, (_, i) => [res.insertId, `P${String(i + 1).padStart(2, '0')}`, 'Universel']);
        await conn.query('INSERT INTO emplacements (site_id, code, type_prise) VALUES ?', [lignes]);
      }
      return res.insertId;
    });
    await journal('creation', 'site', id, `${code} · ${s.nom}${nbEmplacements ? ` · ${nbEmplacements} emplacement(s)` : ''}`, id);
    return queryOne(`SELECT ${COLS} FROM sites s WHERE s.id = ?`, [id]);
  },
  { admin: true }
);
