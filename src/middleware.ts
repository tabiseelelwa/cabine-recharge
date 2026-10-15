import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/session';

const PUBLIC = ['/login', '/api/auth/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ message: 'Session expirée, reconnectez-vous' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Fichiers publics accessibles sans connexion : icônes, manifeste, service worker, page hors ligne
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|icon-maskable-512.png|apple-touch-icon.png|manifest.webmanifest|sw.js|hors-ligne.html).*)',
  ],
};
