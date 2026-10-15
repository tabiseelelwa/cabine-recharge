import type { PoolConnection } from 'mysql2/promise';
import { HttpError } from './erreurs';
import type { Role } from './session';

export const COLS_UTILISATEUR = 'u.id, u.nom, u.identifiant, u.role, u.actif, u.cree_le';

/** Liste des sites de chaque utilisateur (ids et codes), à ajouter aux lignes « utilisateurs » */
export const SITES_UTILISATEUR = `
  (SELECT GROUP_CONCAT(us.site_id ORDER BY s.code) FROM utilisateur_sites us JOIN sites s ON s.id = us.site_id WHERE us.utilisateur_id = u.id) AS sites_ids,
  (SELECT GROUP_CONCAT(s.code ORDER BY s.code SEPARATOR ', ') FROM utilisateur_sites us JOIN sites s ON s.id = us.site_id WHERE us.utilisateur_id = u.id) AS sites_codes`;

export function lireRole(v: unknown): Role {
  return v === 'admin' || v === 'gerant' ? v : 'operateur';
}

/** Liste d'identifiants de sites envoyée par le formulaire */
export function lireSites(v: unknown, role: Role): number[] {
  const ids = Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  if (role !== 'admin' && !ids.length) throw new HttpError(400, 'Choisissez au moins un site pour ce gérant / opérateur');
  return [...new Set(ids)];
}

/** Remplace les sites d'un utilisateur (un administrateur n'en a pas besoin : il voit tout) */
export async function enregistrerSites(conn: Pick<PoolConnection, 'query'>, utilisateurId: number, role: Role, sites: number[]) {
  await conn.query('DELETE FROM utilisateur_sites WHERE utilisateur_id = ?', [utilisateurId]);
  if (role !== 'admin' && sites.length) {
    await conn.query('INSERT INTO utilisateur_sites (utilisateur_id, site_id) VALUES ?', [sites.map((s) => [utilisateurId, s])]);
  }
}
