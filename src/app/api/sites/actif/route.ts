import { NextResponse } from 'next/server';
import { body, HttpError, route } from '@/lib/api';
import { SITE_COOKIE } from '@/lib/sites';

/** Choisir le site sur lequel on travaille : { site: <id> } ou { site: 'tous' } */
export const POST = route(async (req, { session, site }) => {
  const b = await body(req);
  let valeur: string;
  if (b.site === 'tous') {
    if (session.role !== 'admin' && site.ids.length < 2) throw new HttpError(403, 'Vous travaillez sur un seul site');
    valeur = 'tous';
  } else {
    const id = Number(b.site);
    if (!site.ids.includes(id)) throw new HttpError(403, 'Ce site ne vous est pas accessible');
    valeur = String(id);
  }
  const res = NextResponse.json({ ok: true, site: valeur });
  res.cookies.set(SITE_COOKIE, valeur, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
});
