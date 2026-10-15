'use client';
import { use, useEffect } from 'react';
import { useApi, useParametres } from '@/lib/hooks';
import { argent, dateHeure } from '@/lib/format';
import { MODES } from '@/lib/modes';
import type { DetailCaisse } from '@/lib/types';
import { Chargement, Erreur } from '@/components/ui';
import { Centre, Feuille58, Ligne, Separateur } from '@/components/Impression';

// Rapport de clôture de caisse imprimable (imprimante thermique 58 mm)
export default function CloturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const c = useApi<DetailCaisse>(`/caisse/${id}`);
  const { data: p, devise } = useParametres();

  useEffect(() => {
    if (c.data && p) setTimeout(() => window.print(), 300);
  }, [c.data, p]);

  if (c.isLoading || !p) return <Chargement />;
  if (c.error || !c.data) return <Erreur erreur={c.error} />;
  const d = c.data;
  const r = d.resume;

  return (
    <Feuille58 titre={d.site_nom}>
      {d.site_adresse && <Centre>{d.site_adresse}</Centre>}
      <Centre>
        CLÔTURE DE CAISSE N° {d.id} · {d.site_code}
      </Centre>
      <Separateur />
      <Ligne a="Ouverte" b={dateHeure(d.ouverte_le, true)} />
      <Ligne a="par" b={d.ouverte_par_nom ?? '—'} />
      <Ligne a="Fermée" b={d.fermee_le ? dateHeure(d.fermee_le, true) : 'EN COURS'} />
      {d.fermee_par_nom && <Ligne a="par" b={d.fermee_par_nom} />}
      <Separateur />
      {r.par_mode.map((m) => (
        <Ligne key={m.mode} a={`${MODES[m.mode]} (${m.nb})`} b={argent(m.net, devise)} />
      ))}
      <Ligne a="TOTAL ENCAISSÉ" b={argent(r.total_encaisse, devise)} fort />
      <Separateur />
      <Ligne a="Fond de caisse" b={argent(r.fond_initial, devise)} />
      <Ligne a="+ Espèces reçues" b={argent(r.especes_nettes, devise)} />
      <Ligne a="− Dépenses espèces" b={argent(r.depenses_especes, devise)} />
      <Ligne a="= Espèces attendues" b={argent(d.especes_attendues ?? r.especes_attendues, devise)} fort />
      {d.especes_comptees != null && (
        <>
          <Ligne a="Espèces comptées" b={argent(d.especes_comptees, devise)} />
          <Ligne
            a="ÉCART"
            b={Math.abs(Number(d.ecart)) < 0.005 ? 'JUSTE' : `${Number(d.ecart) > 0 ? '+' : ''}${argent(d.ecart, devise)}`}
            fort
          />
        </>
      )}
      {d.notes && <div className="mt-1">Note : {d.notes}</div>}
      {d.depenses.length > 0 && (
        <>
          <Separateur />
          <Centre>DÉPENSES PRISES DANS LA CAISSE</Centre>
          {d.depenses.map((x, i) => (
            <Ligne key={i} a={x.description.slice(0, 22)} b={argent(x.montant, devise)} />
          ))}
        </>
      )}
      <Separateur />
      <Centre>{d.paiements.length} opération(s)</Centre>
      <div className="mt-6">Signature caissier :</div>
      <div className="mt-7">Signature responsable :</div>
    </Feuille58>
  );
}
