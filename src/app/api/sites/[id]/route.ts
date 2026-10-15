import { body, HttpError, idParam, notFound, route, texte } from '@/lib/api';
import { execute, queryOne } from '@/lib/db';
import { differences } from '@/lib/journal';
import { lireSite } from '@/lib/sites-formulaire';

const CHAMPS = {
  code: 'code',
  nom: 'nom',
  adresse: 'adresse',
  telephone: 'téléphone',
  seuil_batterie: 'seuil batterie',
  message_ticket: 'message ticket',
  actif: 'actif',
};

/**
 * Modifier un site.
 *  - Administrateur : tout (code, nom, coordonnées, activation).
 *  - Gérant du site : nom, coordonnées, seuil batterie et message du ticket.
 */
export const PUT = route(
  async (req, { params, session, site, journal }) => {
    const id = idParam(params);
    const avant = await queryOne('SELECT * FROM sites WHERE id = ?', [id]);
    if (!avant) notFound('Site');
    site.verifier(id);
    const b = await body(req);
    const s = lireSite(b);
    let code = avant.code;
    let actif = avant.actif;
    if (session.role === 'admin') {
      code = texte(b.code, 'Code du site', { requis: true, max: 10 })!.toUpperCase();
      if (!/^[A-Z0-9_-]+$/.test(code)) throw new HttpError(400, 'Code du site : lettres, chiffres, - ou _ uniquement');
      actif = b.actif === false ? 0 : 1;
      if (!actif && avant.actif) {
        const enCours = await queryOne<{ n: number }>(
          "SELECT COUNT(*) AS n FROM recharges WHERE site_id = ? AND statut IN ('en_charge','pret')",
          [id]
        );
        if (enCours?.n)
          throw new HttpError(409, `${enCours.n} téléphone(s) sont encore en charge sur ce site : remettez-les avant de le désactiver`);
      }
    }
    const apres = { ...s, code, actif };
    await execute(
      'UPDATE sites SET code = ?, nom = ?, adresse = ?, telephone = ?, seuil_batterie = ?, message_ticket = ?, actif = ? WHERE id = ?',
      [code, s.nom, s.adresse, s.telephone, s.seuil_batterie, s.message_ticket || avant.message_ticket, actif, id]
    );
    await journal('modification', 'site', id, `${avant.code} · ` + differences(avant, apres, CHAMPS), id);
    return queryOne('SELECT * FROM sites WHERE id = ?', [id]);
  },
  { gerant: true }
);

// Supprimer un site vide (administrateur). Un site qui a de l'historique se désactive.
export const DELETE = route(
  async (_req, { params, journal }) => {
    const id = idParam(params);
    const s = await queryOne('SELECT code, nom FROM sites WHERE id = ?', [id]);
    if (!s) notFound('Site');
    const usage = await queryOne<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM recharges WHERE site_id = ?) + (SELECT COUNT(*) FROM caisses WHERE site_id = ?)
            + (SELECT COUNT(*) FROM depenses WHERE site_id = ?) + (SELECT COUNT(*) FROM releves_energie WHERE site_id = ?) AS n`,
      [id, id, id, id]
    );
    if (usage?.n) throw new HttpError(409, 'Ce site a déjà un historique : désactivez-le plutôt que de le supprimer');
    await execute('DELETE FROM emplacements WHERE site_id = ?', [id]);
    await execute('DELETE FROM sites WHERE id = ?', [id]);
    await journal('suppression', 'site', id, `${s.code} · ${s.nom}`, null);
    return { ok: true };
  },
  { admin: true }
);
