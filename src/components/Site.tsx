'use client';
import { useSites } from '@/lib/hooks';
import { Icone } from './Icone';
import { Alerte, bouton } from './ui';

/**
 * Affiché en vue « Tous les sites » quand une opération (dépôt, caisse, relevé…) concerne un seul site :
 * propose de choisir le site en un clic.
 */
export function ChoisirSite({ pour }: { pour: string }) {
  const { accessibles, changer } = useSites();
  return (
    <Alerte ton="info">
      <div className="flex flex-wrap items-center gap-2">
        <Icone nom="repere" className="size-5" />
        <span>
          Vous consultez <strong>tous les sites</strong>. Pour {pour}, choisissez un site :
        </span>
        {accessibles.map((s) => (
          <button key={s.id} className={bouton('defaut', 'petit')} onClick={() => changer(s.id)}>
            {s.code} · {s.nom}
          </button>
        ))}
      </div>
    </Alerte>
  );
}

/** Petite étiquette du site d'une ligne (affichée en vue « Tous les sites ») */
export function EtiquetteSite({ code, nom }: { code?: string | null; nom?: string | null }) {
  if (!code) return <span className="text-xs text-encre-3">Général</span>;
  return (
    <span
      title={nom ?? undefined}
      className="inline-block whitespace-nowrap rounded bg-bleu-pale px-1.5 py-px text-xs font-semibold text-bleu-texte"
    >
      {code}
    </span>
  );
}
