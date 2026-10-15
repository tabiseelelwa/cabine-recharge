import { body, route, texte } from '@/lib/api';
import { execute, query, queryOne } from '@/lib/db';

// Emplacements des sites visibles, avec la recharge en cours (s'il y en a une)
export const GET = route(async (_req, { site }) => {
  const f = site.filtre('e.site_id');
  return query(
    `SELECT e.*, s.code AS site_code, s.nom AS site_nom,
            r.id AS recharge_id, r.ticket, r.appareil, r.statut AS recharge_statut, r.depose_le, c.nom AS client_nom
     FROM emplacements e
     JOIN sites s ON s.id = e.site_id
     LEFT JOIN recharges r ON r.emplacement_id = e.id AND r.statut IN ('en_charge','pret')
     LEFT JOIN clients c ON c.id = r.client_id
     WHERE ${f.sql}
     ORDER BY s.code, e.code`,
    f.params
  );
});

// Nouvel emplacement sur le site choisi (administrateur ou gérant)
export const POST = route(
  async (req, { site, journal }) => {
    const siteId = site.exiger();
    const b = await body(req);
    const code = texte(b.code, 'Code', { requis: true, max: 20 })!.toUpperCase();
    const type = texte(b.type_prise, 'Type de prise', { max: 50 }) ?? 'Universel';
    const notes = texte(b.notes, 'Notes', { max: 255 });
    const res = await execute('INSERT INTO emplacements (site_id, code, type_prise, notes) VALUES (?, ?, ?, ?)', [
      siteId,
      code,
      type,
      notes,
    ]);
    await journal('creation', 'emplacement', res.insertId, `${code} · ${type}`);
    return queryOne('SELECT * FROM emplacements WHERE id = ?', [res.insertId]);
  },
  { gerant: true }
);
