// Jetons de session (compatible avec le middleware Edge : pas de module Node ici)
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'cabine_session';
export const SESSION_DUREE_SECONDES = 60 * 60 * 12; // 12 heures

export type Role = 'admin' | 'gerant' | 'operateur';

export type Session = {
  id: number;
  nom: string;
  identifiant: string;
  role: Role;
};

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('AUTH_SECRET manquant ou trop court dans .env.local');
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DUREE_SECONDES}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: Number(payload.id),
      nom: String(payload.nom),
      identifiant: String(payload.identifiant),
      role: payload.role === 'admin' || payload.role === 'gerant' ? payload.role : 'operateur',
    };
  } catch {
    return null;
  }
}
