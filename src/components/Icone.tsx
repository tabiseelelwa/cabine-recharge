import type { ReactNode } from 'react';

// Petites icônes au trait (24×24), colorées par la couleur du texte (text-bleu, text-primaire…)
const TRACES: Record<string, ReactNode> = {
  repere: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  accueil: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  eclair: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  caisse: (
    <>
      <path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 7V6a2 2 0 0 1 2-2h11" />
      <path d="M16.5 13.5h.01" />
    </>
  ),
  grille: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  clients: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6 6 0 0 1 3.5 5.5" />
    </>
  ),
  soleil: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  lune: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  recu: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  graphique: <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />,
  etiquette: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  utilisateurs: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M3 21a7 7 0 0 1 14 0M19 8v6M16 11h6" />
    </>
  ),
  liste: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  base: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  reglages: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  imprimer: (
    <>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  poubelle: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3" />,
  crayon: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  interdit: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
  telecharger: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  envoyer: <path d="M12 20V8M7 13l5-5 5 5M5 4h14" />,
  sortie: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  fermer: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  valider: <path d="M5 12.5l4.5 4.5L19 7" />,
  historique: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  argent: (
    <>
      <path d="M3 7h18v10H3z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
};

export type NomIcone = keyof typeof TRACES;

export function Icone({ nom, className = 'size-5' }: { nom: NomIcone; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {TRACES[nom]}
    </svg>
  );
}

/** Logo de la cabine : soleil rouge clair avec un éclair */
export function Logo({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="11" fill="var(--primaire)" />
      <path
        d="M32 8v7M32 49v7M8 32h7M49 32h7M15 15l5 5M44 44l5 5M49 15l-5 5M20 44l-5 5"
        stroke="var(--primaire)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M34 24l-7 10h6l-3 8 8-11h-6z" fill="#fff" />
    </svg>
  );
}
