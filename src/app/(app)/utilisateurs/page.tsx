'use client';
import { useState } from 'react';
import { http } from '@/lib/http';
import { useAction, useApi, useMoi, useSites } from '@/lib/hooks';
import { date, LIBELLE_ROLE } from '@/lib/format';
import type { Role, Utilisateur } from '@/lib/types';
import {
  ACTIONS,
  alerte,
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
  TABLE_WRAP,
  TABLEAU,
} from '@/components/ui';
import { Icone } from '@/components/Icone';

export default function UtilisateursPage() {
  const { data: moi } = useMoi();
  const liste = useApi<Utilisateur[]>('/utilisateurs');
  const [edition, setEdition] = useState<Utilisateur | 'nouveau' | null>(null);
  const [roleForm, setRoleForm] = useState<Role>('operateur');
  const { sites } = useSites();
  const ouvrir = (u: Utilisateur | 'nouveau') => {
    setRoleForm(u === 'nouveau' ? 'operateur' : u.role);
    setEdition(u);
  };
  const sitesDe = (u: Utilisateur | 'nouveau') => (u === 'nouveau' || !u.sites_ids ? [] : u.sites_ids.split(',').map(Number));

  const enregistrer = useAction(
    (d: Record<string, unknown>) =>
      edition && edition !== 'nouveau'
        ? http.put(`/utilisateurs/${edition.id}`, d).then((r) => r.data)
        : http.post('/utilisateurs', d).then((r) => r.data),
    { invalide: ['/utilisateurs'], succes: 'Utilisateur enregistré', onSuccess: () => setEdition(null) }
  );
  const supprimer = useAction((id: number) => http.delete(`/utilisateurs/${id}`).then((r) => r.data), {
    invalide: ['/utilisateurs'],
    succes: 'Utilisateur supprimé',
  });

  if (moi && moi.role !== 'admin') return <div className={alerte('erreur')}>Page réservée à l'administrateur.</div>;

  return (
    <>
      <EnTete
        titre="Utilisateurs"
        sousTitre="Opérateur : dépôts, retraits, caisse et relevés sur ses sites. Gérant : gère en plus ses sites (emplacements, prix, rapports, journal). Administrateur : tous les sites."
      >
        <button className={bouton('principal')} onClick={() => ouvrir('nouveau')}>
          <Icone nom="plus" className="size-4" /> Nouvel utilisateur
        </button>
      </EnTete>
      <div className={CARTE}>
        {liste.isLoading ? (
          <Chargement />
        ) : liste.error ? (
          <Erreur erreur={liste.error} />
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLEAU}>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Identifiant</th>
                  <th>Rôle</th>
                  <th>Sites</th>
                  <th>État</th>
                  <th>Créé le</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liste.data?.map((u) => (
                  <tr key={u.id} className={u.actif ? '' : 'opacity-55'}>
                    <td className="font-semibold">
                      {u.nom} {u.id === moi?.id && <span className="text-sm text-encre-3">(vous)</span>}
                    </td>
                    <td className="tabular-nums">{u.identifiant}</td>
                    <td>
                      <Badge statut={u.role} texte={LIBELLE_ROLE[u.role]} />
                    </td>
                    <td className="text-sm">
                      {u.role === 'admin' ? (
                        <span className="text-encre-3">Tous</span>
                      ) : (
                        u.sites_codes || <span className="text-danger">Aucun</span>
                      )}
                    </td>
                    <td>{u.actif ? 'Actif' : 'Désactivé'}</td>
                    <td className="tabular-nums">{date(u.cree_le)}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className={boutonIcone} title="Modifier" onClick={() => ouvrir(u)}>
                        <Icone nom="crayon" />
                      </button>
                      {u.id !== moi?.id && (
                        <button
                          className={boutonIcone}
                          title="Supprimer"
                          onClick={() => confirm(`Supprimer ${u.nom} ?`) && supprimer.mutate(u.id)}
                        >
                          <Icone nom="poubelle" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edition && (
        <Modal titre={edition === 'nouveau' ? 'Nouvel utilisateur' : `Modifier ${edition.nom}`} onClose={() => setEdition(null)}>
          <form
            className={FORM}
            onSubmit={(e) => {
              const d = lireForm(e);
              const choisis = sites.filter((x) => d[`site_${x.id}`]).map((x) => x.id);
              sites.forEach((x) => delete d[`site_${x.id}`]);
              enregistrer.mutate({ ...d, sites: choisis });
            }}
          >
            <div className={LIGNE_FORM}>
              <Field label="Nom complet *">
                <input name="nom" required defaultValue={edition === 'nouveau' ? '' : edition.nom} autoFocus />
              </Field>
              <Field label="Identifiant de connexion *">
                <input name="identifiant" required autoCapitalize="none" defaultValue={edition === 'nouveau' ? '' : edition.identifiant} />
              </Field>
            </div>
            <div className={LIGNE_FORM}>
              <Field label="Rôle">
                <select name="role" value={roleForm} onChange={(e) => setRoleForm(e.target.value as Role)}>
                  <option value="operateur">Opérateur</option>
                  <option value="gerant">Gérant</option>
                  <option value="admin">Administrateur (tous les sites)</option>
                </select>
              </Field>
              <Field
                label={edition === 'nouveau' ? 'Mot de passe *' : 'Nouveau mot de passe'}
                aide={edition === 'nouveau' ? '6 caractères minimum' : 'Laisser vide pour ne pas changer'}
              >
                <input name="mot_de_passe" type="password" minLength={6} required={edition === 'nouveau'} autoComplete="new-password" />
              </Field>
            </div>
            {roleForm !== 'admin' && (
              <fieldset className="grid gap-2 rounded-lg border border-ligne px-3.5 pb-3 pt-2">
                <legend className="px-1.5 text-sm font-semibold text-encre-2">Sites sur lesquels il travaille *</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {sites.map((x) => (
                    <label key={x.id} className={CASE}>
                      <input type="checkbox" name={`site_${x.id}`} defaultChecked={sitesDe(edition).includes(x.id)} />
                      {x.code} · {x.nom}
                      {!Number(x.actif) && <span className="text-xs text-encre-3">(désactivé)</span>}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {edition !== 'nouveau' && (
              <label className={CASE}>
                <input type="checkbox" name="actif" defaultChecked={!!edition.actif} />
                Compte actif (peut se connecter)
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
