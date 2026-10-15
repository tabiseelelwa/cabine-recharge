'use client';
import { useCallback, useEffect, useState } from 'react';

/* ---------------- Mode sombre ---------------- */
// Le thème choisi est appliqué avant l'affichage par le script de src/lib/theme.ts (pas de flash blanc).
import { CLE_THEME, COULEUR_BARRE } from '@/lib/theme';

export function useTheme() {
  const [sombre, setSombre] = useState(false);

  useEffect(() => {
    setSombre(document.documentElement.dataset.theme === 'dark');
  }, []);

  const basculer = useCallback(() => {
    const nouveau = !sombre;
    setSombre(nouveau);
    document.documentElement.dataset.theme = nouveau ? 'dark' : 'light';
    try {
      localStorage.setItem(CLE_THEME, nouveau ? 'dark' : 'light');
    } catch {
      /* stockage indisponible : le choix vaut pour cette visite */
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nouveau ? COULEUR_BARRE.sombre : COULEUR_BARRE.clair);
  }, [sombre]);

  return { sombre, basculer };
}

/* ---------------- Installation (PWA) ---------------- */
type EvenementInstallation = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function useInstallation() {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null);

  useEffect(() => {
    const w = window as unknown as { __evtInstall?: EvenementInstallation };
    if (w.__evtInstall) setEvenement(w.__evtInstall);
    const surProposition = (e: Event) => {
      e.preventDefault();
      setEvenement(e as EvenementInstallation);
    };
    const surInstallee = () => {
      w.__evtInstall = undefined;
      setEvenement(null);
    };
    window.addEventListener('beforeinstallprompt', surProposition);
    window.addEventListener('appinstalled', surInstallee);
    return () => {
      window.removeEventListener('beforeinstallprompt', surProposition);
      window.removeEventListener('appinstalled', surInstallee);
    };
  }, []);

  const installer = useCallback(async () => {
    if (!evenement) return;
    await evenement.prompt();
    await evenement.userChoice.catch(() => null);
    (window as unknown as { __evtInstall?: unknown }).__evtInstall = undefined;
    setEvenement(null);
  }, [evenement]);

  return { possible: !!evenement, installer };
}

/**
 * Service worker : actif uniquement en production (npm start).
 * En développement (npm run dev), on retire tout service worker resté d'un lancement précédent,
 * sinon il pourrait servir d'anciens fichiers et mélanger deux versions de l'interface.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((liste) => liste.forEach((r) => r.unregister()));
      if ('caches' in window) caches.keys().then((cles) => cles.forEach((c) => caches.delete(c)));
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Service worker non enregistré :', e));
  }, []);
}
