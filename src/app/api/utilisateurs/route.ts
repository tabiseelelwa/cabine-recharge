import bcrypt from 'bcryptjs';
import type { ResultSetHeader } from 'mysql2/promise';
import { body, HttpError, route, texte } from '@/lib/api';
import { query, queryOne, transaction } from '@/lib/db';
import { COLS_UTILISATEUR, enregistrerSites, lireRole, lireSites, SITES_UTILISATEUR } from '@/lib/utilisateurs';

/**
 * Utilisateurs.
 *  - Administrateur : tous les comptes.
 *  - Gérant : en lecture, les comptes qui travaillent sur ses sites (pour filtrer le journal).
 */
export const GET = route(
  async (_req, { session, site }) => {
    if (session.role === 'admin') {
      return query(`SELECT ${COLS_UTILISATEUR}, ${SITES_UTILISATEUR} FROM utilisateurs u ORDER BY u.nom`);
    }
    return query(
      `SELECT DISTINCT ${COLS_UTILISATEUR}, ${SITES_UTILISATEUR}
       FROM utilisateurs u JOIN utilisateur_sites x ON x.utilisateur_id = u.id
       WHERE x.site_id IN (?) ORDER BY u.nom`,
      [site.ids.length ? site.ids : [0]]
    );
  },
  { gerant: true }
);

export const POST = route(
  async (req, { journal }) => {
    const b = await body(req);
    const mdp = texte(b.mot_de_passe, 'Mot de passe', { requis: true, max: 100 })!;
    if (mdp.length < 6) throw new HttpError(400, 'Le mot de passe doit contenir au moins 6 caractères');
    const nom = texte(b.nom, 'Nom', { requis: true, max: 100 })!;
    const identifiant = texte(b.identifiant, 'Identifiant', { requis: true, max: 50 })!.toLowerCase();
    const role = lireRole(b.role);
    const sites = lireSites(b.sites, role);
    const hash = await bcrypt.hash(mdp, 10);

    const id = await transaction(async (conn) => {
      const [res] = await conn.query<ResultSetHeader>(
        'INSERT INTO utilisateurs (nom, identifiant, mot_de_passe, role) VALUES (?, ?, ?, ?)',
        [nom, identifiant, hash, role]
      );
      await enregistrerSites(conn, res.insertId, role, sites);
      return res.insertId;
    });
    const u = await queryOne(`SELECT ${COLS_UTILISATEUR}, ${SITES_UTILISATEUR} FROM utilisateurs u WHERE u.id = ?`, [id]);
    await journal(
      'creation',
      'utilisateur',
      id,
      `${u.nom} (${u.identifiant}) · ${u.role}${u.sites_codes ? ` · sites ${u.sites_codes}` : ''}`,
      null
    );
    return u;
  },
  { admin: true }
);
