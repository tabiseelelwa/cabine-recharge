import { body, HttpError, idParam, nombre, notFound, route, texte } from '@/lib/api';
import { execute, queryOne } from '@/lib/db';
import { differences } from '@/lib/journal';

export const PUT = route(
  async (req, { params, journal }) => {
    const id = idParam(params);
    const avant = await queryOne('SELECT * FROM tarifs WHERE id = ?', [id]);
    if (!avant) notFound('Tarif');
    const b = await body(req);
    const apres = {
      libelle: texte(b.libelle, 'Libellé', { requis: true, max: 100 }),
      description: texte(b.description, 'Description', { max: 255 }),
      prix: nombre(b.prix, 'Prix', { requis: true, min: 0 }),
      duree_minutes: nombre(b.duree_minutes, 'Durée', { min: 1, entier: true }),
      actif: b.actif === false ? 0 : 1,
    };
    await execute('UPDATE tarifs SET libelle = ?, description = ?, prix = ?, duree_minutes = ?, actif = ? WHERE id = ?', [
      apres.libelle,
      apres.description,
      apres.prix,
      apres.duree_minutes,
      apres.actif,
      id,
    ]);
    await journal(
      'modification',
      'tarif',
      id,
      `${avant.libelle} · ` +
        differences(avant, apres, { libelle: 'libellé', description: 'description', prix: 'prix', duree_minutes: 'durée', actif: 'actif' }),
      null
    );
    return queryOne('SELECT * FROM tarifs WHERE id = ?', [id]);
  },
  { admin: true }
);

export const DELETE = route(
  async (_req, { params, journal }) => {
    const id = idParam(params);
    const t = await queryOne('SELECT libelle, prix FROM tarifs WHERE id = ?', [id]);
    if (!t) notFound('Tarif');
    const n = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM recharges WHERE tarif_id = ?', [id]);
    if (n && n.n > 0) throw new HttpError(409, 'Ce tarif a déjà été utilisé : désactivez-le plutôt que de le supprimer');
    await execute('DELETE FROM tarifs WHERE id = ?', [id]);
    await journal('suppression', 'tarif', id, `${t.libelle} · ${t.prix}`, null);
    return { ok: true };
  },
  { admin: true }
);
