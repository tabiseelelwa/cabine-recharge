'use client';
import { useState } from 'react';
import { post, useAction, useApi, useParametres } from '@/lib/hooks';
import { argent, dateHeure } from '@/lib/format';
import type { EtatCaisse } from '@/lib/types';
import { ChoisirSite, EtiquetteSite } from '@/components/Site';
import {
  ACTIONS,
  alerte,
  Badge,
  bouton,
  boutonIcone,
  CARTE,
  Chargement,
  EnTete,
  Erreur,
  Field,
  FORM,
  GRILLE_2,
  GRILLE_KPI,
  Kpi,
  lireForm,
  TABLE_WRAP,
  TABLEAU,
  TETE,
  TITRE_CARTE,
  Vide,
} from '@/components/ui';
import { PastilleMode } from '@/components/Paiement';
import { Icone } from '@/components/Icone';

const INVALIDE = ['/caisse', '/stats', '/journal'];
const imprimerCloture = (id: number) => window.open(`/cloture/${id}`, '_blank', 'width=420,height=700');

function Ecart({ valeur, devise }: { valeur: number; devise: string }) {
  if (Math.abs(valeur) < 0.005) return <span className="whitespace-nowrap font-bold text-vert">Juste ✓</span>;
  return (
    <span className={`whitespace-nowrap font-bold ${valeur < 0 ? 'text-danger' : 'text-bleu'}`}>
      {valeur < 0 ? 'Manque ' : 'Surplus +'}
      {argent(Math.abs(valeur), devise)}
    </span>
  );
}

export default function CaissePage() {
  const { devise } = useParametres();
  const etat = useApi<EtatCaisse>('/caisse', undefined, { refetchInterval: 20_000 });
  const [comptees, setComptees] = useState('');
  const [cle, setCle] = useState(0);
  const [cloturee, setCloturee] = useState<number | null>(null);

  const ouvrir = useAction(post('/caisse'), { invalide: INVALIDE, succes: 'Caisse ouverte. Bonne journée !' });
  const fermer = useAction(post<{ id: number; ecart: number }>('/caisse'), {
    invalide: INVALIDE,
    succes: (r) =>
      Math.abs(r.ecart) < 0.005 ? 'Caisse clôturée : le compte est juste' : `Caisse clôturée avec un écart de ${argent(r.ecart, devise)}`,
    onSuccess: (r) => {
      setComptees('');
      setCle((k) => k + 1);
      setCloturee(r.id);
    },
  });

  if (etat.isLoading) return <Chargement />;
  if (etat.error) return <Erreur erreur={etat.error} />;
  const { ouverte, historique, sites } = etat.data!;
  const tous = etat.data!.actif === null;
  const derniere = historique[0];

  return (
    <>
      <EnTete
        titre="Caisse"
        sousTitre="Ouvrez la caisse le matin avec le fond de caisse, clôturez-la le soir en comptant les espèces : l'application calcule l'écart."
      />

      {cloturee && (
        <div className={`${alerte('ok')} flex flex-wrap items-center justify-between gap-2.5`}>
          Caisse clôturée.
          <button className={bouton('defaut', 'petit')} onClick={() => imprimerCloture(cloturee)}>
            <Icone nom="imprimer" className="size-4" /> Imprimer le rapport de clôture
          </button>
        </div>
      )}

      {tous ? (
        <>
          <ChoisirSite pour="ouvrir ou clôturer une caisse" />
          <div className={CARTE}>
            <h2 className={`${TITRE_CARTE} mb-3`}>Caisse de chaque site</h2>
            <div className={TABLE_WRAP}>
              <table className={TABLEAU}>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>État</th>
                    <th>Ouverte le</th>
                    <th className="text-right">Espèces attendues</th>
                    <th className="text-right">Mobile Money</th>
                    <th className="text-right">Total encaissé</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((x) => (
                    <tr key={x.id}>
                      <td>
                        <EtiquetteSite code={x.code} nom={x.nom} /> <span className="font-semibold">{x.nom}</span>
                      </td>
                      <td>
                        <Badge statut={x.caisse ? 'libre' : 'annule'} texte={x.caisse ? 'Ouverte' : 'Fermée'} />
                      </td>
                      <td className="tabular-nums">
                        {x.caisse ? `${dateHeure(x.caisse.ouverte_le)} · ${x.caisse.ouverte_par_nom ?? '—'}` : '—'}
                      </td>
                      <td className="text-right font-semibold tabular-nums">
                        {x.caisse ? argent(x.caisse.resume.especes_attendues, devise) : '—'}
                      </td>
                      <td className="text-right tabular-nums">{x.caisse ? argent(x.caisse.resume.total_mobile, devise) : '—'}</td>
                      <td className="text-right tabular-nums">{x.caisse ? argent(x.caisse.resume.total_encaisse, devise) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : !ouverte ? (
        <div className={CARTE}>
          <div className={TETE}>
            <h2 className={TITRE_CARTE}>La caisse est fermée</h2>
            <Badge statut="annule" texte="Fermée" />
          </div>
          <form
            key={cle}
            className={`${FORM} max-w-[420px]`}
            onSubmit={(e) => {
              setCloturee(null);
              ouvrir.mutate({ action: 'ouvrir', ...lireForm(e) });
            }}
          >
            <Field
              label={`Fond de caisse (${devise})`}
              aide={
                derniere
                  ? `Espèces comptées à la dernière clôture : ${argent(derniere.especes_comptees, devise)}`
                  : 'Monnaie présente dans la caisse au départ'
              }
            >
              <input
                name="fond_initial"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                defaultValue={derniere?.especes_comptees ?? 0}
                autoFocus
              />
            </Field>
            <div className={`${ACTIONS} justify-start`}>
              <button className={bouton('principal')} disabled={ouvrir.isPending}>
                Ouvrir la caisse
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className={alerte('ok')}>
            Caisse ouverte le {dateHeure(ouverte.ouverte_le)} par <strong>{ouverte.ouverte_par_nom ?? '—'}</strong>
          </div>
          <div className={GRILLE_KPI}>
            <Kpi label="Fond de caisse" valeur={argent(ouverte.resume.fond_initial, devise)} />
            <Kpi label="Espèces reçues" valeur={argent(ouverte.resume.especes_nettes, devise)} />
            <Kpi
              label="Dépenses en espèces"
              valeur={argent(ouverte.resume.depenses_especes, devise)}
              detail={`${ouverte.resume.nb_depenses} dépense(s) prise(s) dans la caisse`}
            />
            <Kpi
              label="Espèces attendues"
              valeur={argent(ouverte.resume.especes_attendues, devise)}
              ton="accent"
              detail="Fond + reçues − dépenses"
            />
            <Kpi label="Mobile Money" valeur={argent(ouverte.resume.total_mobile, devise)} detail="Sur les comptes, pas dans la caisse" />
          </div>

          <div className={GRILLE_2}>
            <div className={CARTE}>
              <h2 className="mb-3 text-lg font-semibold">Encaissements par mode</h2>
              {!ouverte.resume.par_mode.length ? (
                <Vide texte="Aucun encaissement depuis l'ouverture" />
              ) : (
                <table className={TABLEAU}>
                  <thead>
                    <tr>
                      <th>Mode</th>
                      <th className="text-right">Opérations</th>
                      <th className="text-right">Reçu</th>
                      <th className="text-right">Remboursé</th>
                      <th className="text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ouverte.resume.par_mode.map((m) => (
                      <tr key={m.mode}>
                        <td>
                          <PastilleMode mode={m.mode} />
                        </td>
                        <td className="text-right tabular-nums">{m.nb}</td>
                        <td className="text-right tabular-nums">{argent(m.recu, devise)}</td>
                        <td className="text-right tabular-nums">{m.rembourse ? argent(m.rembourse, devise) : '—'}</td>
                        <td className="text-right font-semibold tabular-nums">{argent(m.net, devise)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Total encaissé</td>
                      <td className="text-right tabular-nums">{argent(ouverte.resume.total_encaisse, devise)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className={CARTE}>
              <h2 className="mb-1 text-lg font-semibold">Clôturer la caisse</h2>
              <p className="mb-3 text-sm text-encre-3">Comptez les billets et pièces présents dans la caisse, puis saisissez le total.</p>
              <form
                key={cle}
                className={FORM}
                onSubmit={(e) => {
                  const d = lireForm(e);
                  const ecart = Number(d.especes_comptees) - ouverte.resume.especes_attendues;
                  const msg =
                    Math.abs(ecart) < 0.005
                      ? 'Clôturer la caisse ? Le compte est juste.'
                      : `Clôturer avec un ${ecart < 0 ? 'MANQUE' : 'SURPLUS'} de ${argent(Math.abs(ecart), devise)} ?\nCet écart sera enregistré et visible par l'administrateur.`;
                  if (confirm(msg)) fermer.mutate({ action: 'fermer', ...d });
                }}
              >
                <Field label={`Espèces comptées (${devise}) *`}>
                  <input
                    name="especes_comptees"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    required
                    value={comptees}
                    onChange={(e) => setComptees(e.target.value)}
                    className="min-h-[52px] text-[1.4rem] font-bold"
                  />
                </Field>
                {comptees !== '' && (
                  <div className="rounded-lg border border-ligne bg-survol px-3 py-2.5">
                    Attendu {argent(ouverte.resume.especes_attendues, devise)} →{' '}
                    <Ecart valeur={Number(comptees) - ouverte.resume.especes_attendues} devise={devise} />
                  </div>
                )}
                <Field label="Commentaire" aide="Obligatoire en cas d'écart : expliquez la raison si vous la connaissez">
                  <input
                    name="notes"
                    maxLength={255}
                    required={comptees !== '' && Math.abs(Number(comptees) - ouverte.resume.especes_attendues) >= 0.005}
                  />
                </Field>
                <div className={ACTIONS}>
                  <button className={bouton('bleu')} disabled={fermer.isPending}>
                    Clôturer la caisse
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      <div className={`${CARTE} mt-4`}>
        <h2 className="mb-3 text-lg font-semibold">Historique des clôtures</h2>
        {!historique.length ? (
          <Vide texte="Aucune clôture pour l'instant" />
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLEAU}>
              <thead>
                <tr>
                  {tous && <th>Site</th>}
                  <th>Ouverte</th>
                  <th>Fermée</th>
                  <th className="text-right">Attendu</th>
                  <th className="text-right">Compté</th>
                  <th>Écart</th>
                  <th>Par</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {historique.map((c) => (
                  <tr key={c.id}>
                    {tous && (
                      <td>
                        <EtiquetteSite code={c.site_code} nom={c.site_nom} />
                      </td>
                    )}
                    <td className="tabular-nums">{dateHeure(c.ouverte_le, true)}</td>
                    <td className="tabular-nums">{dateHeure(c.fermee_le, true)}</td>
                    <td className="text-right tabular-nums">{argent(c.especes_attendues, devise)}</td>
                    <td className="text-right tabular-nums">{argent(c.especes_comptees, devise)}</td>
                    <td>
                      <Ecart valeur={Number(c.ecart)} devise={devise} />
                      {c.notes && <div className="text-sm text-encre-3">{c.notes}</div>}
                    </td>
                    <td className="text-encre-3">{c.fermee_par_nom ?? '—'}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className={boutonIcone} title="Imprimer le rapport de clôture" onClick={() => imprimerCloture(c.id)}>
                        <Icone nom="imprimer" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
