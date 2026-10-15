import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { ecrireJournal, ipDe } from '@/lib/journal';

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) await ecrireJournal(session, 'deconnexion', 'utilisateur', session.id, null, ipDe(req.headers));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
