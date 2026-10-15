'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { http } from '@/lib/http';
import { useAction, useApi, useMoi, useParametres, useSites } from '@/lib/hooks';
import { ChoisirSite, EtiquetteSite } from '@/components/Site';
import { argent, dateHeure, depuis } from '@/lib/format';
import type { Recharge } from '@/lib/types';
import {
  Badge,
  bouton,
  boutonIcone,
  CARTE,
  Chargement,
  CodeTicket,
  cx,
  EnTete,
  Erreur,
  FILTRES,
  TABLE_WRAP,
  TABLEAU,
  TETE,
  Vide,
} from '@/components/ui';
import { Icone } from '@/components/Icone';
import { AnnulerModal, DepotModal, imprimerTicket, INVALIDE, PaiementModal, RetraitModal } from '@/components/RechargeActions';
import { PastillesModes } from '@/components/Paiement';

const ONGLETS = [
  { cle: 'actifs', label: 'En cours' },
  { cle: 'en_charge', label: 'En charge' },
  { cle: 'pret', label: 'Prêts' },
  { cle: 'retire', label: 'Retirés' },
  { cle: 'annule', label: 'Annulés' },
  { cle: '', label: 'Tous' },
];

function Contenu() {
  const router = useRouter();
  const sp = useSearchParams();
  const { devise } = useParametres();
  const { data: moi } = useMoi();
  const { tous, siteActif } = useSites();
  const [onglet, setOnglet] = useState('actifs');
  const [q, setQ] = useState('');
  const [qDiff, setQDiff] = useState('');
  const [date, setDate] = useState('');
  const [depot, setDepot] = useState(false);
  const [retrait, setRetrait] = useState<Recharge | null>(null);
  const [paiement, setPaiement] = useState<Recharge | null>(null);
  const [annulation, setAnnulation] = useState<Recharge | null>(null);

  useEffect(() => {
    if (sp.get('nouveau') === '1') {
      setDepot(true);
      router.replace('/recharges');
    }
  }, [sp, router]);

  // Recherche différée pour ne pas interroger le serveur à chaque touche
  useEffect(() => {
    const t = setTimeout(() => setQDiff(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const liste = useApi<Recharge[]>(
    '/recharges',
    { statut: onglet || undefined, q: qDiff || undefined, date: date || undefined },
    { refetchInterval: 30_000 }
  );
  const actifs = useApi<Recharge[]>('/recharges', { statut: 'actifs' });
  const nbPrets = actifs.data?.filter((r) => r.statut === 'pret').length ?? 0;

  const action = useAction(({ id, ...data }: { id: number; action: string }) => http.patch(`/recharges/${id}`, data).then((r) => r.data), {
    invalide: INVALIDE,
    succes: 'Mis à jour',
  });
  const supprimer = useAction((id: number) => http.delete(`/recharges/${id}`).then((r) => r.data), {
    invalide: INVALIDE,
    succes: 'Supprimé',
  });

  return (
    <>
      <EnTete
        titre="Dépôts & retraits"
        sousTitre={
          siteActif
            ? `${siteActif.nom} : enregistrez les téléphones déposés, suivez la charge et remettez-les avec le code du ticket`
            : 'Téléphones de tous les sites'
        }
      >
        {!tous && (
          <button className={bouton('principal')} onClick={() => setDepot(true)}>
            <Icone nom="plus" className="size-4" /> Nouveau dépôt
          </button>
        )}
      </EnTete>

      {tous && <ChoisirSite pour="enregistrer un dépôt" />}

      <div className={CARTE}>
        <div className={TETE}>
          <div className="flex flex-wrap gap-1 rounded-lg bg-gris-pale p-1" role="tablist">
            {ONGLETS.map((o) => (
              <button
                key={o.cle}
                role="tab"
                aria-selected={onglet === o.cle}
                onClick={() => setOnglet(o.cle)}
                className={cx(
                  'rounded-md px-3.5 py-1.5 font-medium transition-colors',
                  onglet === o.cle ? 'bg-carte text-encre shadow-sm' : 'text-encre-2 hover:text-encre'
                )}
              >
                {o.label}
                {o.cle === 'pret' && nbPrets > 0 && (
                  <span className="ml-1.5 inline-block rounded-full bg-primaire px-1.5 text-xs font-bold text-white">{nbPrets}</span>
                )}
              </button>
            ))}
          </div>
          <div className={FILTRES}>
            <input className="w-auto" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date de dépôt" />
            <input
              className="w-auto min-w-[200px]"
              placeholder="Ticket, nom, téléphone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {liste.isLoading ? (
          <Chargement />
        ) : liste.error ? (
          <Erreur erreur={liste.error} />
        ) : !liste.data?.length ? (
          <Vide texte="Aucune recharge pour ces critères" />
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLEAU}>
              <thead>
                <tr>
                  {tous && <th>Site</th>}
                  <th>Ticket</th>
                  <th>Client</th>
                  <th>Appareil</th>
                  <th>Empl.</th>
                  <th>Déposé</th>
                  <th>Statut</th>
                  <th className="text-right">Montant</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liste.data.map((r) => (
                  <tr key={r.id}>
                    {tous && (
                      <td>
                        <EtiquetteSite code={r.site_code} nom={r.site_nom} />
                      </td>
                    )}
                    <td>
                      <CodeTicket code={r.ticket} />
                    </td>
                    <td>
                      <div className="font-semibold">{r.client_nom}</div>
                      <div className="text-sm text-encre-3">{r.client_telephone}</div>
                    </td>
                    <td>
                      {r.appareil}
                      {r.batterie_depot != null && <div className="text-sm text-encre-3">{r.batterie_depot} % au dépôt</div>}
                      {r.notes && <div className="text-sm text-encre-3">Note : {r.notes}</div>}
                    </td>
                    <td>{r.emplacement_code ?? '—'}</td>
                    <td className="tabular-nums">
                      {dateHeure(r.depose_le)}
                      {['en_charge', 'pret'].includes(r.statut) && <div className="text-sm text-encre-3">il y a {depuis(r.depose_le)}</div>}
                    </td>
                    <td>
                      <Badge statut={r.statut} />
                    </td>
                    <td className="text-right tabular-nums">
                      {argent(r.montant, devise)}
                      {Number(r.reste) > 0 && r.statut !== 'annule' && (
                        <div className="text-sm text-danger">reste {argent(r.reste, devise)}</div>
                      )}
                      <div>
                        <PastillesModes modes={r.modes_paiement} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.statut === 'en_charge' && (
                          <button
                            className={bouton('defaut', 'petit')}
                            onClick={() => action.mutate({ id: r.id, action: 'pret' })}
                            disabled={action.isPending}
                          >
                            <Icone nom="valider" className="size-4" /> Chargé
                          </button>
                        )}
                        {['en_charge', 'pret'].includes(r.statut) && (
                          <button className={bouton('vert', 'petit')} onClick={() => setRetrait(r)}>
                            Remettre
                          </button>
                        )}
                        {Number(r.reste) > 0 && r.statut !== 'annule' && (
                          <button className={bouton('defaut', 'petit')} onClick={() => setPaiement(r)}>
                            Payer
                          </button>
                        )}
                        <button className={boutonIcone} title="Imprimer le ticket" onClick={() => imprimerTicket(r.id)}>
                          <Icone nom="imprimer" />
                        </button>
                        {['en_charge', 'pret'].includes(r.statut) && (
                          <button className={boutonIcone} title="Annuler le dépôt" onClick={() => setAnnulation(r)}>
                            <Icone nom="interdit" />
                          </button>
                        )}
                        {moi?.role === 'admin' && (
                          <button
                            className={boutonIcone}
                            title="Supprimer définitivement"
                            onClick={() => confirm(`Supprimer définitivement la recharge ${r.ticket} ?`) && supprimer.mutate(r.id)}
                          >
                            <Icone nom="poubelle" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {depot && !tous && <DepotModal onClose={() => setDepot(false)} />}
      {retrait && <RetraitModal recharge={retrait} onClose={() => setRetrait(null)} />}
      {paiement && <PaiementModal recharge={paiement} onClose={() => setPaiement(null)} />}
      {annulation && <AnnulerModal recharge={annulation} onClose={() => setAnnulation(null)} />}
    </>
  );
}

export default function RechargesPage() {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu />
    </Suspense>
  );
}
