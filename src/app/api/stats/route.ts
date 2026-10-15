import { route } from '@/lib/api';
import { pool, query, queryOne } from '@/lib/db';
import { resumeCaisse } from '@/lib/caisse';
import { sauvegardeAutoSiNecessaire } from '@/lib/sauvegarde';

/**
 * Données du tableau de bord, pour le site choisi ou pour tous les sites visibles.
 * En vue « Tous les sites », un résumé par site est ajouté (sites[]).
 */
export const GET = route(async (_req, { session, site }) => {
  // Sauvegarde automatique quotidienne, en arrière-plan (ne ralentit pas la réponse)
  void sauvegardeAutoSiNecessaire();

  const V = site.vue;
  const dep = site.filtre('site_id', true);

  const [jour, mois, recharges, emplacements, depJour, depMois, impayes, energie, params, semaine, caisse] = await Promise.all([
    queryOne(
      `SELECT (SELECT COUNT(*) FROM recharges WHERE site_id IN (?) AND DATE(depose_le) = CURDATE() AND statut <> 'annule') AS nb_depots,
              (SELECT COALESCE(SUM(montant), 0) FROM paiements WHERE site_id IN (?) AND DATE(paye_le) = CURDATE()) AS encaisse,
              (SELECT COALESCE(SUM(montant), 0) FROM paiements WHERE site_id IN (?) AND DATE(paye_le) = CURDATE() AND mode <> 'especes') AS mobile`,
      [V, V, V]
    ),
    queryOne(
      `SELECT (SELECT COUNT(*) FROM recharges WHERE site_id IN (?)
               AND DATE_FORMAT(depose_le, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') AND statut <> 'annule') AS nb_depots,
              (SELECT COALESCE(SUM(montant), 0) FROM paiements WHERE site_id IN (?)
               AND DATE_FORMAT(paye_le, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')) AS encaisse`,
      [V, V]
    ),
    queryOne(
      `SELECT SUM(statut = 'en_charge') AS en_charge, SUM(statut = 'pret') AS prets FROM recharges
       WHERE site_id IN (?) AND statut IN ('en_charge','pret')`,
      [V]
    ),
    queryOne(
      `SELECT COUNT(*) AS total, SUM(statut = 'libre') AS libres, SUM(statut = 'occupe') AS occupes,
              SUM(statut = 'hors_service') AS hors_service FROM emplacements WHERE site_id IN (?)`,
      [V]
    ),
    queryOne(`SELECT COALESCE(SUM(montant), 0) AS total FROM depenses WHERE ${dep.sql} AND date_depense = CURDATE()`, dep.params),
    queryOne(
      `SELECT COALESCE(SUM(montant), 0) AS total FROM depenses
       WHERE ${dep.sql} AND DATE_FORMAT(date_depense, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
      dep.params
    ),
    queryOne(
      `SELECT COUNT(*) AS nb, COALESCE(SUM(montant - montant_paye), 0) AS total
       FROM recharges WHERE site_id IN (?) AND statut <> 'annule' AND montant_paye < montant`,
      [V]
    ),
    site.actif
      ? queryOne('SELECT * FROM releves_energie WHERE site_id = ? ORDER BY releve_le DESC LIMIT 1', [site.actif])
      : Promise.resolve(null),
    query<{ cle: string; valeur: string }>("SELECT cle, valeur FROM parametres WHERE cle IN ('caisse_obligatoire','derniere_sauvegarde')"),
    query(
      `SELECT DATE_FORMAT(d.jour, '%Y-%m-%d') AS jour,
              (SELECT COALESCE(SUM(p.montant), 0) FROM paiements p WHERE p.site_id IN (?) AND DATE(p.paye_le) = d.jour) AS encaisse,
              (SELECT COUNT(*) FROM recharges r WHERE r.site_id IN (?) AND DATE(r.depose_le) = d.jour AND r.statut <> 'annule') AS nb
       FROM (SELECT CURDATE() - INTERVAL n DAY AS jour
             FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) k) d
       ORDER BY d.jour`,
      [V, V]
    ),
    site.actif
      ? queryOne<{ id: number; ouverte_le: string; ouverte_par_nom: string | null }>(
          `SELECT c.id, c.ouverte_le, u.nom AS ouverte_par_nom FROM caisses c LEFT JOIN utilisateurs u ON u.id = c.ouverte_par
           WHERE c.site_id = ? AND c.statut = 'ouverte'`,
          [site.actif]
        )
      : Promise.resolve(null),
  ]);

  const seuil = site.actif
    ? await queryOne<{ seuil_batterie: number }>('SELECT seuil_batterie FROM sites WHERE id = ?', [site.actif])
    : null;
  const p = Object.fromEntries(params.map((x) => [x.cle, x.valeur]));
  const n = (v: unknown) => Number(v ?? 0);

  return {
    site_actif: site.actif,
    jour: { nb_depots: n(jour?.nb_depots), encaisse: n(jour?.encaisse), mobile: n(jour?.mobile), depenses: n(depJour?.total) },
    mois: {
      nb_depots: n(mois?.nb_depots),
      encaisse: n(mois?.encaisse),
      depenses: n(depMois?.total),
      benefice: n(mois?.encaisse) - n(depMois?.total),
    },
    en_charge: n(recharges?.en_charge),
    prets: n(recharges?.prets),
    emplacements: {
      total: n(emplacements?.total),
      libres: n(emplacements?.libres),
      occupes: n(emplacements?.occupes),
      hors_service: n(emplacements?.hors_service),
    },
    impayes: { nb: n(impayes?.nb), total: n(impayes?.total) },
    energie,
    seuil_batterie: Number(seuil?.seuil_batterie ?? 25),
    semaine,
    caisse: caisse ? { ...caisse, especes_attendues: (await resumeCaisse(pool, caisse.id)).especes_attendues } : null,
    caisse_obligatoire: (p.caisse_obligatoire ?? '1') !== '0',
    sites: site.actif ? [] : await resumeParSite(V),
    // Rappel de copie hors du PC, utile seulement à l'administrateur
    derniere_sauvegarde: session.role === 'admin' ? p.derniere_sauvegarde || null : undefined,
  };
});

/** Une ligne par site pour la vue « Tous les sites » */
async function resumeParSite(V: number[]) {
  const [sites, enc, rech, empl, energie, caisses] = await Promise.all([
    query<{ id: number; code: string; nom: string; seuil_batterie: number }>(
      'SELECT id, code, nom, seuil_batterie FROM sites WHERE id IN (?) ORDER BY code',
      [V]
    ),
    query(
      `SELECT site_id, COALESCE(SUM(montant), 0) AS encaisse FROM paiements
       WHERE site_id IN (?) AND DATE(paye_le) = CURDATE() GROUP BY site_id`,
      [V]
    ),
    query(
      `SELECT site_id, SUM(statut = 'en_charge') AS en_charge, SUM(statut = 'pret') AS prets,
              SUM(DATE(depose_le) = CURDATE() AND statut <> 'annule') AS depots_jour
       FROM recharges WHERE site_id IN (?) AND (statut IN ('en_charge','pret') OR DATE(depose_le) = CURDATE()) GROUP BY site_id`,
      [V]
    ),
    query(
      `SELECT site_id, COUNT(*) AS total, SUM(statut = 'libre') AS libres, SUM(statut = 'hors_service') AS hors_service
       FROM emplacements WHERE site_id IN (?) GROUP BY site_id`,
      [V]
    ),
    // Dernier relevé de batterie de chaque site
    query(
      `SELECT r.site_id, r.niveau_batterie, r.releve_le FROM releves_energie r
       JOIN (SELECT site_id, MAX(releve_le) AS m FROM releves_energie WHERE site_id IN (?) GROUP BY site_id) x
         ON x.site_id = r.site_id AND x.m = r.releve_le`,
      [V]
    ),
    query(`SELECT site_id, id FROM caisses WHERE site_id IN (?) AND statut = 'ouverte'`, [V]),
  ]);
  const de = <T extends { site_id: number }>(liste: T[], id: number) => liste.find((x) => x.site_id === id);
  return sites.map((s) => {
    const r = de(rech as any[], s.id);
    const e = de(empl as any[], s.id);
    const b = de(energie as any[], s.id);
    return {
      id: s.id,
      code: s.code,
      nom: s.nom,
      encaisse_jour: Number(de(enc as any[], s.id)?.encaisse ?? 0),
      depots_jour: Number(r?.depots_jour ?? 0),
      en_charge: Number(r?.en_charge ?? 0),
      prets: Number(r?.prets ?? 0),
      emplacements_libres: Number(e?.libres ?? 0),
      emplacements_total: Number(e?.total ?? 0),
      hors_service: Number(e?.hors_service ?? 0),
      batterie: b ? Number(b.niveau_batterie) : null,
      batterie_le: b?.releve_le ?? null,
      seuil_batterie: Number(s.seuil_batterie),
      caisse_ouverte: !!de(caisses as any[], s.id),
    };
  });
}
