import bcrypt from 'bcryptjs';
import { body, HttpError, route, texte } from '@/lib/api';
import { execute, queryOne } from '@/lib/db';

// Utilisateur connecté
export const GET = route(async (_req, { session }) => session);

// Changer son propre mot de passe
export const PUT = route(async (req, { session, journal }) => {
  const b = await body(req);
  const ancien = texte(b.ancien, 'Mot de passe actuel', { requis: true })!;
  const nouveau = texte(b.nouveau, 'Nouveau mot de passe', { requis: true, max: 100 })!;
  if (nouveau.length < 6) throw new HttpError(400, 'Le nouveau mot de passe doit contenir au moins 6 caractères');

  const u = await queryOne<{ mot_de_passe: string }>('SELECT mot_de_passe FROM utilisateurs WHERE id = ?', [session.id]);
  if (!u || !(await bcrypt.compare(ancien, u.mot_de_passe))) throw new HttpError(400, 'Mot de passe actuel incorrect');

  await execute('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [await bcrypt.hash(nouveau, 10), session.id]);
  await journal('mot_de_passe', 'utilisateur', session.id, 'Mot de passe personnel modifié', null);
  return { ok: true };
});
