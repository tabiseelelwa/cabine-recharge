import bcrypt from 'bcryptjs';
import { body, HttpError, idParam, notFound, route, texte } from '@/lib/api';
import { execute, queryOne, transaction } from '@/lib/db';
import { differences } from '@/lib/journal';
import { COLS_UTILISATEUR, enregistrerSites, lireRole, lireSites, SITES_UTILISATEUR } from '@/lib/utilisateurs';

const charger = (id: number) => queryOne(`SELECT ${COLS_UTILISATEUR}, ${SITES_UTILISATEUR} FROM utilisateurs u WHERE u.id = ?`, [id]);

export const PUT = route(
  async (req, { params, session, journal }) => {
    const id = idParam(params);
    const avant = await charger(id);
    if (!avant) notFound('Utilisateur');
    const b = await body(req);
    const role = lireRole(b.role);
    const actif = b.actif === false ? 0 : 1;
    if (id === session.id && (role !== 'admin' || !actif)) {
      throw new HttpError(400, "Vous ne pouvez pas retirer vos propres droits d'administrateur");
    }
    const sites = lireSites(b.sites, role);
    const nom = texte(b.nom, 'Nom', { requis: true, max: 100 });
    const identifiant = texte(b.identifiant, 'Identifiant', { requis: true, max: 50 })!.toLowerCase();
    const mdp = texte(b.mot_de_passe, 'Mot de passe', { max: 100 });
    if (mdp && mdp.length < 6) throw new HttpError(400, 'Le mot de passe doit contenir au moins 6 caractères');
    const hash = mdp ? await bcrypt.hash(mdp, 10) : null;

    await transaction(async (conn) => {
      await conn.query('UPDATE utilisateurs SET nom = ?, identifiant = ?, role = ?, actif = ? WHERE id = ?', [
        nom,
        identifiant,
        role,
        actif,
        id,
      ]);
      if (hash) await conn.query('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [hash, id]);
      await enregistrerSites(conn, id, role, sites);
    });

    const apres = await charger(id);
    await journal(
      'modification',
      'utilisateur',
      id,
      `${avant.nom} · ` +
        differences(avant, apres, { nom: 'nom', identifiant: 'identifiant', role: 'rôle', actif: 'actif', sites_codes: 'sites' }) +
        (mdp ? ' ; mot de passe réinitialisé' : ''),
      null
    );
    return apres;
  },
  { admin: true }
);

export const DELETE = route(
  async (_req, { params, session, journal }) => {
    const id = idParam(params);
    if (id === session.id) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte');
    const n = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM recharges WHERE operateur_id = ?', [id]);
    if (n && n.n > 0) throw new HttpError(409, 'Cet utilisateur a enregistré des opérations : désactivez-le plutôt');
    const u = await queryOne('SELECT nom, identifiant FROM utilisateurs WHERE id = ?', [id]);
    if (!u) notFound('Utilisateur');
    await execute('DELETE FROM utilisateurs WHERE id = ?', [id]);
    await journal('suppression', 'utilisateur', id, `${u.nom} (${u.identifiant})`, null);
    return { ok: true };
  },
  { admin: true }
);
