'use client';
import { useState } from 'react';
import { http } from '@/lib/http';
import { useAction, useApi, useMoi, useSites } from '@/lib/hooks';
import { EtiquetteSite } from '@/components/Site';
import { depuis } from '@/lib/format';
import type { Emplacement } from '@/lib/types';
import {
  ACTIONS,
  Badge,
  bouton,
  boutonIcone,
  Chargement,
  cx,
  EnTete,
  Erreur,
  Field,
  FORM,
  LIGNE_FORM,
  lireForm,
  Modal,
  Vide,
} from '@/components/ui';
import { Icone } from '@/components/Icone';

const TYPES = ['USB-C', 'Micro-USB', 'Lightning (iPhone)', 'Universel', 'Prise secteur'];
const INVALIDE = ['/emplacements', '/stats'];

export default function EmplacementsPage() {
  const { data: moi } = useMoi();
  // Ajouter, modifier, supprimer : administrateur ou gérant du site
  const admin = moi?.role === 'admin' || moi?.role === 'gerant';
  const { tous } = useSites();
  const liste = useApi<Emplacement[]>('/emplacements', undefined, { refetchInterval: 30_000 });
  const [edition, setEdition] = useState<Emplacement | 'nouveau' | null>(null);

  const changerStatut = useAction(
    ({ e, statut }: { e: Emplacement; statut: string }) => http.put(`/emplacements/${e.id}`, { ...e, statut }).then((r) => r.data),
    { invalide: INVALIDE, succes: 'Statut mis à jour' }
  );
  const supprimer = useAction((id: number) => http.delete(`/emplacements/${id}`).then((r) => r.data), {
    invalide: INVALIDE,
    succes: 'Emplacement supprimé',
  });
  const enregistrer = useAction(
    (d: Record<string, unknown>) =>
      edition && edition !== 'nouveau'
        ? http.put(`/emplacements/${edition.id}`, d).then((r) => r.data)
        : http.post('/emplacements', d).then((r) => r.data),
    { invalide: INVALIDE, succes: 'Enregistré', onSuccess: () => setEdition(null) }
  );

  const d = liste.data ?? [];
  // Regroupe les emplacements par site (utile en vue « Tous les sites »)
  const groupes = d.reduce<{ code: string; nom: string; liste: Emplacement[] }[]>((acc, e) => {
    const g = acc.find((x) => x.code === e.site_code);
    if (g) g.liste.push(e);
    else acc.push({ code: e.site_code, nom: e.site_nom, liste: [e] });
    return acc;
  }, []);
  const compte = (s: string) => d.filter((e) => e.statut === s).length;

  return (
    <>
      <EnTete
        titre="Emplacements de charge"
        sousTitre={
          liste.data ? `${compte('libre')} libre(s) · ${compte('occupe')} occupé(s) · ${compte('hors_service')} hors service` : undefined
        }
      >
        {admin && !tous && (
          <button className={bouton('principal')} onClick={() => setEdition('nouveau')}>
            <Icone nom="plus" className="size-4" /> Ajouter un emplacement
          </button>
        )}
      </EnTete>

      {liste.isLoading ? (
        <Chargement />
      ) : liste.error ? (
        <Erreur erreur={liste.error} />
      ) : !d.length ? (
        <Vide texte="Aucun emplacement. Ajoutez vos ports de charge." />
      ) : (
        <div className="grid gap-6">
          {groupes.map((g) => (
            <section key={g.code}>
              {tous && (
                <h2 className="mb-2.5 flex items-center gap-2 text-lg font-semibold">
                  <EtiquetteSite code={g.code} nom={g.nom} /> {g.nom}
                </h2>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {g.liste.map((e) => (
                  <div
                    key={e.id}
                    className={cx(
                      'flex min-h-[118px] flex-col gap-1.5 rounded-xl border border-l-[5px] border-ligne bg-carte px-3.5 py-3 shadow-carte',
                      e.statut === 'libre' && 'border-l-vert',
                      e.statut === 'occupe' &&
                        (e.recharge_statut === 'pret' ? 'border-l-vert bg-vert-pale/40' : 'border-l-bleu bg-bleu-pale/40'),
                      e.statut === 'hors_service' && 'border-l-danger bg-danger-pale/50 opacity-85'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-extrabold tracking-wide">{e.code}</span>
                      <Badge statut={e.recharge_statut === 'pret' ? 'pret' : e.statut} />
                    </div>
                    <div className="text-xs text-bleu">{e.type_prise}</div>
                    {e.recharge_id ? (
                      <div className="text-sm">
                        <strong>{e.client_nom}</strong>
                        <br />
                        <span className="text-encre-3">{e.appareil}</span>
                        <br />
                        <span className="text-xs text-encre-3">depuis {depuis(e.depose_le)}</span>
                      </div>
                    ) : (
                      e.notes && <div className="text-sm text-encre-3">{e.notes}</div>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-1">
                      {e.statut === 'libre' && (
                        <button className={bouton('defaut', 'petit')} onClick={() => changerStatut.mutate({ e, statut: 'hors_service' })}>
                          Signaler panne
                        </button>
                      )}
                      {e.statut === 'hors_service' && (
                        <button className={bouton('defaut', 'petit')} onClick={() => changerStatut.mutate({ e, statut: 'libre' })}>
                          Remettre en service
                        </button>
                      )}
                      {admin && (
                        <>
                          <button className={boutonIcone} title="Modifier" onClick={() => setEdition(e)}>
                            <Icone nom="crayon" />
                          </button>
                          {!e.recharge_id && (
                            <button
                              className={boutonIcone}
                              title="Supprimer"
                              onClick={() => confirm(`Supprimer l'emplacement ${e.code} ?`) && supprimer.mutate(e.id)}
                            >
                              <Icone nom="poubelle" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {edition && (
        <Modal titre={edition === 'nouveau' ? 'Nouvel emplacement' : `Modifier ${edition.code}`} onClose={() => setEdition(null)}>
          <form
            className={FORM}
            onSubmit={(ev) => {
              const f = lireForm(ev);
              enregistrer.mutate(edition === 'nouveau' ? f : { ...f, statut: edition.statut });
            }}
          >
            <div className={LIGNE_FORM}>
              <Field label="Code *" aide="ex. P11">
                <input name="code" required maxLength={20} defaultValue={edition === 'nouveau' ? '' : edition.code} autoFocus />
              </Field>
              <Field label="Type de prise">
                <select name="type_prise" defaultValue={edition === 'nouveau' ? 'USB-C' : edition.type_prise}>
                  {[...new Set([...TYPES, ...(edition !== 'nouveau' ? [edition.type_prise] : [])])].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <input name="notes" defaultValue={edition === 'nouveau' ? '' : (edition.notes ?? '')} />
            </Field>
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
