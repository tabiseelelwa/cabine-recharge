'use client';
import { useState } from 'react';
import { http } from '@/lib/http';
import { useAction, useApi, useMoi, useParametres, useSites } from '@/lib/hooks';
import { ChoisirSite, EtiquetteSite } from '@/components/Site';
import { argent, aujourdhui, date, moisCourant } from '@/lib/format';
import type { Depense } from '@/lib/types';
import {
  ACTIONS,
  Badge,
  bouton,
  boutonIcone,
  CARTE,
  CASE,
  Chargement,
  EnTete,
  Erreur,
  Field,
  FILTRES,
  FORM,
  LIGNE_FORM,
  lireForm,
  Modal,
  TABLE_WRAP,
  TABLEAU,
  TETE,
  Vide,
} from '@/components/ui';
import { Icone } from '@/components/Icone';
import { MODES, type ModePaiement } from '@/lib/modes';
import { PastilleMode, useEtatCaisse, useModes } from '@/components/Paiement';

const CATEGORIES = ['Câbles & chargeurs', 'Entretien panneaux', 'Batteries', 'Salaire', 'Loyer / emplacement', 'Transport', 'Autre'];
const INVALIDE = ['/depenses', '/stats', '/rapports', '/caisse', '/journal'];

export default function DepensesPage() {
  const { devise } = useParametres();
  const { data: moi } = useMoi();
  // Modifier / supprimer : administrateur ou gérant du site
  const admin = moi?.role === 'admin' || moi?.role === 'gerant';
  const estAdmin = moi?.role === 'admin';
  const { tous, accessibles } = useSites();
  // En vue « Tous les sites », seul l'administrateur saisit (dépense générale ou pour un site précis)
  const peutAjouter = !tous || estAdmin;
  const [mois, setMois] = useState(moisCourant());
  const [edition, setEdition] = useState<Depense | 'nouveau' | null>(null);
  const liste = useApi<Depense[]>('/depenses', { mois: mois || undefined });
  const modes = useModes();
  const caisse = useEtatCaisse();
  const [modeForm, setModeForm] = useState<ModePaiement>('especes');

  const enregistrer = useAction(
    (d: Record<string, unknown>) =>
      edition && edition !== 'nouveau'
        ? http.put(`/depenses/${edition.id}`, d).then((r) => r.data)
        : http.post('/depenses', d).then((r) => r.data),
    { invalide: INVALIDE, succes: 'Dépense enregistrée', onSuccess: () => setEdition(null) }
  );
  const supprimer = useAction((id: number) => http.delete(`/depenses/${id}`).then((r) => r.data), {
    invalide: INVALIDE,
    succes: 'Dépense supprimée',
  });

  const total = (liste.data ?? []).reduce((a, d) => a + Number(d.montant), 0);
  const parCat = new Map<string, number>();
  (liste.data ?? []).forEach((d) => parCat.set(d.categorie, (parCat.get(d.categorie) ?? 0) + Number(d.montant)));

  return (
    <>
      <EnTete titre="Dépenses" sousTitre="Matériel, entretien, salaires… pour connaître votre vrai bénéfice">
        {peutAjouter && (
          <button
            className={bouton('principal')}
            onClick={() => {
              setModeForm('especes');
              setEdition('nouveau');
            }}
          >
            <Icone nom="plus" className="size-4" /> Nouvelle dépense
          </button>
        )}
      </EnTete>

      {!peutAjouter && <ChoisirSite pour="enregistrer une dépense" />}

      <div className={CARTE}>
        <div className={TETE}>
          <div className={FILTRES}>
            <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" />
            {mois && (
              <button className={bouton('defaut', 'petit')} onClick={() => setMois('')}>
                Tous les mois
              </button>
            )}
          </div>
          <div className="font-semibold">Total : {argent(total, devise)}</div>
        </div>
        {parCat.size > 0 && (
          <div className={`${FILTRES} mb-3.5`}>
            {[...parCat.entries()].map(([c, m]) => (
              <Badge key={c} statut="retire" texte={`${c} : ${argent(m, devise)}`} />
            ))}
          </div>
        )}
        {liste.isLoading ? (
          <Chargement />
        ) : liste.error ? (
          <Erreur erreur={liste.error} />
        ) : !liste.data?.length ? (
          <Vide texte="Aucune dépense sur cette période" />
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLEAU}>
              <thead>
                <tr>
                  {tous && <th>Site</th>}
                  <th>Date</th>
                  <th>Catégorie</th>
                  <th>Description</th>
                  <th>Payé en</th>
                  <th>Saisi par</th>
                  <th className="text-right">Montant</th>
                  {admin && <th />}
                </tr>
              </thead>
              <tbody>
                {liste.data.map((d) => (
                  <tr key={d.id}>
                    {tous && (
                      <td>
                        <EtiquetteSite code={d.site_code} nom={d.site_nom} />
                      </td>
                    )}
                    <td className="tabular-nums">{date(d.date_depense)}</td>
                    <td>{d.categorie}</td>
                    <td>{d.description}</td>
                    <td>
                      <PastilleMode mode={d.mode} />
                      {d.caisse_id && <div className="text-sm text-encre-3">caisse n° {d.caisse_id}</div>}
                    </td>
                    <td className="text-encre-3">{d.operateur_nom ?? '—'}</td>
                    <td className="text-right font-semibold tabular-nums">{argent(d.montant, devise)}</td>
                    {admin && (
                      <td className="whitespace-nowrap text-right">
                        <button
                          className={boutonIcone}
                          title="Modifier"
                          onClick={() => {
                            setModeForm(d.mode);
                            setEdition(d);
                          }}
                        >
                          <Icone nom="crayon" />
                        </button>
                        <button
                          className={boutonIcone}
                          title="Supprimer"
                          onClick={() => confirm('Supprimer cette dépense ?') && supprimer.mutate(d.id)}
                        >
                          <Icone nom="poubelle" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edition && (
        <Modal titre={edition === 'nouveau' ? 'Nouvelle dépense' : 'Modifier la dépense'} onClose={() => setEdition(null)}>
          <form className={FORM} onSubmit={(e) => enregistrer.mutate(lireForm(e))}>
            {edition === 'nouveau' && tous && estAdmin && (
              <Field
                label="Pour quel site ?"
                aide="« Dépense générale » : salaires du siège, achats groupés… comptée dans le total, pas dans un site"
              >
                <select name="site_id" defaultValue="">
                  <option value="">Dépense générale (aucun site)</option>
                  {accessibles.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} · {x.nom}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className={LIGNE_FORM}>
              <Field label="Date *">
                <input
                  name="date_depense"
                  type="date"
                  required
                  defaultValue={edition === 'nouveau' ? aujourdhui() : edition.date_depense.slice(0, 10)}
                />
              </Field>
              <Field label="Catégorie *">
                <select name="categorie" defaultValue={edition === 'nouveau' ? CATEGORIES[0] : edition.categorie}>
                  {[...new Set([...CATEGORIES, ...(edition !== 'nouveau' ? [edition.categorie] : [])])].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description *">
              <input
                name="description"
                required
                maxLength={255}
                defaultValue={edition === 'nouveau' ? '' : edition.description}
                autoFocus
              />
            </Field>
            <Field label={`Montant (${devise}) *`}>
              <input name="montant" type="number" min={0} step="any" required defaultValue={edition === 'nouveau' ? '' : edition.montant} />
            </Field>
            <Field label="Payée en">
              <select name="mode" value={modeForm} onChange={(e) => setModeForm(e.target.value as ModePaiement)}>
                {[...new Set([...modes, modeForm])].map((m) => (
                  <option key={m} value={m}>
                    {MODES[m]}
                  </option>
                ))}
              </select>
            </Field>
            {edition === 'nouveau' && modeForm === 'especes' && caisse.ouverte && (
              <label className={CASE}>
                <input type="checkbox" name="depuis_caisse" defaultChecked />
                Argent pris dans la caisse (sera déduit des espèces attendues à la clôture)
              </label>
            )}
            <div className={ACTIONS}>
              <button type="button" className={bouton()} onClick={() => setEdition(null)}>
                Annuler
              </button>
              <button className={bouton('principal')} disabled={enregistrer.isPending}>
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
