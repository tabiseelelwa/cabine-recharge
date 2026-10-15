import { body, route, texte } from '@/lib/api';
import { execute, query, queryOne } from '@/lib/db';

// Liste des clients avec statistiques de fidélité. ?q= recherche nom/téléphone
export const GET = route(async (req, { site }) => {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  // Les clients sont communs à tous les sites ; les statistiques ne comptent que les sites visibles
  const params: unknown[] = [site.vue];
  let where = '';
  if (q) {
    where = 'WHERE c.nom LIKE ? OR c.telephone LIKE ?';
    params.push(`%${q}%`, `%${q}%`);
  }
  return query(
    `SELECT c.*,
            COUNT(r.id) AS nb_recharges,
            COALESCE(SUM(CASE WHEN r.statut <> 'annule' THEN r.montant_paye END), 0) AS total_paye,
            COALESCE(SUM(CASE WHEN r.statut <> 'annule' THEN r.montant - r.montant_paye END), 0) AS total_du,
            MAX(r.depose_le) AS derniere_visite
     FROM clients c LEFT JOIN recharges r ON r.client_id = c.id AND r.site_id IN (?)
     ${where}
     GROUP BY c.id
     ORDER BY derniere_visite DESC, c.nom
     LIMIT 500`,
    params
  );
});

export const POST = route(async (req, { journal }) => {
  const b = await body(req);
  const nom = texte(b.nom, 'Nom', { requis: true, max: 100 });
  const telephone = texte(b.telephone, 'Téléphone', { requis: true, max: 30 })!.replace(/\s+/g, '');
  const notes = texte(b.notes, 'Notes', { max: 255 });
  const res = await execute('INSERT INTO clients (nom, telephone, notes) VALUES (?, ?, ?)', [nom, telephone, notes]);
  await journal('creation', 'client', res.insertId, `${nom} · ${telephone}`);
  return queryOne('SELECT * FROM clients WHERE id = ?', [res.insertId]);
});
