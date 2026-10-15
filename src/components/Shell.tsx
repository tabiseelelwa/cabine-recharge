'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { http } from '@/lib/http';
import { useMoi, useParametres, useSites } from '@/lib/hooks';
import type { Role } from '@/lib/types';
import { LIBELLE_ROLE } from '@/lib/format';
import { useInstallation, useTheme } from './Preferences';
import { Icone, Logo, type NomIcone } from './Icone';
import { bouton, boutonIcone, cx } from './ui';

type Lien = { href: string; label: string; icone: NomIcone; roles?: Role[] };

const LIENS: Lien[] = [
  { href: '/', label: 'Tableau de bord', icone: 'accueil' },
  { href: '/recharges', label: 'Dépôts & retraits', icone: 'eclair' },
  { href: '/caisse', label: 'Caisse', icone: 'caisse' },
  { href: '/emplacements', label: 'Emplacements', icone: 'grille' },
  { href: '/clients', label: 'Clients', icone: 'clients' },
  { href: '/energie', label: 'Énergie solaire', icone: 'soleil' },
  { href: '/depenses', label: 'Dépenses', icone: 'recu' },
  { href: '/rapports', label: 'Rapports', icone: 'graphique' },
];
// Gestion : visible par l'administrateur, et en partie par les gérants
const LIENS_ADMIN: Lien[] = [
  { href: '/sites', label: 'Sites', icone: 'repere', roles: ['admin', 'gerant'] },
  { href: '/tarifs', label: 'Tarifs', icone: 'etiquette', roles: ['admin', 'gerant'] },
  { href: '/utilisateurs', label: 'Utilisateurs', icone: 'utilisateurs', roles: ['admin'] },
  { href: '/journal', label: "Journal d'activité", icone: 'liste', roles: ['admin', 'gerant'] },
  { href: '/sauvegardes', label: 'Sauvegardes', icone: 'base', roles: ['admin'] },
  { href: '/parametres', label: 'Paramètres', icone: 'reglages', roles: ['admin'] },
];

/** Choix du site sur lequel on travaille (ou « Tous les sites » pour consulter) */
function SelecteurSite() {
  const { accessibles, siteActif, tous, peutTous, changer, isLoading } = useSites();
  if (isLoading) return null;
  if (accessibles.length <= 1 && !peutTous) {
    return siteActif ? (
      <div className="mx-1 mb-3 rounded-lg border border-ligne bg-survol px-3 py-2 text-sm">
        <span className="text-encre-3">Site : </span>
        <strong>{siteActif.nom}</strong>
      </div>
    ) : null;
  }
  return (
    <label className="mx-1 mb-3 flex flex-col gap-1">
      <span className="flex items-center gap-1.5 px-0.5 text-[0.7rem] font-semibold uppercase tracking-wider text-encre-3">
        <Icone nom="repere" className="size-3.5 text-bleu" /> Site
      </span>
      <select
        className={cx('min-h-10 font-semibold', tous ? 'text-bleu-texte' : 'text-encre')}
        value={tous ? 'tous' : String(siteActif?.id ?? '')}
        onChange={(e) => changer(e.target.value === 'tous' ? 'tous' : Number(e.target.value))}
      >
        {peutTous && <option value="tous">Tous les sites</option>}
        {accessibles.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} · {s.nom}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { data: moi } = useMoi();
  const { data: params } = useParametres();
  const [ouvert, setOuvert] = useState(false);
  const { sombre, basculer } = useTheme();
  const installation = useInstallation();
  const { siteActif, tous } = useSites();

  useEffect(() => setOuvert(false), [path]);

  const estActif = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const lien = (l: Lien) => {
    const actif = estActif(l.href);
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={actif ? 'page' : undefined}
        className={cx(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-[0.94rem] no-underline transition-colors',
          actif ? 'bg-primaire-pale font-semibold text-primaire-fort' : 'text-encre-2 hover:bg-survol hover:text-encre'
        )}
      >
        <Icone nom={l.icone} className={cx('size-[19px]', actif ? 'text-primaire-fort' : 'text-bleu')} />
        {l.label}
      </Link>
    );
  };

  async function deconnexion() {
    await http.post('/auth/logout').catch(() => {});
    window.location.href = '/login';
  }

  const nom = params?.nom_cabine || 'Cabines Solaires';
  const sousTitre = tous ? 'Tous les sites' : (siteActif?.nom ?? 'Recharge solaire');
  const liensAdmin = LIENS_ADMIN.filter((l) => moi && l.roles?.includes(moi.role));
  const boutonTheme = sombre ? (
    <>
      <Icone nom="soleil" className="size-4 text-bleu" /> Mode clair
    </>
  ) : (
    <>
      <Icone nom="lune" className="size-4 text-bleu" /> Mode sombre
    </>
  );

  return (
    <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Barre du haut (téléphone) */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ligne bg-carte px-4 py-2.5 lg:hidden print:hidden">
        <button className={cx(boutonIcone, 'text-encre')} onClick={() => setOuvert(true)} aria-label="Ouvrir le menu">
          <Icone nom="menu" className="size-6" />
        </button>
        <Logo className="size-7" />
        <div className="min-w-0 leading-tight">
          <strong className="block truncate">{nom}</strong>
          <span className="block truncate text-xs text-bleu">{sousTitre}</span>
        </div>
        <button
          className={cx(boutonIcone, 'ml-auto')}
          onClick={basculer}
          aria-label={sombre ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          <Icone nom={sombre ? 'soleil' : 'lune'} />
        </button>
      </header>

      {/* Fond grisé derrière le menu ouvert (téléphone) */}
      {ouvert && <div className="fixed inset-0 z-40 bg-gray-900/30 lg:hidden" onClick={() => setOuvert(false)} aria-hidden />}

      {/* Menu latéral (blanc) : la colonne garde le fond blanc sur toute la hauteur, le menu reste visible au défilement */}
      <aside className="contents lg:block lg:border-r lg:border-ligne lg:bg-carte print:hidden">
        <nav
          className={cx(
            'fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-1 overflow-y-auto border-r border-ligne bg-carte px-3.5 py-5 transition-transform duration-200',
            'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 lg:border-r-0',
            ouvert ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
            'print:hidden'
          )}
          aria-label="Menu principal"
        >
          <div className="flex items-center gap-2.5 px-2 pb-4">
            <Logo />
            <div className="min-w-0">
              <div className="truncate font-bold leading-tight">{nom}</div>
              <div className="text-xs text-bleu">Recharge solaire</div>
            </div>
            <button
              className={cx(boutonIcone, 'ml-auto text-encre-2 lg:hidden')}
              onClick={() => setOuvert(false)}
              aria-label="Fermer le menu"
            >
              <Icone nom="fermer" />
            </button>
          </div>

          <SelecteurSite />

          <div className="flex flex-col gap-0.5">
            {LIENS.map(lien)}
            {liensAdmin.length > 0 && (
              <>
                <div className="mx-1.5 my-2.5 h-px bg-ligne" />
                <div className="px-3 pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-encre-3">Gestion</div>
                {liensAdmin.map(lien)}
              </>
            )}
            {moi && moi.role !== 'admin' && lien({ href: '/parametres', label: 'Mon compte', icone: 'reglages' })}
          </div>

          <div className="mt-auto flex flex-col gap-2 border-t border-ligne px-1 pt-3 text-sm text-encre-2 [@media(max-height:820px)]:mt-4">
            {installation.possible && (
              <button className={cx(bouton('principal', 'petit'), 'w-full')} onClick={installation.installer}>
                <Icone nom="telecharger" className="size-4" /> Installer l'application
              </button>
            )}
            <button className={cx(bouton('defaut', 'petit'), 'w-full')} onClick={basculer}>
              {boutonTheme}
            </button>
            {moi && (
              <div className="px-1 py-1">
                Connecté : <strong className="text-encre">{moi.nom}</strong>
                <br />
                <span className="text-bleu">{LIBELLE_ROLE[moi.role]}</span>
              </div>
            )}
            <button className={cx(bouton('defaut', 'petit'), 'w-full')} onClick={deconnexion}>
              <Icone nom="sortie" className="size-4 text-bleu" /> Se déconnecter
            </button>
          </div>
        </nav>
      </aside>

      <main className="w-full min-w-0 p-4 sm:p-8 print:p-0">{children}</main>
    </div>
  );
}
