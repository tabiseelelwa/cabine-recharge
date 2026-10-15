import { body, HttpError, idParam, notFound, route, texte } from '@/lib/api';
import { execute, queryOne } from '@/lib/db';
import { differences } from '@/lib/journal';

async function enCours(id: number) {
  const r = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM recharges WHERE emplacement_id = ? AND statut IN ('en_charge','pret')",
    [id]
  );
  return (r?.n ?? 0) > 0;
}

// Modifier code / type / notes, ou passer en hors service / remettre en service
export const PUT = route(async (req, { params, session, site, journal }) => {
  const id = idParam(params);
  const b = await body(req);
  const avant = await queryOne('SELECT * FROM emplacements WHERE id = ?', [id]);
  if (!avant) notFound('Emplacement');
  site.verifier(avant.site_id);

  let statut = avant.statut;
  if ((b.statut === 'hors_service' || b.statut === 'libre') && b.statut !== avant.statut) {
    if (await enCours(id)) throw new HttpError(409, 'Un téléphone est en charge sur cet emplacement');
    statut = b.statut;
  }

  if (session.role === 'operateur') {
    // L'opérateur peut seulement signaler une panne / remise en service
    await execute('UPDATE emplacements SET statut = ? WHERE id = ?', [statut, id]);
    if (statut !== avant.statut)
      await journal(statut === 'hors_service' ? 'panne' : 'remise_service', 'emplacement', id, avant.code, avant.site_id);
  } else {
    const apres = {
      code: texte(b.code, 'Code', { requis: true, max: 20 })!.toUpperCase(),
      type_prise: texte(b.type_prise, 'Type de prise', { max: 50 }) ?? 'Universel',
      notes: texte(b.notes, 'Notes', { max: 255 }),
      statut,
    };
    await execute('UPDATE emplacements SET code = ?, type_prise = ?, notes = ?, statut = ? WHERE id = ?', [
      apres.code,
      apres.type_prise,
      apres.notes,
      apres.statut,
      id,
    ]);
    if (
      statut !== avant.statut &&
      apres.code === avant.code &&
      apres.type_prise === avant.type_prise &&
      (apres.notes ?? null) === (avant.notes ?? null)
    ) {
      await journal(statut === 'hors_service' ? 'panne' : 'remise_service', 'emplacement', id, avant.code, avant.site_id);
    } else {
      await journal(
        'modification',
        'emplacement',
        id,
        `${avant.code} · ` + differences(avant, apres, { code: 'code', type_prise: 'type', notes: 'notes', statut: 'statut' }),
        avant.site_id
      );
    }
  }
  return queryOne('SELECT * FROM emplacements WHERE id = ?', [id]);
});

export const DELETE = route(
  async (_req, { params, site, journal }) => {
    const id = idParam(params);
    const e = await queryOne('SELECT code, site_id FROM emplacements WHERE id = ?', [id]);
    if (!e) notFound('Emplacement');
    site.verifier(e.site_id);
    if (await enCours(id)) throw new HttpError(409, 'Un téléphone est en charge sur cet emplacement');
    await execute('DELETE FROM emplacements WHERE id = ?', [id]);
    await journal('suppression', 'emplacement', id, e.code, e.site_id);
    return { ok: true };
  },
  { gerant: true }
);
