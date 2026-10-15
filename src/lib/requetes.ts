// Requêtes SQL partagées entre plusieurs routes
export const SELECT_RECHARGE = `
  SELECT r.*, c.nom AS client_nom, c.telephone AS client_telephone,
         e.code AS emplacement_code, t.libelle AS tarif_libelle, u.nom AS operateur_nom,
         s.code AS site_code, s.nom AS site_nom,
         (r.montant - r.montant_paye) AS reste,
         (SELECT GROUP_CONCAT(DISTINCT p.mode) FROM paiements p WHERE p.recharge_id = r.id AND p.montant > 0) AS modes_paiement
  FROM recharges r
  JOIN sites s ON s.id = r.site_id
  JOIN clients c ON c.id = r.client_id
  JOIN tarifs t ON t.id = r.tarif_id
  LEFT JOIN emplacements e ON e.id = r.emplacement_id
  LEFT JOIN utilisateurs u ON u.id = r.operateur_id`;

/**
 * Tarifs vus depuis un site : prix commun, éventuellement remplacé par le prix du site,
 * et actif seulement s'il est actif partout ET sur ce site.
 * Paramètre : l'id du site.
 */
export const SELECT_TARIFS_SITE = `
  SELECT t.id, t.libelle, t.description, t.duree_minutes,
         t.prix AS prix_commun, ts.prix AS prix_site, COALESCE(ts.prix, t.prix) AS prix,
         t.actif AS actif_commun, COALESCE(ts.actif, 1) AS actif_site,
         (t.actif = 1 AND COALESCE(ts.actif, 1) = 1) AS actif
  FROM tarifs t
  LEFT JOIN tarifs_sites ts ON ts.tarif_id = t.id AND ts.site_id = ?`;
