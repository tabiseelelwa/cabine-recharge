import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne } from '@/lib/db';
import { body, errorResponse, HttpError, texte } from '@/lib/api';
import { SESSION_COOKIE, SESSION_DUREE_SECONDES, signSession } from '@/lib/session';
import { ecrireJournal, ipDe } from '@/lib/journal';

export async function POST(req: NextRequest) {
  try {
    const b = await body(req);
    const identifiant = texte(b.identifiant, 'Identifiant', { requis: true })!;
    const motDePasse = texte(b.mot_de_passe, 'Mot de passe', { requis: true })!;

    const user = await queryOne<{
      id: number;
      nom: string;
      identifiant: string;
      mot_de_passe: string;
      role: 'admin' | 'operateur';
      actif: number;
    }>('SELECT * FROM utilisateurs WHERE identifiant = ?', [identifiant]);
    if (!user || !user.actif || !(await bcrypt.compare(motDePasse, user.mot_de_passe))) {
      await ecrireJournal(
        null,
        'echec_connexion',
        'utilisateur',
        user?.id ?? null,
        `Identifiant saisi : ${identifiant.slice(0, 50)}${user && !user.actif ? ' (compte désactivé)' : ''}`,
        ipDe(req.headers)
      );
      throw new HttpError(401, 'Identifiant ou mot de passe incorrect');
    }

    const session = { id: user.id, nom: user.nom, identifiant: user.identifiant, role: user.role };
    await ecrireJournal(session, 'connexion', 'utilisateur', user.id, null, ipDe(req.headers));
    const res = NextResponse.json(session);
    res.cookies.set(SESSION_COOKIE, await signSession(session), {
      httpOnly: true,
      sameSite: 'lax',
      // En réseau local sans HTTPS, laisser COOKIE_SECURE vide. Mettre "true" derrière un HTTPS.
      secure: process.env.COOKIE_SECURE === 'true',
      path: '/',
      maxAge: SESSION_DUREE_SECONDES,
    });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
