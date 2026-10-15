'use client';
import { useState } from 'react';
import { http } from '@/lib/http';
import { useAction, useApi, useMoi, useParametres, useSites } from '@/lib/hooks';
import { argent } from '@/lib/format';
import type { Tarif } from '@/lib/types';
import {
  ACTIONS,
  Alerte,
  Badge,
  bouton,
  boutonIcone,
  CARTE,
  CASE,
  Chargement,
  EnTete,
  Erreur,
  Field,
  FORM,
  LIGNE_FORM,
  lireForm,
  Modal,
  Tableau,
  Vide,
} from '@/components/ui';
import { Icone } from '@/components/Icone';
import { EtiquetteSite } from '@/components/Site';

const oui = (v: number | boolean | null | undefined) => !!Number(v);
const INVALIDE = ['/tarifs', '/journal'];

/**
 * Tarifs communs à tous les sites (administrateur) ;
 * sur un site, le gérant peut fixer un autre prix ou désactiver un tarif.
 */
export default function TarifsPage() {
  const { devise } = useParametres();
  const { data: moi } = useMoi();
  const { tous, siteActif } = useSites();
  const admin = moi?.role === 'admin';
  const liste = useApi<Tarif[]>('/tarifs');
  const [edition, setEdition] = useState<Tarif | 'nouveau' | null>(null);
  const [prixSite, setPrixSite] = useState<Tarif | null>(null);

  const enregistrer = useAction(
    (d: Record<string, unknown>) =>
      edition && edition !== 'nouveau'
        ? http.put(`/tarifs/${edition.id}`, d).then((r) => r.data)
        : http.post('/tarifs', d).then((r) => r.data),
    { invalide: INVALIDE, succes: 'Tarif enregistré', onSuccess: () => setEdition(null) }
  );
  const basculer = useAction(
    (t: Tarif) =>
      http
        .put(`/tarifs/${t.id}`, {
          libelle: t.libelle,
          description: t.description,
          prix: t.prix_commun,
          duree_minutes: t.duree_minutes,
          actif: !oui(t.actif_commun),
        })
        .then((r) => r.data),
    { invalide: INVALIDE, succes: 'Tarif mis à jour' }
  );
  const supprimer = useAction((id: number) => http.delete(`/tarifs/${id}`).then((r) => r.data), {
    invalide: INVALIDE,
    succes: 'Tarif supprimé',
  });
  const enregistrerSite = useAction(
    ({ id, ...d }: { id: number; prix: number | null; actif: boolean }) => http.put(`/tarifs/${id}/site`, d).then((r) => r.data),
    { invalide: INVALIDE, succes: 'Prix du site enregistré', onSuccess: () => setPrixSite(null) }
  );

  return (
    <>
      <EnTete
        titre="Tarifs"
        sousTitre={
          tous
            ? 'Prix communs à tous les sites. Chaque site peut avoir son propre prix ou désactiver un tarif.'
            : `Prix appliqués sur ${siteActif?.nom ?? 'ce site'}. Le prix commun s'applique sauf si le site a son propre prix.`
        }
      >
        {admin && (
          <button className={bouton('principal')} onClick={() => setEdition('nouveau')}>
            <Icone nom="plus" className="size-4" /> Nouveau tarif
          </button>
        )}
      </EnTete>

      {!admin && tous && <Alerte ton="info">Choisissez un site dans le menu pour modifier ses prix.</Alerte>}

      <div className={CARTE}>
        {liste.isLoading ? (
          <Chargement />
        ) : liste.error ? (
          <Erreur erreur={liste.error} />
        ) : !liste.data?.length ? (
          <Vide texte="Aucun tarif" />
        ) : (
          <Tableau>
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Durée</th>
                <th className="text-right">Prix commun</th>
                {!tous && <th className="text-right">Prix sur ce site</th>}
                {tous && <th>Prix propres aux sites</th>}
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.data.map((t) => {
                const actifIci = oui(t.actif);
                return (
                  <tr key={t.id} className={actifIci ? '' : 'opacity-55'}>
                    <td>
                      <div className="font-semibold">{t.libelle}</div>
                      {t.description && <div className="text-sm text-encre-3">{t.description}</div>}
                    </td>
                    <td>{t.duree_minutes ? `${t.duree_minutes} min` : "Jusqu'à charge complète"}</td>
                    <td className="text-right tabular-nums">{argent(t.prix_commun, devise)}</td>
                    {!tous && (
                      <td className="text-right tabular-nums">
                        {t.prix_site !== null ? (
                          <strong className="text-primaire-fort">{argent(t.prix_site, devise)}</strong>
                        ) : (
                          <span className="text-encre-3">prix commun</span>
                        )}
                      </td>
                    )}
                    {tous && (
                      <td>
                        {!t.exceptions?.length ? (
                          <span className="text-sm text-encre-3">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {t.exceptions.map((x) => (
                              <span key={x.site_id} className="inline-flex items-center gap-1 text-sm">
                                <EtiquetteSite code={x.site_code} nom={x.site_nom} />
                                {oui(x.actif) ? (
                                  x.prix !== null ? (
                                    argent(x.prix, devise)
                                  ) : (
                                    ''
                                  )
                                ) : (
                                  <span className="text-danger">désactivé</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                    <td>
                      {!oui(t.actif_commun) ? (
                        <Badge statut="retire" texte="Désactivé partout" />
                      ) : !oui(t.actif_site) ? (
                        <Badge statut="annule" texte="Désactivé sur ce site" />
                      ) : (
                        <Badge statut="libre" texte="Actif" />
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!tous && (
                          <button className={bouton('defaut', 'petit')} onClick={() => setPrixSite(t)}>
                            Prix sur ce site
                          </button>
                        )}
                        {admin && (
                          <>
                            <button className={bouton('defaut', 'petit')} onClick={() => basculer.mutate(t)}>
                              {oui(t.actif_commun) ? 'Désactiver partout' : 'Activer'}
                            </button>
                            <button className={boutonIcone} title="Modifier le tarif commun" onClick={() => setEdition(t)}>
                              <Icone nom="crayon" />
                            </button>
                            <button
                              className={boutonIcone}
                              title="Supprimer"
                              onClick={() => confirm(`Supprimer le tarif « ${t.libelle} » ?`) && supprimer.mutate(t.id)}
                            >
                              <Icone nom="poubelle" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tableau>
        )}
      </div>

      {edition && (
        <Modal
          titre={edition === 'nouveau' ? 'Nouveau tarif (tous les sites)' : 'Modifier le tarif commun'}
          onClose={() => setEdition(null)}
        >
          <form className={FORM} onSubmit={(e) => enregistrer.mutate(lireForm(e))}>
            <Field label="Libellé *">
              <input name="libelle" required maxLength={100} defaultValue={edition === 'nouveau' ? '' : edition.libelle} autoFocus />
            </Field>
            <Field label="Description">
              <input name="description" maxLength={255} defaultValue={edition === 'nouveau' ? '' : (edition.description ?? '')} />
            </Field>
            <div className={LIGNE_FORM}>
              <Field label={`Prix commun (${devise}) *`} aide="Appliqué sur tous les sites, sauf ceux qui ont leur propre prix">
                <input
                  name="prix"
                  type="number"
                  min={0}
                  step="any"
                  required
                  defaultValue={edition === 'nouveau' ? '' : edition.prix_commun}
                />
              </Field>
              <Field label="Durée (minutes)" aide="Vide = charge complète">
                <input
                  name="duree_minutes"
                  type="number"
                  min={1}
                  defaultValue={edition === 'nouveau' ? '' : (edition.duree_minutes ?? '')}
                />
              </Field>
            </div>
            <label className={CASE}>
              <input type="checkbox" name="actif" defaultChecked={edition === 'nouveau' ? true : oui(edition.actif_commun)} />
              Tarif actif
            </label>
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

      {prixSite && (
        <Modal titre={`${prixSite.libelle} sur ${siteActif?.nom ?? 'ce site'}`} onClose={() => setPrixSite(null)}>
          <form
            className={FORM}
            onSubmit={(e) => {
              const d = lireForm(e);
              enregistrerSite.mutate({ id: prixSite.id, prix: d.prix === '' ? null : Number(d.prix), actif: !!d.actif });
            }}
          >
            <p className="text-encre-2">
              Prix commun : <strong>{argent(prixSite.prix_commun, devise)}</strong>
            </p>
            <Field label={`Prix sur ce site (${devise})`} aide="Laisser vide pour appliquer le prix commun">
              <input name="prix" type="number" min={0} step="any" defaultValue={prixSite.prix_site ?? ''} autoFocus />
            </Field>
            <label className={CASE}>
              <input type="checkbox" name="actif" defaultChecked={oui(prixSite.actif_site)} />
              Proposer ce tarif sur ce site
            </label>
            <div className={ACTIONS}>
              <button type="button" className={bouton()} onClick={() => setPrixSite(null)}>
                Annuler
              </button>
              <button className={bouton('principal')} disabled={enregistrerSite.isPending}>
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
