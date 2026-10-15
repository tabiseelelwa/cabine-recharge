import type { Metadata, Viewport } from 'next';
import Providers from './providers';
import { SCRIPT_THEME } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cabine Solaire · Gestion des recharges',
  description: "Gestion d'une cabine de recharge de téléphones à énergie solaire",
  applicationName: 'Cabine Solaire',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: 'Cabine', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
