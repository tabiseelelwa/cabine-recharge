'use client';
import { useState } from 'react';
import { http } from '@/lib/http';
import { useAction, useMoi, useSites } from '@/lib/hooks';
import type { Site } from '@/lib/types';
import {
  ACTIONS,
  alerte,
  Badge,
  bouton,
  boutonIcone,
  CARTE,
  CASE,
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
import { EtiquetteSite } from '@/components/Site';

const INVALIDE = ['/sites', '/stats', '/journal', '/emplacements'];

/** Points de recharge : création et réglages (administrateur), coordonnées de son site (gérant) */
export default function SitesPage() {
  const { data: moi } = useMoi();
  const admin = moi?.role === 'admin';
  const { sites, siteActif, changer, isLoading, error } = useSites();
  const [edition, setEdition] = useState<Site | 'nouveau' | null>(null);

  const enregistrer = useAction(
    (d: Record<string, unknown>) =>
      edition && edition !== 'nouveau'
        ? http.put(`/sites/${edition.id}`, d).then((r) => r.data)
        : http.post('/sites', d).then((r) => r.data),
    { invalide: INVALIDE, succes: 'Site enregistré', onSuccess: () => setEdition(null) }
  );
  const supprimer = useAction((id: number) => http.delete(`/sites/${id}`).then((r) => r.data), {
    invalide: INVALIDE,
    succes: 'Site supprimé',
  });

  if (moi && moi.role === 'operateur') return <div className={alerte('erreur')}>Page réservée à l'administrateur et aux gérants.</div>;

  return (
    <>
      <EnTete
        titre="Sites"
        sousTitre={
          admin
            ? 'Vos points de recharge. Chaque site a ses emplacements, sa caisse, ses relevés de batterie et ses opérateurs.'
            : 'Coordonnées et réglages de vos sites.'
        }
      >
        {admin && (
          <button className={bouton('principal')} onClick={() => setEdition('nouveau')}>
            <Icone nom="plus" className="size-4" /> Nouveau site
          </button>
        )}
      </EnTete>

      {isLoading ? (
        <Chargement />
      ) : error ? (
        <Erreur erreur={error} />
      ) : !sites.length ? (
        <Vide texte="Aucun site" />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {sites.map((s) => {
            const actif = !!Number(s.actif);
            const courant = siteActif?.id === s.id;
            return (
              <div key={s.id} className={cx(CARTE, 'flex flex-col gap-3', !actif && 'opacity-60', courant && 'ring-2 ring-primaire/40')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <EtiquetteSite code={s.code} nom={s.nom} />
                      {!actif && <Badge statut="retire" texte="Désactivé" />}
                      {courant && <Badge statut="admin" texte="Site actuel" />}
                    </div>
                    <h2 className="mt-1.5 truncate text-lg font-semibold">{s.nom}</h2>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button className={boutonIcone} title="Modifier" onClick={() => setEdition(s)}>
                      <Icone nom="crayon" />
                    </button>
                    {admin && (
                      <button
                        className={boutonIcone}
                        title="Supprimer"
                        onClick={() => confirm(`Supprimer le site ${s.code} · ${s.nom} ?`) && supprimer.mutate(s.id)}
                      >
                        <Icone nom="poubelle" />
                      </button>
                    )}
                  </div>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm [&_dt]:text-encre-3">
                  <dt>Adresse</dt>
                  <dd>{s.adresse || '—'}</dd>
                  <dt>Téléphone</dt>
                  <dd>{s.telephone || '—'}</dd>
                  <dt>Emplacements</dt>
                  <dd>{s.nb_emplacements ?? 0}</dd>
                  <dt>Personnel</dt>
                  <dd>{s.nb_utilisateurs ?? 0} gérant(s) / opérateur(s)</dd>
                  <dt>Alerte batterie</dt>
                  <dd>sous {s.seuil_batterie} %</dd>
                </dl>
                {actif && !courant && (
                  <button className={cx(bouton('defaut', 'petit'), 'mt-auto self-start')} onClick={() => changer(s.id)}>
                    <Icone nom="repere" className="size-4 text-bleu" /> Travailler sur ce site
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {edition && (
        <Modal
          titre={edition === 'nouveau' ? 'Nouveau site' : `Modifier ${edition.code} · ${edition.nom}`}
          onClose={() => setEdition(null)}
        >
          <form className={FORM} onSubmit={(e) => enregistrer.mutate(lireForm(e))}>
            <div className={LIGNE_FORM}>
              <Field label="Code *" aide="Court, ex. S02 ou KIN-1 : affiché partout">
                <input
                  name="code"
                  required
                  maxLength={10}
                  disabled={!admin}
                  className="uppercase"
                  defaultValue={edition === 'nouveau' ? `S${String(sites.length + 1).padStart(2, '0')}` : edition.code}
                />
              </Field>
              <Field label="Nom du site *">
                <input name="nom" required maxLength={100} defaultValue={edition === 'nouveau' ? '' : edition.nom} autoFocus />
              </Field>
            </div>
            <Field label="Adresse / repère">
              <input
                name="adresse"
                maxLength={255}
                defaultValue={edition === 'nouveau' ? '' : edition.adresse}
                placeholder="ex. Marché central, à côté de la pharmacie"
              />
            </Field>
            <div className={LIGNE_FORM}>
              <Field label="Téléphone du site" aide="Imprimé sur les tickets">
                <input name="telephone" inputMode="tel" maxLength={30} defaultValue={edition === 'nouveau' ? '' : edition.telephone} />
              </Field>
              <Field label="Alerte batterie (%)" aide="En dessous, une alerte s'affiche">
                <input
                  name="seuil_batterie"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={edition === 'nouveau' ? 25 : edition.seuil_batterie}
                />
              </Field>
            </div>
            <Field label="Message en bas du ticket">
              <textarea
                name="message_ticket"
                maxLength={500}
                defaultValue={
                  edition === 'nouveau' ? 'Conservez ce ticket. Le code est exigé pour récupérer votre téléphone.' : edition.message_ticket
                }
              />
            </Field>
            {edition === 'nouveau' ? (
              <Field label="Emplacements à créer" aide="Crée P01, P02… (vous pourrez préciser le type de prise ensuite)">
                <input name="nb_emplacements" type="number" min={0} max={200} defaultValue={10} />
              </Field>
            ) : (
              admin && (
                <label className={CASE}>
                  <input type="checkbox" name="actif" defaultChecked={!!Number(edition.actif)} />
                  Site actif (un site désactivé n'apparaît plus dans le choix des sites)
                </label>
              )
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
