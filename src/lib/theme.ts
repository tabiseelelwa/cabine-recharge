// Thème clair / sombre. Ce fichier n'est pas un composant client : il peut être importé par layout.tsx.
export const CLE_THEME = 'cabine-theme';
export const COULEUR_BARRE = { clair: '#ffffff', sombre: '#0f1419' };

/**
 * Script exécuté avant l'affichage de la page (évite un flash) :
 *  - applique le thème mémorisé, sinon celui du téléphone, en posant data-theme sur <html>
 *    (Tailwind s'en sert pour les classes « dark: ») ;
 *  - garde la proposition d'installation, qui peut arriver avant que React soit prêt.
 */
export const SCRIPT_THEME = `(function(){var t;try{t=localStorage.getItem('${CLE_THEME}');}catch(e){}if(t!=='dark'&&t!=='light'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'${COULEUR_BARRE.sombre}':'${COULEUR_BARRE.clair}');window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__evtInstall=e;});})();`;
