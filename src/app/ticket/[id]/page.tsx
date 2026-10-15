'use client';
import { use, useEffect } from 'react';
import { useApi, useParametres } from '@/lib/hooks';
import { argent, dateHeure } from '@/lib/format';
import type { Recharge } from '@/lib/types';
import { Chargement, Erreur } from '@/components/ui';
import { Centre, Feuille58, Ligne, Separateur } from '@/components/Impression';

// Ticket imprimable (format imprimante thermique 58 mm)
export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const rec = useApi<Recharge>(`/recharges/${id}`);
  const { data: p, devise } = useParametres();

  useEffect(() => {
    if (rec.data && p) setTimeout(() => window.print(), 300);
  }, [rec.data, p]);

  if (rec.isLoading || !p) return <Chargement />;
  if (rec.error || !rec.data) return <Erreur erreur={rec.error} />;
  const r = rec.data;

  return (
    <Feuille58 titre={r.site_nom}>
      {p.nom_cabine && <Centre className="text-[11px]">{p.nom_cabine}</Centre>}
      {r.site_adresse && <Centre>{r.site_adresse}</Centre>}
      {r.site_telephone && <Centre>Tél : {r.site_telephone}</Centre>}
      <Separateur />
      <Centre>CODE DE RETRAIT</Centre>
      <div className="my-2 border-2 border-black py-1.5 text-center text-[26px] font-extrabold tracking-[0.18em]">{r.ticket}</div>
      <Ligne a="Client" b={r.client_nom} />
      <Ligne a="Tél." b={r.client_telephone} />
      <Ligne a="Appareil" b={r.appareil} />
      <Ligne a="Emplacement" b={r.emplacement_code ?? '—'} />
      <Ligne a="Déposé le" b={dateHeure(r.depose_le, true)} />
      <Separateur />
      <Ligne a={r.tarif_libelle} b={argent(r.montant, devise)} />
      <Ligne a="Payé" b={argent(r.montant_paye, devise)} />
      {Number(r.reste) > 0 && <Ligne a="RESTE À PAYER" b={argent(r.reste, devise)} fort />}
      <Separateur />
      <Centre className="text-[11px]">{r.site_message}</Centre>
      <Centre className="mt-1 text-[11px]">À retirer uniquement au site {r.site_code}</Centre>
      <Centre className="mt-1.5 text-[11px]">Merci ☀</Centre>
    </Feuille58>
  );
}
