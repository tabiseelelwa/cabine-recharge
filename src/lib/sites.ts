// Contexte multi-sites : qui est connecté, sur quels sites il peut travailler, et quel site est choisi.
import type { NextRequest } from 'next/server';
import { query, queryOne } from './db';
import { HttpError } from './erreurs';
import type { Role, Session } from './session';

/** Cookie qui mémorise le site choisi dans le menu : un numéro de site, ou « tous » */
export const SITE_COOKIE = 'cabine_site';

export type ContexteSite = {
  /** Sites (actifs) sur lesquels l'utilisateur a le droit de travailler */
  ids: number[];
  /** Site choisi ; null = vue « Tous les sites » */
  actif: number | null;
  /** Sites couverts par la vue actuelle (jamais vide, pour pouvoir écrire « IN (?) ») */
  vue: number[];
  /** En vue « Tous les sites », l'administrateur voit aussi les dépenses générales (sans site) */
  inclureGeneral: boolean;
  /** Le site choisi, ou une erreur claire si l'utilisateur est en vue « Tous les sites » */
  exiger(): number;
  /** Vérifie qu'une donnée appartient à un site accessible */
  verifier(siteId: number | null | undefined): void;
  /** Filtre SQL sur la colonne site d'une table, ex. filtre('r.site_id') */
  filtre(colonne: string, avecGeneral?: boolean): { sql: string; params: unknown[] };
};

export async function chargerContexte(req: NextRequest, jeton: Session): Promise<{ session: Session; site: ContexteSite }> {
  // Rôle et état relus en base : un compte désactivé ou modifié est pris en compte immédiatement
  const u = await queryOne<{ id: number; nom: string; identifiant: string; role: Role; actif: number }>(
    'SELECT id, nom, identifiant, role, actif FROM utilisateurs WHERE id = ?',
    [jeton.id]
  );
  if (!u || !u.actif) throw new HttpError(401, 'Compte désactivé ou supprimé, reconnectez-vous');
  const session: Session = { id: u.id, nom: u.nom, identifiant: u.identifiant, role: u.role };

  const lignes =
    u.role === 'admin'
      ? await query<{ id: number }>('SELECT id FROM sites WHERE actif = 1 ORDER BY code')
      : await query<{ id: number }>(
          `SELECT s.id FROM sites s JOIN utilisateur_sites us ON us.site_id = s.id
           WHERE us.utilisateur_id = ? AND s.actif = 1 ORDER BY s.code`,
          [u.id]
        );
  const ids = lignes.map((l) => l.id);
  if (!ids.length && u.role !== 'admin') {
    throw new HttpError(403, "Aucun site ne vous est attribué. Demandez à l'administrateur de vous rattacher à un site.");
  }

  const choix = req.cookies.get(SITE_COOKIE)?.value;
  let actif: number | null;
  if (choix === 'tous' && (u.role === 'admin' || ids.length > 1)) actif = null;
  else if (choix && ids.includes(Number(choix))) actif = Number(choix);
  else actif = u.role === 'admin' && ids.length !== 1 ? null : (ids[0] ?? null);

  const vue = actif ? [actif] : ids.length ? ids : [0];
  const inclureGeneral = actif === null && u.role === 'admin';

  const site: ContexteSite = {
    ids,
    actif,
    vue,
    inclureGeneral,
    exiger() {
      if (!actif) throw new HttpError(400, 'Choisissez un site dans le menu (en haut à gauche) pour faire cette opération.');
      return actif;
    },
    verifier(siteId) {
      if (u.role === 'admin') return;
      if (siteId == null || !ids.includes(siteId))
        throw new HttpError(403, "Cet élément appartient à un site auquel vous n'avez pas accès");
    },
    filtre(colonne, avecGeneral = false) {
      if (avecGeneral && inclureGeneral) return { sql: `(${colonne} IN (?) OR ${colonne} IS NULL)`, params: [vue] };
      return { sql: `${colonne} IN (?)`, params: [vue] };
    },
  };
  return { session, site };
}
