import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, Session, verifySession } from './session';
import { ecrireJournal, ipDe, type Journaliser } from './journal';
import { HttpError } from './erreurs';
import { chargerContexte, type ContexteSite } from './sites';

export { HttpError };

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (
  req: NextRequest,
  ctx: { params: Record<string, string>; session: Session; site: ContexteSite; journal: Journaliser }
) => Promise<unknown>;

/**
 * Enveloppe commune des routes API : vérifie la session, le rôle et les sites accessibles,
 * convertit le résultat en JSON et gère les erreurs.
 *  - admin : réservé à l'administrateur
 *  - gerant : réservé à l'administrateur et aux gérants (sur leurs sites)
 */
export function route(fn: Handler, opts: { admin?: boolean; gerant?: boolean } = {}) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      const jeton = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
      if (!jeton) throw new HttpError(401, 'Session expirée, reconnectez-vous');
      const { session, site } = await chargerContexte(req, jeton);
      if (opts.admin && session.role !== 'admin') throw new HttpError(403, "Réservé à l'administrateur");
      if (opts.gerant && session.role === 'operateur') throw new HttpError(403, 'Réservé aux gérants et à l’administrateur');
      const params = ctx?.params ? await ctx.params : {};
      const ip = ipDe(req.headers);
      // Par défaut, une action est rattachée au site choisi ; on peut préciser un autre site
      const journal: Journaliser = (action, entite, entiteId = null, details = null, siteId) =>
        ecrireJournal(session, action, entite, entiteId, details, ip, siteId === undefined ? site.actif : siteId);
      const data = await fn(req, { params, session, site, journal });
      if (data instanceof NextResponse) return data;
      return NextResponse.json(data ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ message: e.message }, { status: e.status });
  const err = e as { code?: string; message?: string };
  if (err?.code === 'ER_DUP_ENTRY') return NextResponse.json({ message: 'Cette valeur existe déjà' }, { status: 409 });
  if (err?.code === 'ER_ROW_IS_REFERENCED_2')
    return NextResponse.json({ message: 'Suppression impossible : élément utilisé ailleurs' }, { status: 409 });
  if (err?.code === 'ECONNREFUSED')
    return NextResponse.json({ message: 'Base de données injoignable (MySQL est-il démarré ?)' }, { status: 503 });
  console.error(e);
  return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 });
}

export async function body(req: NextRequest): Promise<Record<string, any>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? b : {};
  } catch {
    throw new HttpError(400, 'Corps de requête invalide');
  }
}

/* ---------- Validation légère ---------- */

export function texte(v: unknown, champ: string, opts: { requis?: boolean; max?: number } = {}): string | null {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (!s) {
    if (opts.requis) throw new HttpError(400, `Le champ « ${champ} » est obligatoire`);
    return null;
  }
  if (opts.max && s.length > opts.max) throw new HttpError(400, `« ${champ} » : ${opts.max} caractères maximum`);
  return s;
}

export function nombre(
  v: unknown,
  champ: string,
  opts: { requis?: boolean; min?: number; max?: number; entier?: boolean } = {}
): number | null {
  if (v === '' || v == null) {
    if (opts.requis) throw new HttpError(400, `Le champ « ${champ} » est obligatoire`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, `« ${champ} » doit être un nombre`);
  if (opts.entier && !Number.isInteger(n)) throw new HttpError(400, `« ${champ} » doit être un entier`);
  if (opts.min !== undefined && n < opts.min) throw new HttpError(400, `« ${champ} » doit être ≥ ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw new HttpError(400, `« ${champ} » doit être ≤ ${opts.max}`);
  return n;
}

export function dateISO(v: unknown, champ: string, requis = false): string | null {
  const s = texte(v, champ, { requis });
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, `« ${champ} » : date invalide (AAAA-MM-JJ)`);
  return s;
}

export function idParam(params: Record<string, string>): number {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identifiant invalide');
  return id;
}

export function notFound(what = 'Élément'): never {
  throw new HttpError(404, `${what} introuvable`);
}
