// Initialise ou met à jour la base : crée la base, les tables, les données de départ et le compte admin.
// Usage : npm run db:init   (peut être relancé sans risque après une mise à jour de l'application)
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { migrer } from '../src/lib/migrations.mjs';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

async function main() {
  loadEnv();
  const dbName = process.env.DB_NAME || 'cabine_recharge';
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME invalide');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${dbName}\``);

  await migrer(conn, (m) => console.log('✔ ' + m));
  console.log('✔ Tables à jour');

  const [[{ n: nbTarifs }]] = await conn.query('SELECT COUNT(*) AS n FROM tarifs');
  if (nbTarifs === 0) {
    await conn.query(
      `INSERT INTO tarifs (libelle, description, prix, duree_minutes) VALUES
       ('Recharge complète', 'Jusqu''à 100 %', 500, NULL),
       ('Recharge 1 heure', 'Une heure de charge', 300, 60),
       ('Recharge express 30 min', 'Une demi-heure', 200, 30),
       ('Batterie externe (power bank)', 'Recharge d''une batterie externe', 1000, NULL)`
    );
    console.log('✔ Tarifs de départ ajoutés (modifiables dans l\'application)');
  }

  const [[{ n: nbEmpl }]] = await conn.query('SELECT COUNT(*) AS n FROM emplacements');
  if (nbEmpl === 0) {
    const types = ['USB-C', 'USB-C', 'USB-C', 'USB-C', 'Micro-USB', 'Micro-USB', 'Micro-USB', 'Lightning (iPhone)', 'Universel', 'Universel'];
    const [[{ id: siteId }]] = await conn.query('SELECT MIN(id) AS id FROM sites');
    const values = types.map((t, i) => [siteId, `P${String(i + 1).padStart(2, '0')}`, t]);
    await conn.query('INSERT INTO emplacements (site_id, code, type_prise) VALUES ?', [values]);
    console.log('✔ 10 emplacements de départ ajoutés au premier site');
  }

  const [[{ n: nbAdmins }]] = await conn.query("SELECT COUNT(*) AS n FROM utilisateurs WHERE role = 'admin'");
  if (nbAdmins === 0) {
    const identifiant = process.env.ADMIN_IDENTIFIANT || 'admin';
    const mdp = process.env.ADMIN_MOT_DE_PASSE || 'admin123';
    const hash = await bcrypt.hash(mdp, 10);
    await conn.query(
      "INSERT INTO utilisateurs (nom, identifiant, mot_de_passe, role) VALUES ('Administrateur', ?, ?, 'admin')",
      [identifiant, hash]
    );
    console.log(`✔ Compte admin créé → identifiant : ${identifiant} / mot de passe : ${mdp}`);
    console.log('  Changez ce mot de passe après la première connexion (menu Paramètres).');
  }

  await conn.end();
  console.log('Base prête.');
}

main().catch((e) => {
  console.error('Erreur :', e.message);
  process.exit(1);
});
