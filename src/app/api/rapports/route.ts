import { dateISO, HttpError, route } from '@/lib/api';
import { query, queryOne } from '@/lib/db';

// Rapport sur une période : ?du=AAAA-MM-JJ&au=AAAA-MM-JJ
// « Encaissé » = argent réellement reçu pendant la période (paiements moins remboursements), tous modes confondus.
export const GET = route(async (req, { site }) => {
  const sp = req.nextUrl.searchParams;
  const du = dateISO(sp.get('du'), 'du', true)!;
  const au = dateISO(sp.get('au'), 'au', true)!;
  if (du > au) throw new HttpError(400, 'La date de début doit précéder la date de fin');

  // Sites couverts par le rapport : le site choisi, ou tous les sites visibles
  const V = site.vue;
  const periode = "r.site_id IN (?) AND DATE(r.depose_le) BETWEEN ? AND ? AND r.statut <> 'annule'";
  const p = [V, du, au];
  // Dépenses : en vue « Tous les sites », l'administrateur compte aussi les dépenses générales
  const fd = site.filtre('d.site_id', true);
  const pd = [...fd.params, du, au];

  const [
    totaux,
    encaisse,
    depenses,
    recParJour,
    payParJour,
    depParJour,
    parMode,
    parTarif,
    parOperateur,
    parCategorie,
    annulees,
    caisses,
    parSite,
  ] = await Promise.all([
    queryOne(
      `SELECT COUNT(*) AS nb_recharges, COALESCE(SUM(r.montant), 0) AS facture,
                COALESCE(SUM(r.montant - r.montant_paye), 0) AS impaye, COUNT(DISTINCT r.client_id) AS nb_clients
         FROM recharges r WHERE ${periode}`,
      p
    ),
    queryOne('SELECT COALESCE(SUM(montant), 0) AS total FROM paiements WHERE site_id IN (?) AND DATE(paye_le) BETWEEN ? AND ?', p),
    queryOne(`SELECT COALESCE(SUM(montant), 0) AS total FROM depenses d WHERE ${fd.sql} AND d.date_depense BETWEEN ? AND ?`, pd),
    query(
      `SELECT DATE_FORMAT(r.depose_le, '%Y-%m-%d') AS jour, COUNT(*) AS nb
         FROM recharges r WHERE ${periode} GROUP BY jour`,
      p
    ),
    query(
      `SELECT DATE_FORMAT(paye_le, '%Y-%m-%d') AS jour, SUM(montant) AS total,
                SUM(CASE WHEN mode <> 'especes' THEN montant ELSE 0 END) AS mobile
         FROM paiements WHERE site_id IN (?) AND DATE(paye_le) BETWEEN ? AND ? GROUP BY jour`,
      p
    ),
    query(
      `SELECT DATE_FORMAT(d.date_depense, '%Y-%m-%d') AS jour, SUM(d.montant) AS total
         FROM depenses d WHERE ${fd.sql} AND d.date_depense BETWEEN ? AND ? GROUP BY jour`,
      pd
    ),
    query(
      `SELECT mode, COUNT(*) AS nb,
                COALESCE(SUM(CASE WHEN montant > 0 THEN montant END), 0) AS recu,
                COALESCE(SUM(CASE WHEN montant < 0 THEN -montant END), 0) AS rembourse,
                SUM(montant) AS net
         FROM paiements WHERE site_id IN (?) AND DATE(paye_le) BETWEEN ? AND ? GROUP BY mode ORDER BY net DESC`,
      p
    ),
    query(
      `SELECT t.libelle, COUNT(*) AS nb, SUM(r.montant_paye) AS encaisse
         FROM recharges r JOIN tarifs t ON t.id = r.tarif_id WHERE ${periode}
         GROUP BY t.id ORDER BY encaisse DESC`,
      p
    ),
    query(
      `SELECT COALESCE(u.nom, '—') AS nom, COUNT(*) AS nb, SUM(p.montant) AS encaisse
         FROM paiements p LEFT JOIN utilisateurs u ON u.id = p.operateur_id
         WHERE p.site_id IN (?) AND DATE(p.paye_le) BETWEEN ? AND ?
         GROUP BY u.id ORDER BY encaisse DESC`,
      p
    ),
    query(
      `SELECT d.categorie, SUM(d.montant) AS total FROM depenses d WHERE ${fd.sql} AND d.date_depense BETWEEN ? AND ?
         GROUP BY d.categorie ORDER BY total DESC`,
      pd
    ),
    queryOne(
      "SELECT COUNT(*) AS nb FROM recharges r WHERE r.site_id IN (?) AND DATE(r.depose_le) BETWEEN ? AND ? AND r.statut = 'annule'",
      p
    ),
    query(
      `SELECT c.id, s.code AS site_code, s.nom AS site_nom, c.ouverte_le, c.fermee_le, c.especes_attendues, c.especes_comptees, c.ecart,
                c.notes, u.nom AS fermee_par_nom
         FROM caisses c JOIN sites s ON s.id = c.site_id LEFT JOIN utilisateurs u ON u.id = c.fermee_par
         WHERE c.site_id IN (?) AND c.statut = 'fermee' AND DATE(c.fermee_le) BETWEEN ? AND ? ORDER BY c.fermee_le`,
      p
    ),
    // Comparaison des sites : recharges, encaissé, dépenses du site, bénéfice
    query(
      `SELECT s.id, s.code, s.nom,
                (SELECT COUNT(*) FROM recharges r WHERE r.site_id = s.id AND DATE(r.depose_le) BETWEEN ? AND ? AND r.statut <> 'annule') AS nb,
                (SELECT COALESCE(SUM(p.montant), 0) FROM paiements p WHERE p.site_id = s.id AND DATE(p.paye_le) BETWEEN ? AND ?) AS encaisse,
                (SELECT COALESCE(SUM(d.montant), 0) FROM depenses d WHERE d.site_id = s.id AND d.date_depense BETWEEN ? AND ?) AS depenses
         FROM sites s WHERE s.id IN (?) ORDER BY s.code`,
      [du, au, du, au, du, au, V]
    ),
  ]);

  // Fusionne recharges, encaissements et dépenses par jour
  type Jour = { jour: string; nb: number; encaisse: number; mobile: number; depenses: number };
  const jours = new Map<string, Jour>();
  const get = (j: string) => jours.get(j) ?? (jours.set(j, { jour: j, nb: 0, encaisse: 0, mobile: 0, depenses: 0 }), jours.get(j)!);
  for (const r of recParJour as { jour: string; nb: number }[]) get(r.jour).nb = Number(r.nb);
  for (const r of payParJour as { jour: string; total: number; mobile: number }[]) {
    get(r.jour).encaisse = Number(r.total);
    get(r.jour).mobile = Number(r.mobile);
  }
  for (const r of depParJour as { jour: string; total: number }[]) get(r.jour).depenses = Number(r.total);

  const enc = Number(encaisse?.total ?? 0);
  const dep = Number(depenses?.total ?? 0);
  const ecarts = (caisses as { ecart: number }[]).reduce((a, c) => a + Number(c.ecart ?? 0), 0);
  return {
    du,
    au,
    totaux: {
      nb_recharges: Number(totaux?.nb_recharges ?? 0),
      nb_clients: Number(totaux?.nb_clients ?? 0),
      facture: Number(totaux?.facture ?? 0),
      encaisse: enc,
      depenses: dep,
      benefice: enc - dep,
      impaye: Number(totaux?.impaye ?? 0),
      annulees: Number(annulees?.nb ?? 0),
      ecarts_caisse: ecarts,
    },
    par_jour: [...jours.values()].sort((a, b) => a.jour.localeCompare(b.jour)),
    par_mode: parMode,
    par_tarif: parTarif,
    par_operateur: parOperateur,
    par_categorie: parCategorie,
    caisses,
    par_site: (parSite as { id: number; code: string; nom: string; nb: number; encaisse: number; depenses: number }[]).map((x) => ({
      ...x,
      nb: Number(x.nb),
      encaisse: Number(x.encaisse),
      depenses: Number(x.depenses),
      benefice: Number(x.encaisse) - Number(x.depenses),
    })),
    // Dépenses générales (siège) : comptées dans le total mais dans aucun site
    depenses_generales: site.inclureGeneral ? dep - (parSite as { depenses: number }[]).reduce((a, x) => a + Number(x.depenses), 0) : 0,
  };
});
