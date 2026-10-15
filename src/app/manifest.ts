import type { MetadataRoute } from 'next';

// Rend l'application installable sur le téléphone (icône sur l'écran d'accueil, plein écran)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cabine Solaire · Gestion des recharges',
    short_name: 'Cabine',
    description: 'Dépôts, retraits, caisse et énergie de la cabine de recharge solaire',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: [
      { name: 'Nouveau dépôt', short_name: 'Dépôt', url: '/recharges?nouveau=1', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Caisse', url: '/caisse', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
