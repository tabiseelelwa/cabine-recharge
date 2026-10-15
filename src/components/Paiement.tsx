'use client';
import Link from 'next/link';
import { useApi, useParametres } from '@/lib/hooks';
import { estMobile, MODES, modesActifs, type ModePaiement } from '@/lib/modes';
import type { EtatCaisse } from '@/lib/types';
import { Alerte, cx, Field } from './ui';

export type ValeurPaiement = { mode: ModePaiement; reference: string };
export const PAIEMENT_DEFAUT: ValeurPaiement = { mode: 'especes', reference: '' };

// Couleurs de chaque mode : celles des opérateurs, pour les reconnaître d'un coup d'œil
const STYLE_MODE: Record<ModePaiement, { actif: string; pastille: string }> = {
  especes: { actif: 'border-vert bg-vert-pale text-vert', pastille: 'bg-vert-pale text-vert' },
  mpesa: {
    actif: 'border-[#d4373c] bg-[#fde7e7] text-[#b42328] dark:border-[#f08a8d] dark:bg-[#351a1b] dark:text-[#f08a8d]',
    pastille: 'bg-[#fde7e7] text-[#b42328] dark:bg-[#351a1b] dark:text-[#f08a8d]',
  },
  airtel: {
    actif: 'border-[#e0262d] bg-[#fde3e4] text-[#c0151c] dark:border-[#f28b8f] dark:bg-[#361a1c] dark:text-[#f28b8f]',
    pastille: 'bg-[#fde3e4] text-[#c0151c] dark:bg-[#361a1c] dark:text-[#f28b8f]',
  },
  orange: {
    actif: 'border-[#e96b00] bg-[#fff0e2] text-[#b45309] dark:border-[#ffa65a] dark:bg-[#33220f] dark:text-[#ffa65a]',
    pastille: 'bg-[#fff0e2] text-[#b45309] dark:bg-[#33220f] dark:text-[#ffa65a]',
  },
  autre: { actif: 'border-bleu bg-bleu-pale text-bleu-texte', pastille: 'bg-bleu-pale text-bleu-texte' },
};

export function useModes() {
  const { data } = useParametres();
  return modesActifs(data?.modes_paiement);
}

/** Choix du mode de paiement (espèces / mobile money) + référence de transaction */
export function ChoixPaiement({
  valeur,
  onChange,
  label = 'Mode de paiement',
  sansReference,
}: {
  valeur: ValeurPaiement;
  onChange: (v: ValeurPaiement) => void;
  label?: string;
  sansReference?: boolean;
}) {
  const modes = useModes();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-encre-2">{label}</span>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2" role="radiogroup" aria-label={label}>
        {modes.map((m) => {
          const actif = valeur.mode === m;
          return (
            <button
              type="button"
              key={m}
              role="radio"
              aria-checked={actif}
              className={cx(
                'min-h-[46px] rounded-lg border-2 px-2 py-2.5 font-semibold transition-colors',
                actif ? STYLE_MODE[m].actif : 'border-ligne-forte bg-champ text-encre hover:border-encre-3'
              )}
              onClick={() => onChange({ ...valeur, mode: m })}
            >
              {MODES[m]}
            </button>
          );
        })}
      </div>
      {!sansReference && estMobile(valeur.mode) && (
        <div className="mt-2">
          <Field label="N° de transaction (référence du SMS)" aide="Recommandé : permet de vérifier le paiement en cas de litige">
            <input
              value={valeur.reference}
              onChange={(e) => onChange({ ...valeur, reference: e.target.value })}
              maxLength={50}
              autoComplete="off"
              placeholder="ex. PP241014.1530.A12345"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

/** Pastille d'un mode de paiement */
export function PastilleMode({ mode }: { mode: string }) {
  const style = STYLE_MODE[mode as ModePaiement]?.pastille ?? 'bg-gris-pale text-encre-2';
  return (
    <span className={cx('mr-1 mt-1 inline-block whitespace-nowrap rounded-full px-2 py-px text-[0.72rem] font-bold', style)}>
      {MODES[mode as ModePaiement] ?? mode}
    </span>
  );
}

/** Pastilles des modes utilisés pour une recharge (« especes,mpesa ») */
export function PastillesModes({ modes }: { modes: string | null | undefined }) {
  if (!modes) return null;
  return (
    <>
      {modes.split(',').map((m) => (
        <PastilleMode key={m} mode={m} />
      ))}
    </>
  );
}

/** Encadré qui regroupe les champs de paiement dans les formulaires */
export function BlocPaiement({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 rounded-lg border border-ligne bg-survol p-3.5">{children}</div>;
}

/**
 * État de la caisse pour les formulaires qui encaissent.
 * siteId : site du téléphone concerné (utile en vue « Tous les sites », où l'argent va dans la caisse de ce site).
 */
export function useEtatCaisse(siteId?: number) {
  const { data: p } = useParametres();
  const etat = useApi<EtatCaisse>('/caisse');
  const obligatoire = (p?.caisse_obligatoire ?? '1') !== '0';
  const d = etat.data;
  const ouverte = d ? (d.actif ? !!d.ouverte : !!d.sites.find((x) => x.id === siteId)?.caisse) : false;
  return { chargee: !!etat.data, ouverte, obligatoire, bloque: !!etat.data && obligatoire && !ouverte };
}

export function AlerteCaisseFermee() {
  return (
    <Alerte ton="info" className="mb-0">
      La caisse est fermée : impossible d'encaisser. <Link href="/caisse">Ouvrir la caisse</Link>
    </Alerte>
  );
}
