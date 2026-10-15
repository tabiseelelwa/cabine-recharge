// Mise à jour automatique de la base de données.
// Utilisé par "npm run db:init", au démarrage du serveur (src/instrumentation.ts) et après une restauration.
// Peut être rejoué sans risque : chaque étape vérifie d'abord si elle est nécessaire.
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {import('mysql2/promise').Connection} conn connexion avec multipleStatements: true, base déjà sélectionnée
 * @param {(msg: string) => void} [log]
 */
export async function migrer(conn, log = () => {}) {
  const schema = fs.readFileSync(path.resolve(process.cwd(), 'database/schema.sql'), 'utf8');
  await conn.query(schema);

  const [[{ db }]] = await conn.query('SELECT DATABASE() AS db');

  const colonne = async (table, col) => {
    const [r] = await conn.query(
      'SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [db, table, col]
    );
    return r[0] ?? null;
  };
  const index = async (table, nom) => {
    const [r] = await conn.query('SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?', [
      db,
      table,
      nom,
    ]);
    return r.length > 0;
  };
  const contrainte = async (table, nom) => {
    const [r] = await conn.query(
      'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
      [db, table, nom]
    );
    return r.length > 0;
  };
  const param = async (cle, defaut = '') => {
    const [r] = await conn.query('SELECT valeur FROM parametres WHERE cle = ?', [cle]);
    return r[0]?.valeur || defaut;
  };

  /* ---------- v2 : mode de paiement et caisse sur les dépenses ---------- */
  if (!(await colonne('depenses', 'mode'))) {
    await conn.query(
      "ALTER TABLE depenses ADD COLUMN mode ENUM('especes','mpesa','airtel','orange','autre') NOT NULL DEFAULT 'especes' AFTER montant"
    );
    log('Colonne depenses.mode ajoutée');
  }
  if (!(await colonne('depenses', 'caisse_id'))) {
    await conn.query('ALTER TABLE depenses ADD COLUMN caisse_id INT NULL AFTER mode');
    await conn.query('ALTER TABLE depenses ADD CONSTRAINT fk_depenses_caisse FOREIGN KEY (caisse_id) REFERENCES caisses(id) ON DELETE SET NULL');
    log('Colonne depenses.caisse_id ajoutée');
  }

  /* ---------- v4 : multi-sites ---------- */
  // 1. Un premier site, qui reprend les réglages de l'ancienne cabine unique
  let siteCree = false;
  const [[{ n: nbSites }]] = await conn.query('SELECT COUNT(*) AS n FROM sites');
  if (nbSites === 0) {
    // Base issue d'une version précédente : la clé « adresse » existait dans les paramètres
    const [[{ n: ancienne }]] = await conn.query("SELECT COUNT(*) AS n FROM parametres WHERE cle = 'adresse'");
    await conn.query('INSERT INTO sites (code, nom, adresse, telephone, seuil_batterie, message_ticket) VALUES (?, ?, ?, ?, ?, ?)', [
      'S01',
      ancienne ? await param('nom_cabine', 'Site principal') : 'Site principal',
      await param('adresse'),
      await param('telephone'),
      Number(await param('seuil_batterie', '25')) || 25,
      await param('message_ticket', 'Conservez ce ticket. Le code est exigé pour récupérer votre téléphone.'),
    ]);
    siteCree = true;
    log('Site « S01 » créé (reprend les réglages de la cabine)');
  }
  const [[{ id: sitePrincipal }]] = await conn.query('SELECT MIN(id) AS id FROM sites');

  // 2. Rôle « gérant »
  const role = await colonne('utilisateurs', 'role');
  if (role && !String(role.type).includes('gerant')) {
    await conn.query("ALTER TABLE utilisateurs MODIFY role ENUM('admin','gerant','operateur') NOT NULL DEFAULT 'operateur'");
    log('Rôle « gérant » ajouté');
  }

  // 3. Colonne site_id sur les tables existantes ; les anciennes données vont au premier site
  const tables = [
    { table: 'emplacements', requis: true },
    { table: 'caisses', requis: true },
    { table: 'recharges', requis: true },
    { table: 'paiements', requis: true },
    { table: 'releves_energie', requis: true },
    { table: 'depenses', requis: false },
    { table: 'journal', requis: false, sansCle: true },
  ];
  for (const t of tables) {
    if (await colonne(t.table, 'site_id')) continue;
    await conn.query(`ALTER TABLE \`${t.table}\` ADD COLUMN site_id INT NULL AFTER id`);
    await conn.query(`UPDATE \`${t.table}\` SET site_id = ?`, [sitePrincipal]);
    if (t.requis) await conn.query(`ALTER TABLE \`${t.table}\` MODIFY site_id INT NOT NULL`);
    if (!t.sansCle) {
      await conn.query(`ALTER TABLE \`${t.table}\` ADD CONSTRAINT fk_${t.table}_site FOREIGN KEY (site_id) REFERENCES sites(id)`);
    } else {
      await conn.query(`ALTER TABLE \`${t.table}\` ADD INDEX idx_${t.table}_site (site_id)`);
    }
    log(`Colonne ${t.table}.site_id ajoutée`);
  }

  // 4. Codes d'emplacement uniques par site (P01 peut exister sur chaque site)
  if (!(await index('emplacements', 'uq_emplacements_site_code'))) {
    await conn.query('ALTER TABLE emplacements ADD UNIQUE KEY uq_emplacements_site_code (site_id, code)');
    if (await index('emplacements', 'code')) await conn.query('ALTER TABLE emplacements DROP INDEX code');
    log('Codes d’emplacement : uniques par site');
  }

  // 5. Une caisse ouverte par site (au lieu d'une seule au total)
  if (!(await index('caisses', 'uq_caisse_ouverte_site'))) {
    await conn.query('ALTER TABLE caisses ADD UNIQUE KEY uq_caisse_ouverte_site (site_id, ouverte_flag)');
    if (await index('caisses', 'uq_caisse_ouverte')) await conn.query('ALTER TABLE caisses DROP INDEX uq_caisse_ouverte');
    log('Caisse : une caisse ouverte par site');
  }

  // 6. Index utiles aux rapports par site
  if (!(await index('recharges', 'idx_recharges_site'))) await conn.query('ALTER TABLE recharges ADD INDEX idx_recharges_site (site_id, depose_le)');
  if (!(await index('paiements', 'idx_paiements_site'))) await conn.query('ALTER TABLE paiements ADD INDEX idx_paiements_site (site_id, paye_le)');
  if (!(await contrainte('depenses', 'fk_depenses_site')) && (await colonne('depenses', 'site_id'))) {
    await conn.query('ALTER TABLE depenses ADD CONSTRAINT fk_depenses_site FOREIGN KEY (site_id) REFERENCES sites(id)');
  }

  // 7. Les gérants et opérateurs existants travaillent sur le premier site
  if (siteCree) {
    const [res] = await conn.query(
      "INSERT IGNORE INTO utilisateur_sites (utilisateur_id, site_id) SELECT id, ? FROM utilisateurs WHERE role <> 'admin'",
      [sitePrincipal]
    );
    if (res.affectedRows) log(`${res.affectedRows} utilisateur(s) rattaché(s) au site S01`);
  }

  /* ---------- v2 : reprise des paiements enregistrés avant la table « paiements » ---------- */
  const [[{ n: nbPaiements }]] = await conn.query('SELECT COUNT(*) AS n FROM paiements');
  if (nbPaiements === 0) {
    const [res] = await conn.query(
      `INSERT INTO paiements (site_id, recharge_id, montant, mode, operateur_id, paye_le)
       SELECT site_id, id, montant_paye, 'especes', operateur_id, depose_le
       FROM recharges WHERE montant_paye > 0 AND statut <> 'annule'`
    );
    if (res.affectedRows) log(`${res.affectedRows} ancien(s) paiement(s) repris en « espèces »`);
  }
}
