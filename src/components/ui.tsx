'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { LIBELLE_STATUT } from '@/lib/format';
import { Icone } from './Icone';

/* =========================================================
 * Briques d'interface en Tailwind CSS, réutilisées par toutes les pages
 * ========================================================= */

/** Assemble des classes en ignorant les valeurs vides */
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

/* ---------------- Boutons ---------------- */
type VarianteBouton = 'defaut' | 'principal' | 'bleu' | 'vert' | 'danger';
const VARIANTES: Record<VarianteBouton, string> = {
  defaut: 'border-ligne bg-carte text-encre hover:border-ligne-forte hover:bg-survol',
  principal: 'border-primaire bg-primaire font-semibold text-white hover:border-primaire-fort hover:bg-primaire-fort',
  bleu: 'border-bleu bg-bleu font-semibold text-white hover:brightness-110',
  vert: 'border-vert-plein bg-vert-plein font-semibold text-white hover:brightness-110',
  danger: 'border-ligne bg-carte text-danger hover:border-danger-bord hover:bg-danger-pale',
};

/** Classes d'un bouton : utilisable sur <button>, <a> et <Link> */
export function bouton(variante: VarianteBouton = 'defaut', taille: 'normal' | 'petit' = 'normal') {
  return cx(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium no-underline transition',
    'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55',
    taille === 'petit' ? 'min-h-8 px-2.5 py-1 text-[0.86rem]' : 'min-h-10 px-4 py-2',
    VARIANTES[variante]
  );
}

/** Bouton discret avec une seule icône */
export const boutonIcone =
  'inline-flex items-center justify-center rounded-md border-0 bg-transparent p-1.5 text-bleu transition hover:bg-gris-pale';

/* ---------------- Mise en page ---------------- */
export const CARTE = 'rounded-xl border border-ligne bg-carte p-5 shadow-carte';
export const GRILLE_2 = 'grid items-start gap-4 lg:grid-cols-2';

export function Carte({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx(CARTE, className)}>{children}</section>;
}

export function CarteTete({ titre, children }: { titre: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
      <h2 className="text-lg font-semibold">{titre}</h2>
      {children}
    </div>
  );
}

export function EnTete({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titre}</h1>
        {sousTitre && <p className="mt-1 max-w-3xl text-encre-2">{sousTitre}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/* ---------------- Tableaux ---------------- */
/** Classes d'un <table> : style des en-têtes et cellules sans avoir à les répéter */
export const TABLEAU = cx(
  'w-full border-collapse text-[0.93rem]',
  '[&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-ligne [&_th]:px-2.5 [&_th]:py-2 [&_th:not(.text-right)]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-encre-2',
  '[&_td]:border-b [&_td]:border-gris-pale [&_td]:px-2.5 [&_td]:py-2.5 [&_td]:align-middle [&_td.tabular-nums]:whitespace-nowrap',
  '[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover]:bg-survol',
  '[&_tfoot_td]:border-t [&_tfoot_td]:border-ligne [&_tfoot_td]:font-bold'
);

export function Tableau({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className={TABLEAU}>{children}</table>
    </div>
  );
}

/* ---------------- Formulaires ---------------- */
export function Field({ label, children, aide }: { label: string; children: ReactNode; aide?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-encre-2">{label}</span>
      {children}
      {aide && <span className="text-xs text-encre-3">{aide}</span>}
    </label>
  );
}

export function Case({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cx('flex cursor-pointer items-center gap-2 font-medium', className)}>{children}</label>;
}

export const FORM = 'grid gap-3.5';
export const LIGNE_FORM = 'grid gap-3 sm:grid-cols-2';
export const ACTIONS = 'mt-1.5 flex flex-wrap justify-end gap-2';
export const CASE = 'flex cursor-pointer items-center gap-2 font-medium';
// Barre de filtres : les champs gardent leur largeur naturelle
export const FILTRES = 'flex flex-wrap items-center gap-2.5 [&_input:not([type=checkbox])]:w-auto [&_select]:w-auto';
export const TETE = 'mb-3.5 flex flex-wrap items-center justify-between gap-2.5';
export const TABLE_WRAP = '-mx-5 overflow-x-auto px-5';
export const TITRE_CARTE = 'text-lg font-semibold';

export function Actions({ children, debut }: { children: ReactNode; debut?: boolean }) {
  return <div className={cx('mt-1.5 flex flex-wrap gap-2', debut ? 'justify-start' : 'justify-end')}>{children}</div>;
}

/** Lit un <form> en objet simple */
export function lireForm(e: React.FormEvent<HTMLFormElement>): Record<string, any> {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const o: Record<string, any> = {};
  fd.forEach((v, k) => (o[k] = typeof v === 'string' ? v : ''));
  e.currentTarget.querySelectorAll<HTMLInputElement>('input[type=checkbox][name]').forEach((c) => (o[c.name] = c.checked));
  return o;
}

/* ---------------- Notifications ---------------- */
type Toast = { id: number; texte: string; type: 'ok' | 'erreur' };
const ToastCtx = createContext<(texte: string, type?: 'ok' | 'erreur') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((texte: string, type: 'ok' | 'erreur' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texte, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'erreur' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex max-w-[calc(100vw-40px)] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'animate-monte rounded-lg px-4 py-3 font-medium text-white shadow-lg',
              t.type === 'ok' ? 'bg-vert-plein' : 'bg-danger dark:bg-[#b91c1c]'
            )}
          >
            {t.texte}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Fenêtre modale ---------------- */
export function Modal({ titre, onClose, children, large }: { titre: string; onClose: () => void; children: ReactNode; large?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-gray-900/40 px-4 py-[6vh] backdrop-blur-[1px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cx('w-full rounded-2xl border border-ligne bg-carte shadow-2xl', large ? 'max-w-3xl' : 'max-w-lg')}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
      >
        <div className="flex items-center justify-between border-b border-ligne px-5 py-4">
          <h2 className="text-lg font-semibold">{titre}</h2>
          <button className={cx(boutonIcone, 'text-encre-2')} onClick={onClose} aria-label="Fermer">
            <Icone nom="fermer" />
          </button>
        </div>
        <div className="px-5 pb-5 pt-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Alertes ---------------- */
const TONS_ALERTE = {
  erreur: 'border-danger-bord bg-danger-pale text-danger',
  info: 'border-bleu-bord bg-bleu-pale text-bleu-texte',
  ok: 'border-vert-bord bg-vert-pale text-vert',
};
/** Classes d'une alerte (pour un <div> déjà en place) */
export function alerte(ton: keyof typeof TONS_ALERTE, marge = true) {
  return cx('rounded-lg border px-4 py-3 [&_a]:font-semibold [&_a]:underline', TONS_ALERTE[ton], marge && 'mb-4');
}
export function Alerte({ ton, children, className }: { ton: keyof typeof TONS_ALERTE; children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-lg border px-4 py-3 [&_a]:font-semibold [&_a]:underline', TONS_ALERTE[ton], className ?? 'mb-4')}>
      {children}
    </div>
  );
}

/* ---------------- Badges de statut ---------------- */
const TONS_BADGE: Record<string, string> = {
  en_charge: 'bg-bleu-pale text-bleu-texte',
  occupe: 'bg-bleu-pale text-bleu-texte',
  pret: 'bg-vert-pale text-vert',
  libre: 'bg-vert-pale text-vert',
  retire: 'bg-gris-pale text-encre-2',
  annule: 'bg-danger-pale text-danger',
  hors_service: 'bg-danger-pale text-danger',
  admin: 'bg-primaire-pale text-primaire-fort',
  gerant: 'bg-bleu-pale text-bleu-texte',
  operateur: 'bg-gris-pale text-encre-2',
};
export function Badge({ statut, texte }: { statut: string; texte?: string }) {
  return (
    <span
      className={cx(
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONS_BADGE[statut] ?? TONS_BADGE.retire
      )}
    >
      {texte ?? LIBELLE_STATUT[statut] ?? statut}
    </span>
  );
}

/** Code de ticket mis en évidence */
export function CodeTicket({ code }: { code: string }) {
  return (
    <span className="rounded-md border border-primaire-bord bg-primaire-pale px-2 py-0.5 font-mono font-bold tracking-[0.12em] text-primaire-fort">
      {code}
    </span>
  );
}

/* ---------------- États ---------------- */
export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-6 text-encre-3">
      <span className="size-[18px] animate-spin rounded-full border-2 border-ligne border-t-primaire" /> {texte}
    </div>
  );
}

export function Vide({ texte }: { texte: string }) {
  return <div className="px-2.5 py-8 text-center text-encre-3">{texte}</div>;
}

export function Erreur({ erreur }: { erreur: unknown }) {
  const msg = (erreur as any)?.response?.data?.message ?? 'Impossible de charger les données';
  return <Alerte ton="erreur">{msg}</Alerte>;
}

/* ---------------- Indicateurs ---------------- */
const TONS_KPI = {
  accent: { boite: 'border-ligne border-t-4 border-t-primaire bg-carte', valeur: 'text-primaire-fort' },
  ok: { boite: 'border-ligne bg-carte', valeur: 'text-vert' },
  alerte: { boite: 'border-danger-bord bg-danger-pale', valeur: 'text-danger' },
  normal: { boite: 'border-ligne bg-carte', valeur: '' },
};
export function Kpi({
  label,
  valeur,
  detail,
  ton = 'normal',
}: {
  label: string;
  valeur: ReactNode;
  detail?: ReactNode;
  ton?: keyof typeof TONS_KPI;
}) {
  return (
    <div className={cx('min-w-0 rounded-xl border px-3.5 py-3 shadow-carte sm:px-[18px] sm:py-4', TONS_KPI[ton].boite)}>
      <div className="text-xs font-medium uppercase tracking-wide text-encre-2">{label}</div>
      <div className={cx('mt-1.5 text-xl font-bold tabular-nums sm:text-[1.6rem]', TONS_KPI[ton].valeur)}>{valeur}</div>
      {detail && <div className="mt-1 text-sm text-encre-3 [&_a]:text-bleu [&_a]:underline-offset-2 hover:[&_a]:underline">{detail}</div>}
    </div>
  );
}

export const GRILLE_KPI = 'mb-[18px] grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:gap-3.5';

/** Jauge de batterie */
export function Jauge({ niveau, seuil = 25 }: { niveau: number; seuil?: number }) {
  const couleur = niveau <= seuil ? 'bg-danger' : niveau <= 50 ? 'bg-bleu' : 'bg-vert-plein';
  return (
    <div className="flex items-center gap-3" aria-label={`Batterie ${niveau} %`}>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-gris-pale">
        <div
          className={cx('h-full rounded-full transition-[width] duration-500', couleur)}
          style={{ width: `${Math.max(2, Math.min(100, niveau))}%` }}
        />
      </div>
      <span className="w-14 text-right text-lg font-bold tabular-nums">{niveau} %</span>
    </div>
  );
}
