import { pool } from './db';
import type { Session } from './session';

export type Journaliser = (
  action: string,
  entite: string,
  entiteId?: number | null,
  details?: string | null,
  siteId?: number | null
) => Promise<void>;

/**
 * Écrit une ligne dans le journal d'activité.
 * Une erreur d'écriture ne doit jamais faire échouer l'opération elle-même.
 */
export async function ecrireJournal(
  utilisateur: Pick<Session, 'id' | 'nom'> | null,
  action: string,
  entite: string,
  entiteId: number | null = null,
  details: string | null = null,
  ip: string | null = null,
  siteId: number | null = null
) {
  try {
    await pool.query(
      'INSERT INTO journal (site_id, utilisateur_id, utilisateur_nom, action, entite, entite_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        siteId,
        utilisateur?.id ?? null,
        utilisateur?.nom ?? null,
        action,
        entite,
        entiteId,
        details?.slice(0, 500) ?? null,
        ip?.slice(0, 45) ?? null,
      ]
    );
  } catch (e) {
    console.error('Journal : écriture impossible', e);
  }
}

export function ipDe(headers: Headers): string | null {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || null;
}

/** Décrit les changements entre deux versions d'un objet : « prix : 500 → 600 ; libellé : … » */
export function differences(avant: Record<string, any>, apres: Record<string, any>, champs: Record<string, string>): string {
  const d: string[] = [];
  for (const [cle, libelle] of Object.entries(champs)) {
    const a = avant[cle] ?? '';
    const b = apres[cle] ?? '';
    if (String(a) !== String(b)) d.push(`${libelle} : ${a === '' ? '∅' : a} → ${b === '' ? '∅' : b}`);
  }
  return d.join(' ; ') || 'aucun changement';
}
