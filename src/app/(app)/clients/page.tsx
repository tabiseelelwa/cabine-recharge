'use client';
import { useEffect, useState } from 'react';
import { http } from '@/lib/http';
import { useAction, useApi, useMoi, useParametres } from '@/lib/hooks';
import { argent, dateHeure } from '@/lib/format';
import type { Client, Recharge } from '@/lib/types';
import {
  ACTIONS,
  Badge,
  bouton,
  boutonIcone,
  CARTE,
  Chargement,
  CodeTicket,
  EnTete,
  Erreur,
  Field,
  FORM,
  LIGNE_FORM,
  lireForm,
  Modal,
  TABLE_WRAP,
  TABLEAU,
  TETE,
  TITRE_CARTE,
  Vide,
} from '@/components/ui';
import { Icone } from '@/components/Icone';
import { EtiquetteSite } from '@/components/Site';

export default function ClientsPage() {
  const { devise } = useParametres();
  const { data: moi } = useMoi();
  const [q, setQ] = useState('');
  const [qDiff, setQDiff] = useState('');
  const [edition, setEdition] = useState<Client | 'nouveau' | null>(null);
  const [historique, setHistorique] = useState<Client | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDiff(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const liste = useApi<Client[]>('/clients', { q: qDiff || undefined });

  const enregistrer = useAction(
    (d: Record<string, unknown>) =>
      edition && edition !== 'nouveau'
        ? http.put(`/clients/${edition.id}`, d).then((r) => r.data)
        : http.post('/clients', d).then((r) => r.data),
    { invalide: ['/clients', '/recharges'], succes: 'Client enregistré', onSuccess: () => setEdition(null) }
  );
  const supprimer = useAction((id: number) => http.delete(`/clients/${id}`).then((r) => r.data), {
    invalide: ['/clients'],
    succes: 'Client supprimé',
  });

  return (
    <>
      <EnTete titre="Clients" sousTitre="Les clients sont créés automatiquement lors d'un dépôt (reconnus par leur numéro)">
        <button className={bouton('principal')} onClick={() => setEdition('nouveau')}>
          <Icone nom="plus" className="size-4" /> Nouveau client
        </button>
      </EnTete>

      <div className={CARTE}>
        <div className={TETE}>
          <h2 className={TITRE_CARTE}>{liste.data ? `${liste.data.length} client(s)` : 'Clients'}</h2>
          <input className="w-auto min-w-[200px]" placeholder="Nom ou téléphone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {liste.isLoading ? (
          <Chargement />
        ) : liste.error ? (
          <Erreur erreur={liste.error} />
        ) : !liste.data?.length ? (
          <Vide texte="Aucun client" />
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLEAU}>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Téléphone</th>
                  <th className="text-right">Visites</th>
                  <th className="text-right">Total payé</th>
                  <th className="text-right">Doit</th>
                  <th>Dernière visite</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liste.data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-semibold">{c.nom}</div>
                      {c.notes && <div className="text-sm text-encre-3">{c.notes}</div>}
                    </td>
                    <td className="tabular-nums">{c.telephone}</td>
                    <td className="text-right tabular-nums">
                      {c.nb_recharges}
                      {c.nb_recharges >= 10 && <span title="Client fidèle"> ★</span>}
                    </td>
                    <td className="text-right tabular-nums">{argent(c.total_paye, devise)}</td>
                    <td className={`text-right tabular-nums ${Number(c.total_du) > 0 ? 'text-danger' : ''}`}>
                      {Number(c.total_du) > 0 ? argent(c.total_du, devise) : '—'}
                    </td>
                    <td className="tabular-nums">{dateHeure(c.derniere_visite, true)}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className={bouton('defaut', 'petit')} onClick={() => setHistorique(c)}>
                        Historique
                      </button>
                      <button className={boutonIcone} title="Modifier" onClick={() => setEdition(c)}>
                        <Icone nom="crayon" />
                      </button>
                      {moi?.role === 'admin' && c.nb_recharges === 0 && (
                        <button
                          className={boutonIcone}
                          title="Supprimer"
                          onClick={() => confirm(`Supprimer ${c.nom} ?`) && supprimer.mutate(c.id)}
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
        <Modal titre={edition === 'nouveau' ? 'Nouveau client' : `Modifier ${edition.nom}`} onClose={() => setEdition(null)}>
          <form className={FORM} onSubmit={(e) => enregistrer.mutate(lireForm(e))}>
            <div className={LIGNE_FORM}>
              <Field label="Nom *">
                <input name="nom" required defaultValue={edition === 'nouveau' ? '' : edition.nom} autoFocus />
              </Field>
              <Field label="Téléphone *">
                <input name="telephone" required inputMode="tel" defaultValue={edition === 'nouveau' ? '' : edition.telephone} />
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

      {historique && <Historique client={historique} onClose={() => setHistorique(null)} />}
    </>
  );
}

function Historique({ client, onClose }: { client: Client; onClose: () => void }) {
  const { devise } = useParametres();
  const h = useApi<Recharge[]>('/recharges', { client_id: client.id });
  return (
    <Modal titre={`Historique — ${client.nom}`} onClose={onClose} large>
      {h.isLoading ? (
        <Chargement />
      ) : !h.data?.length ? (
        <Vide texte="Aucune recharge" />
      ) : (
        <div className={TABLE_WRAP}>
          <table className={TABLEAU}>
            <thead>
              <tr>
                <th>Site</th>
                <th>Ticket</th>
                <th>Date</th>
                <th>Appareil</th>
                <th>Tarif</th>
                <th>Statut</th>
                <th className="text-right">Payé</th>
              </tr>
            </thead>
            <tbody>
              {h.data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <EtiquetteSite code={r.site_code} nom={r.site_nom} />
                  </td>
                  <td>
                    <CodeTicket code={r.ticket} />
                  </td>
                  <td className="tabular-nums">{dateHeure(r.depose_le, true)}</td>
                  <td>{r.appareil}</td>
                  <td>{r.tarif_libelle}</td>
                  <td>
                    <Badge statut={r.statut} />
                  </td>
                  <td className="text-right tabular-nums">
                    {argent(r.montant_paye, devise)} / {argent(r.montant, devise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
