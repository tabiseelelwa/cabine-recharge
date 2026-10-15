'use client';
import Link from 'next/link';
import { useApi, useParametres } from '@/lib/hooks';
import { argent, aujourdhui, dateHeure, depuis } from '@/lib/format';
import type { Emplacement, Recharge, Stats } from '@/lib/types';
import {
  alerte,
  Badge,
  bouton,
  CARTE,
  cx,
  Chargement,
  EnTete,
  Erreur,
  GRILLE_2,
  GRILLE_KPI,
  Jauge,
  Kpi,
  TETE,
  Tableau,
  TITRE_CARTE,
  Vide,
} from '@/components/ui';
import { Icone } from '@/components/Icone';
import { RetraitModal } from '@/components/RechargeActions';
import { EtiquetteSite } from '@/components/Site';
import { useState } from 'react';
import type { ResumeSite } from '@/lib/types';

const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

function joursDepuis(d: string | null | undefined): number {
  if (!d) return Infinity;
  return Math.floor((Date.now() - new Date(d.replace(' ', 'T')).getTime()) / 86_400_000);
}

export default function TableauDeBord() {
  const { devise } = useParametres();
  const stats = useApi<Stats>('/stats', undefined, { refetchInterval: 30_000 });
  const empl = useApi<Emplacement[]>('/emplacements', undefined, { refetchInterval: 30_000, enabled: stats.data?.site_actif != null });
  const prets = useApi<Recharge[]>('/recharges', { statut: 'pret' }, { refetchInterval: 30_000 });
  const [retrait, setRetrait] = useState<Recharge | null>(null);

  if (stats.isLoading) return <Chargement />;
  if (stats.error) return <Erreur erreur={stats.error} />;
  const s = stats.data!;
  const tous = s.site_actif === null;
  const batterieBasse = s.energie && s.energie.niveau_batterie <= s.seuil_batterie;
  // Vue « Tous les sites » : alertes regroupées
  const sitesBatterieBasse = s.sites.filter((x) => x.batterie !== null && x.batterie <= x.seuil_batterie);
  const sitesCaisseFermee = s.sites.filter((x) => !x.caisse_ouverte);
  const max = Math.max(1, ...s.semaine.map((j) => Number(j.encaisse)));

  return (
    <>
      <EnTete
        titre="Tableau de bord"
        sousTitre={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      >
        {!tous && (
          <Link href="/recharges?nouveau=1" className={bouton('principal')}>
            <Icone nom="plus" className="size-4" /> Nouveau dépôt
          </Link>
        )}
      </EnTete>

      {tous && sitesBatterieBasse.length > 0 && (
        <div className={alerte('erreur')}>
          <strong>Batterie faible :</strong> {sitesBatterieBasse.map((x) => `${x.code} (${x.batterie} %)`).join(', ')}.
        </div>
      )}
      {tous && sitesCaisseFermee.length > 0 && (
        <div className={alerte(s.caisse_obligatoire ? 'erreur' : 'info')}>
          <strong>Caisse fermée :</strong> {sitesCaisseFermee.map((x) => x.code).join(', ')}.{' '}
          {s.caisse_obligatoire ? 'Ces sites ne peuvent pas encaisser.' : ''}
        </div>
      )}

      {batterieBasse && (
        <div className={alerte('erreur')}>
          <strong>Batterie solaire faible ({s.energie!.niveau_batterie} %).</strong> Limitez les nouveaux dépôts jusqu'à la prochaine
          recharge des panneaux.
        </div>
      )}
      {!tous && !s.caisse && (
        <div className={alerte(s.caisse_obligatoire ? 'erreur' : 'info')}>
          <strong>La caisse est fermée.</strong> {s.caisse_obligatoire ? 'Aucun paiement ne peut être encaissé. ' : ''}
          <Link href="/caisse">Ouvrir la caisse</Link>
        </div>
      )}
      {s.derniere_sauvegarde !== undefined && joursDepuis(s.derniere_sauvegarde) >= 7 && (
        <div className={alerte('info')}>
          {s.derniere_sauvegarde
            ? `Dernière copie de sauvegarde téléchargée il y a ${joursDepuis(s.derniere_sauvegarde)} jours.`
            : "Vous n'avez encore jamais téléchargé de copie de sauvegarde."}{' '}
          Gardez une copie hors du PC de la cabine (clé USB, téléphone) : <Link href="/sauvegardes">Télécharger une sauvegarde</Link>
        </div>
      )}
      {!tous && !s.energie && (
        <div className={alerte('info')}>
          Aucun relevé d'énergie enregistré. <Link href="/energie">Ajoutez le niveau de vos batteries</Link> pour suivre votre autonomie.
        </div>
      )}

      <div className={GRILLE_KPI}>
        <Kpi
          label="Encaissé aujourd'hui"
          valeur={argent(s.jour.encaisse, devise)}
          detail={`${s.jour.nb_depots} dépôt(s)${s.jour.mobile ? ` · dont ${argent(s.jour.mobile, devise)} Mobile Money` : ''}`}
          ton="accent"
        />
        {s.caisse && (
          <Kpi
            label="Espèces en caisse"
            valeur={argent(s.caisse.especes_attendues, devise)}
            detail={
              <Link href="/caisse">
                Ouverte {dateHeure(s.caisse.ouverte_le)}
                {s.caisse.ouverte_par_nom ? ` par ${s.caisse.ouverte_par_nom}` : ''}
              </Link>
            }
          />
        )}
        <Kpi label="En charge" valeur={s.en_charge} detail={`${s.prets} prêt(s) à retirer`} />
        <Kpi
          label="Emplacements libres"
          valeur={`${s.emplacements.libres} / ${s.emplacements.total}`}
          detail={s.emplacements.hors_service ? `${s.emplacements.hors_service} hors service` : 'Tous en service'}
          ton={s.emplacements.libres === 0 ? 'alerte' : undefined}
        />
        <Kpi
          label="Bénéfice du mois"
          valeur={argent(s.mois.benefice, devise)}
          detail={`${argent(s.mois.encaisse, devise)} − ${argent(s.mois.depenses, devise)} dépenses`}
          ton={s.mois.benefice >= 0 ? 'ok' : 'alerte'}
        />
        {s.impayes.nb > 0 && (
          <Kpi label="Impayés" valeur={argent(s.impayes.total, devise)} detail={`${s.impayes.nb} recharge(s)`} ton="alerte" />
        )}
      </div>

      {tous && <TableauSites sites={s.sites} devise={devise} />}

      <div className={GRILLE_2}>
        <div className={cx(CARTE, tous && 'lg:col-span-2')}>
          <div className={TETE}>
            <h2 className={TITRE_CARTE}>Prêts à retirer</h2>
            <Link href="/recharges" className={bouton('defaut', 'petit')}>
              Tout voir
            </Link>
          </div>
          {prets.isLoading ? (
            <Chargement />
          ) : !prets.data?.length ? (
            <Vide texte="Aucun téléphone en attente de retrait" />
          ) : (
            <ul className="m-0 list-none p-0 [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-2.5 [&>li]:border-b [&>li]:border-gris-pale [&>li]:py-2.5 [&>li:last-child]:border-b-0">
              {prets.data.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <div>
                    <div className="font-semibold">{r.client_nom}</div>
                    <div className="text-sm text-encre-3">
                      {tous && (
                        <>
                          <EtiquetteSite code={r.site_code} nom={r.site_nom} />{' '}
                        </>
                      )}
                      {r.appareil} · {r.emplacement_code ?? 'sans emplacement'} · prêt depuis {depuis(r.pret_le)}
                    </div>
                  </div>
                  <button className={bouton('vert', 'petit')} onClick={() => setRetrait(r)}>
                    Remettre
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!tous && (
          <div className={CARTE}>
            <div className={TETE}>
              <h2 className={TITRE_CARTE}>Batterie solaire</h2>
              <Link href="/energie" className={bouton('defaut', 'petit')}>
                Nouveau relevé
              </Link>
            </div>
            {s.energie ? (
              <>
                <Jauge niveau={s.energie.niveau_batterie} seuil={s.seuil_batterie} />
                <p className="mt-2 text-sm text-encre-3">
                  Dernier relevé : {dateHeure(s.energie.releve_le)}
                  {s.energie.tension ? ` · ${s.energie.tension} V` : ''}
                  {s.energie.production_wh ? ` · ${s.energie.production_wh} Wh produits` : ''}
                </p>
              </>
            ) : (
              <Vide texte="Pas encore de relevé" />
            )}

            <h3 className="mb-2.5 mt-5 font-semibold">Emplacements</h3>
            {empl.data ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-1.5">
                {empl.data.map((e) => (
                  <div
                    key={e.id}
                    title={e.client_nom ?? e.type_prise}
                    className={cx(
                      'rounded-lg px-1 py-2 text-center text-[0.82rem] font-bold',
                      e.statut === 'libre' && 'bg-vert-pale text-vert',
                      e.statut === 'occupe' && 'bg-bleu-pale text-bleu-texte',
                      e.statut === 'hors_service' && 'bg-danger-pale text-danger line-through'
                    )}
                  >
                    {e.code}
                  </div>
                ))}
              </div>
            ) : (
              <Chargement />
            )}
          </div>
        )}
      </div>

      <div className={cx(CARTE, 'mt-4')}>
        <div className={TETE}>
          <h2 className={TITRE_CARTE}>Encaissements des 7 derniers jours</h2>
          <span className="text-sm text-encre-3">
            Total :{' '}
            {argent(
              s.semaine.reduce((a, j) => a + Number(j.encaisse), 0),
              devise
            )}
          </span>
        </div>
        <div className="flex h-[170px] items-end gap-2 pt-6">
          {s.semaine.map((j) => {
            const d = new Date(j.jour + 'T12:00:00');
            const auj = j.jour === aujourdhui();
            return (
              <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" key={j.jour}>
                <div
                  className={cx(
                    'relative min-h-0.5 w-full max-w-[46px] rounded-t-md rounded-b-sm',
                    auj ? 'bg-primaire' : 'bg-primaire-bord'
                  )}
                  style={{ height: `${(Number(j.encaisse) / max) * 100}%` }}
                  title={`${j.nb} recharge(s)`}
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.72rem] tabular-nums text-encre-2">
                    {Number(j.encaisse) ? Number(j.encaisse).toLocaleString('fr-FR') : ''}
                  </span>
                </div>
                <span className={cx('whitespace-nowrap text-xs', auj ? 'font-semibold text-primaire-fort' : 'text-encre-3')}>
                  {JOURS[d.getDay()]} {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {retrait && <RetraitModal recharge={retrait} onClose={() => setRetrait(null)} />}
    </>
  );
}

/** Vue « Tous les sites » : une ligne par site, pour comparer d'un coup d'œil */
function TableauSites({ sites, devise }: { sites: ResumeSite[]; devise: string }) {
  return (
    <div className={cx(CARTE, 'mb-4')}>
      <h2 className={cx(TITRE_CARTE, 'mb-3')}>Sites aujourd'hui</h2>
      <Tableau>
        <thead>
          <tr>
            <th>Site</th>
            <th className="text-right">Encaissé</th>
            <th className="text-right">Dépôts</th>
            <th className="text-right">En charge</th>
            <th className="text-right">Prêts</th>
            <th className="text-right">Empl. libres</th>
            <th>Batterie</th>
            <th>Caisse</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((x) => (
            <tr key={x.id}>
              <td>
                <EtiquetteSite code={x.code} nom={x.nom} /> <span className="font-semibold">{x.nom}</span>
              </td>
              <td className="text-right font-semibold tabular-nums">{argent(x.encaisse_jour, devise)}</td>
              <td className="text-right tabular-nums">{x.depots_jour}</td>
              <td className="text-right tabular-nums">{x.en_charge}</td>
              <td className="text-right tabular-nums">{x.prets}</td>
              <td className={cx('text-right tabular-nums', x.emplacements_libres === 0 && 'font-semibold text-danger')}>
                {x.emplacements_libres} / {x.emplacements_total}
              </td>
              <td className="min-w-[150px]">
                {x.batterie === null ? (
                  <span className="text-sm text-encre-3">Pas de relevé</span>
                ) : (
                  <Jauge niveau={x.batterie} seuil={x.seuil_batterie} />
                )}
              </td>
              <td>
                <Badge statut={x.caisse_ouverte ? 'libre' : 'annule'} texte={x.caisse_ouverte ? 'Ouverte' : 'Fermée'} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="text-right tabular-nums">
              {argent(
                sites.reduce((a, x) => a + x.encaisse_jour, 0),
                devise
              )}
            </td>
            <td className="text-right tabular-nums">{sites.reduce((a, x) => a + x.depots_jour, 0)}</td>
            <td className="text-right tabular-nums">{sites.reduce((a, x) => a + x.en_charge, 0)}</td>
            <td className="text-right tabular-nums">{sites.reduce((a, x) => a + x.prets, 0)}</td>
            <td className="text-right tabular-nums">
              {sites.reduce((a, x) => a + x.emplacements_libres, 0)} / {sites.reduce((a, x) => a + x.emplacements_total, 0)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </Tableau>
    </div>
  );
}
