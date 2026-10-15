import { idParam, notFound, route } from '@/lib/api';
import { pool, query, queryOne } from '@/lib/db';
import { resumeCaisse } from '@/lib/caisse';

// Détail d'une session de caisse (pour le rapport de clôture imprimable)
export const GET = route(async (_req, { params, site }) => {
  const id = idParam(params);
  const caisse = await queryOne(
    `SELECT c.id, c.site_id, s.code AS site_code, s.nom AS site_nom, s.adresse AS site_adresse, c.statut, c.ouverte_le, c.fond_initial, c.fermee_le, c.especes_attendues, c.especes_comptees, c.ecart, c.notes,
            uo.nom AS ouverte_par_nom, uf.nom AS fermee_par_nom
     FROM caisses c
     JOIN sites s ON s.id = c.site_id
     LEFT JOIN utilisateurs uo ON uo.id = c.ouverte_par
     LEFT JOIN utilisateurs uf ON uf.id = c.fermee_par
     WHERE c.id = ?`,
    [id]
  );
  if (!caisse) notFound('Caisse');
  site.verifier(caisse.site_id);
  const [resume, paiements, depenses] = await Promise.all([
    resumeCaisse(pool, id),
    query(
      `SELECT p.paye_le, p.montant, p.mode, p.reference, r.ticket, cl.nom AS client_nom, u.nom AS operateur_nom
       FROM paiements p
       LEFT JOIN recharges r ON r.id = p.recharge_id
       LEFT JOIN clients cl ON cl.id = r.client_id
       LEFT JOIN utilisateurs u ON u.id = p.operateur_id
       WHERE p.caisse_id = ? ORDER BY p.paye_le`,
      [id]
    ),
    query(
      `SELECT d.date_depense, d.categorie, d.description, d.montant, d.mode
       FROM depenses d WHERE d.caisse_id = ? ORDER BY d.cree_le`,
      [id]
    ),
  ]);
  return { ...caisse, resume, paiements, depenses };
});
