import { body, HttpError, idParam, notFound, route, texte } from '@/lib/api';
import { execute, queryOne } from '@/lib/db';
import { differences } from '@/lib/journal';

export const GET = route(async (_req, { params }) => {
  const c = await queryOne('SELECT * FROM clients WHERE id = ?', [idParam(params)]);
  return c ?? notFound('Client');
});

export const PUT = route(async (req, { params, journal }) => {
  const id = idParam(params);
  const avant = await queryOne('SELECT * FROM clients WHERE id = ?', [id]);
  if (!avant) notFound('Client');
  const b = await body(req);
  const apres = {
    nom: texte(b.nom, 'Nom', { requis: true, max: 100 }),
    telephone: texte(b.telephone, 'Téléphone', { requis: true, max: 30 })!.replace(/\s+/g, ''),
    notes: texte(b.notes, 'Notes', { max: 255 }),
  };
  await execute('UPDATE clients SET nom = ?, telephone = ?, notes = ? WHERE id = ?', [apres.nom, apres.telephone, apres.notes, id]);
  await journal(
    'modification',
    'client',
    id,
    `${avant.nom} · ` + differences(avant, apres, { nom: 'nom', telephone: 'téléphone', notes: 'notes' })
  );
  return queryOne('SELECT * FROM clients WHERE id = ?', [id]);
});

export const DELETE = route(
  async (_req, { params, journal }) => {
    const id = idParam(params);
    const c = await queryOne('SELECT nom, telephone FROM clients WHERE id = ?', [id]);
    if (!c) notFound('Client');
    const n = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM recharges WHERE client_id = ?', [id]);
    if (n && n.n > 0) throw new HttpError(409, 'Ce client a un historique de recharges : suppression impossible');
    await execute('DELETE FROM clients WHERE id = ?', [id]);
    await journal('suppression', 'client', id, `${c.nom} · ${c.telephone}`);
    return { ok: true };
  },
  { admin: true }
);
