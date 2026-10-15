import fs from 'node:fs/promises';
import path from 'node:path';
import { connexionMultiple, pool, query } from './db';
import { migrer } from './migrations.mjs';
import { HttpError } from './api';

export const MARQUEUR = '-- Sauvegarde Cabine Solaire';
const GARDER_AUTO = 30; // nombre de sauvegardes automatiques conservées sur le PC

export const dossierSauvegardes = () => path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'sauvegardes'));

function horodatage(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

/** Produit un fichier SQL complet (structure + données) de toute la base */
export async function genererDump(): Promise<string> {
  const out: string[] = [];
  const [{ db }] = await query<{ db: string }>('SELECT DATABASE() AS db');
  out.push(`${MARQUEUR} (v2)`, `-- Créée le ${new Date().toLocaleString('fr-FR')}`, `-- Base : ${db}`, '');
  out.push('SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS = 0;', '');

  const tables = await query<{ t: string }>(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );

  for (const { t } of tables) {
    const [create] = await query<Record<string, string>>(`SHOW CREATE TABLE \`${t}\``);
    out.push(`-- Table ${t}`, `DROP TABLE IF EXISTS \`${t}\`;`, `${create['Create Table']};`, '');

    // Les colonnes calculées (ex. caisses.ouverte_flag) ne doivent pas être insérées
    const colonnes = (
      await query<{ c: string; extra: string }>(
        'SELECT COLUMN_NAME AS c, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
        [t]
      )
    )
      .filter((x) => !/(STORED|VIRTUAL|PERSISTENT) GENERATED/i.test(x.extra || ''))
      .map((x) => x.c);
    if (!colonnes.length) continue;

    const liste = colonnes.map((c) => `\`${c}\``).join(', ');
    const lignes = await query<Record<string, unknown>>(`SELECT ${liste} FROM \`${t}\``);
    for (let i = 0; i < lignes.length; i += 100) {
      const valeurs = lignes
        .slice(i, i + 100)
        .map((l) => '(' + colonnes.map((c) => pool.escape(l[c])).join(', ') + ')')
        .join(',\n');
      out.push(`INSERT INTO \`${t}\` (${liste}) VALUES\n${valeurs};`);
    }
    out.push('');
  }

  out.push('SET FOREIGN_KEY_CHECKS = 1;', '');
  return out.join('\n');
}

export async function enregistrerSurDisque(contenu: string, prefixe: 'manuelle' | 'auto' | 'avant_restauration') {
  const dossier = dossierSauvegardes();
  await fs.mkdir(dossier, { recursive: true });
  const nom = `${prefixe}_${horodatage()}.sql`;
  await fs.writeFile(path.join(dossier, nom), contenu, 'utf8');
  return nom;
}

export async function listerFichiers() {
  const dossier = dossierSauvegardes();
  let noms: string[] = [];
  try {
    noms = await fs.readdir(dossier);
  } catch {
    return [];
  }
  const fichiers = await Promise.all(
    noms
      .filter((n) => /^[\w.-]+\.sql$/.test(n))
      .map(async (nom) => {
        const s = await fs.stat(path.join(dossier, nom));
        return { nom, taille: s.size, date: s.mtime.toISOString() };
      })
  );
  return fichiers.sort((a, b) => b.date.localeCompare(a.date));
}

/** Chemin sûr d'un fichier de sauvegarde (empêche de sortir du dossier) */
export function cheminFichier(nom: string) {
  if (!/^[\w.-]+\.sql$/.test(nom)) throw new HttpError(400, 'Nom de fichier invalide');
  return path.join(dossierSauvegardes(), nom);
}

async function nettoyerAnciennesAuto() {
  const autos = (await listerFichiers()).filter((f) => f.nom.startsWith('auto_'));
  for (const f of autos.slice(GARDER_AUTO)) await fs.unlink(cheminFichier(f.nom)).catch(() => {});
}

async function marquer(cle: string) {
  await pool.query('INSERT INTO parametres (cle, valeur) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE valeur = NOW()', [cle]);
}
export const marquerTelechargement = () => marquer('derniere_sauvegarde');

/** Sauvegarde automatique : une fois par jour, déclenchée par l'activité de l'application */
const g = globalThis as unknown as { __sauvegardeEnCours?: boolean };
export async function sauvegardeAutoSiNecessaire() {
  if (g.__sauvegardeEnCours) return;
  g.__sauvegardeEnCours = true;
  try {
    const [row] = await query<{ fait: number }>(
      "SELECT DATE(valeur) = CURDATE() AS fait FROM parametres WHERE cle = 'derniere_sauvegarde_auto' AND valeur <> ''"
    );
    if (row?.fait) return;
    await enregistrerSurDisque(await genererDump(), 'auto');
    await marquer('derniere_sauvegarde_auto');
    await nettoyerAnciennesAuto();
  } catch (e) {
    console.error('Sauvegarde automatique impossible :', e);
  } finally {
    g.__sauvegardeEnCours = false;
  }
}

/**
 * Restaure une sauvegarde produite par cette application.
 * Une copie de l'état actuel est enregistrée sur le PC juste avant.
 */
export async function restaurer(sql: string): Promise<{ copieAvant: string; instructions: number }> {
  const contenu = sql.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!contenu.startsWith(MARQUEUR)) {
    throw new HttpError(400, "Ce fichier n'est pas une sauvegarde de la Cabine Solaire");
  }

  const copieAvant = await enregistrerSurDisque(await genererDump(), 'avant_restauration');

  // Dans nos sauvegardes, chaque instruction se termine par « ;\n » et les données ne contiennent
  // jamais de retour à la ligne brut (ils sont échappés en \n) : le découpage est donc sûr.
  const instructions = contenu
    .split(/;\n/)
    .map((s) =>
      s
        .split('\n')
        .filter((l) => !l.startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(Boolean);

  const conn = await connexionMultiple();
  try {
    for (const ins of instructions) await conn.query(ins);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await migrer(conn); // met à niveau une sauvegarde issue d'une ancienne version
  } catch (e) {
    throw new HttpError(
      500,
      `Restauration interrompue : ${(e as Error).message}. L'état précédent a été copié dans « ${copieAvant} » : restaurez ce fichier pour revenir en arrière.`
    );
  } finally {
    await conn.end();
  }
  return { copieAvant, instructions: instructions.length };
}
