/* Service worker de la Cabine Solaire.
 * - Fichiers de l'application avec empreinte (JS, CSS de la version installée) : gardés en cache → ouverture rapide.
 * - Icônes : réseau d'abord, cache en secours.
 * - Pages : toujours demandées au serveur d'abord ; copie en cache en secours.
 * - API (/api/...) : jamais mise en cache (les données doivent toujours être à jour).
 * - Serveur injoignable : page « hors ligne » explicative.
 */
// Changer ce numéro à chaque nouvelle version : les anciens fichiers en cache sont alors effacés
const VERSION = 'cabine-v3';
const CACHE_STATIQUE = `${VERSION}-statique`;
const CACHE_PAGES = `${VERSION}-pages`;
const A_PRECHARGER = ['/hors-ligne.html', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIQUE)
      .then((c) => c.addAll(A_PRECHARGER))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // données : toujours en direct

  // Fichiers de Next.js dont le nom contient une empreinte (ils ne changent jamais) : cache d'abord
  if (url.pathname.startsWith('/_next/static/') && /[0-9a-f]{8,}/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (enCache) =>
          enCache ||
          fetch(req).then((rep) => {
            if (rep.ok) {
              const copie = rep.clone();
              caches.open(CACHE_STATIQUE).then((c) => c.put(req, copie));
            }
            return rep;
          })
      )
    );
    return;
  }

  // Icônes et autres fichiers : réseau d'abord (pour voir tout de suite les mises à jour), cache en secours
  if (/\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((rep) => {
          if (rep.ok) {
            const copie = rep.clone();
            caches.open(CACHE_STATIQUE).then((c) => c.put(req, copie));
          }
          return rep;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Navigation : réseau d'abord, puis copie en cache, puis page hors ligne
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((rep) => {
          if (rep.ok && !rep.redirected) {
            const copie = rep.clone();
            caches.open(CACHE_PAGES).then((c) => c.put(req, copie));
          }
          return rep;
        })
        .catch(() => caches.match(req).then((enCache) => enCache || caches.match('/hors-ligne.html')))
    );
  }
});
