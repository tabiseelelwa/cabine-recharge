'use client';
import { useState } from 'react';
import { useApi, useParametres, useSites } from '@/lib/hooks';
import { EtiquetteSite } from '@/components/Site';
import { argent, aujourdhui, date, dateHeure } from '@/lib/format';
import { MODES } from '@/lib/modes';
import type { Rapport } from '@/lib/types';
import { bouton, CARTE, Chargement, EnTete, Erreur, FILTRES, GRILLE_2, GRILLE_KPI, Kpi, TABLE_WRAP, TABLEAU, Vide } from '@/components/ui';
import { Icone } from '@/components/Icone';

function debutMois() {
  return aujourdhui().slice(0, 8) + '01';
}
function ilYa(jours: number) {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RapportsPage() {
  const { devise } = useParametres();
  const { tous, siteActif } = useSites();
  const portee = tous ? 'Tous les sites' : (siteActif?.nom ?? '');
  const [du, setDu] = useState(debutMois());
  const [au, setAu] = useState(aujourdhui());
  const r = useApi<Rapport>('/rapports', { du, au }, { enabled: !!du && !!au });

  function exporterCSV() {
    if (!r.data) return;
    const lignes = [
      ['Jour', 'Recharges', `Encaissé (${devise})`, `dont Mobile Money (${devise})`, `Dépenses (${devise})`, `Solde (${devise})`],
      ...r.data.par_jour.map((j) => [j.jour, j.nb, j.encaisse, j.mobile, j.depenses, j.encaisse - j.depenses]),
      [],
      ['Total', r.data.totaux.nb_recharges, r.data.totaux.encaisse, '', r.data.totaux.depenses, r.data.totaux.benefice],
      [],
      ['Mode de paiement', 'Opérations', `Reçu (${devise})`, `Remboursé (${devise})`, `Net (${devise})`],
      ...r.data.par_mode.map((m) => [MODES[m.mode] ?? m.mode, m.nb, m.recu, m.rembourse, m.net]),
      [],
      ['Clôture de caisse', 'Site', `Attendu (${devise})`, `Compté (${devise})`, `Écart (${devise})`, 'Commentaire'],
      ...r.data.caisses.map((c) => [c.fermee_le, c.site_code, c.especes_attendues, c.especes_comptees, c.ecart, c.notes ?? '']),
      [],
      ['Site', 'Recharges', `Encaissé (${devise})`, `Dépenses (${devise})`, `Bénéfice (${devise})`],
      ...r.data.par_site.map((x) => [`${x.code} · ${x.nom}`, x.nb, x.encaisse, x.depenses, x.benefice]),
      ...(r.data.depenses_generales ? [['Dépenses générales', '', '', r.data.depenses_generales, -r.data.depenses_generales]] : []),
    ];
    const csv = '﻿' + lignes.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `rapport_${tous ? 'tous-sites' : (siteActif?.code ?? 'site')}_${du}_${au}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const t = r.data?.totaux;

  return (
    <>
      <EnTete titre="Rapports" sousTitre={`${portee} : recettes, dépenses et bénéfice sur la période choisie`}>
        <button className={bouton()} onClick={exporterCSV} disabled={!r.data}>
          <Icone nom="telecharger" className="size-4" /> Exporter (Excel/CSV)
        </button>
        <button className={bouton()} onClick={() => window.print()} disabled={!r.data}>
          <Icone nom="imprimer" className="size-4" /> Imprimer
        </button>
      </EnTete>

      <div className={`${CARTE} mb-4`}>
        <div className={FILTRES}>
          <label className={FILTRES}>
            Du <input type="date" value={du} max={au} onChange={(e) => setDu(e.target.value)} />
          </label>
          <label className={FILTRES}>
            au <input type="date" value={au} min={du} onChange={(e) => setAu(e.target.value)} />
          </label>
          <button className={bouton('defaut', 'petit')} onClick={() => (setDu(aujourdhui()), setAu(aujourdhui()))}>
            Aujourd'hui
          </button>
          <button className={bouton('defaut', 'petit')} onClick={() => (setDu(ilYa(6)), setAu(aujourdhui()))}>
            7 jours
          </button>
          <button className={bouton('defaut', 'petit')} onClick={() => (setDu(debutMois()), setAu(aujourdhui()))}>
            Ce mois
          </button>
        </div>
      </div>

      {r.isLoading ? (
        <Chargement />
      ) : r.error ? (
        <Erreur erreur={r.error} />
      ) : t ? (
        <>
          <div className={GRILLE_KPI}>
            <Kpi label="Recharges" valeur={t.nb_recharges} detail={`${t.nb_clients} client(s) · ${t.annulees} annulée(s)`} />
            <Kpi
              label="Encaissé"
              valeur={argent(t.encaisse, devise)}
              ton="accent"
              detail={t.impaye > 0 ? `${argent(t.impaye, devise)} non payé` : 'Tout est payé'}
            />
            <Kpi label="Dépenses" valeur={argent(t.depenses, devise)} />
            <Kpi label="Bénéfice" valeur={argent(t.benefice, devise)} ton={t.benefice >= 0 ? 'ok' : 'alerte'} />
            {r.data!.caisses.length > 0 && (
              <Kpi
                label="Écarts de caisse"
                valeur={argent(t.ecarts_caisse, devise)}
                detail={`${r.data!.caisses.length} clôture(s)`}
                ton={t.ecarts_caisse < 0 ? 'alerte' : undefined}
              />
            )}
          </div>

          {tous && r.data!.par_site.length > 0 && (
            <div className={`${CARTE} mb-4`}>
              <h2 className="mb-3 text-lg font-semibold">Comparaison des sites</h2>
              <div className={TABLE_WRAP}>
                <table className={TABLEAU}>
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th className="text-right">Recharges</th>
                      <th className="text-right">Encaissé</th>
                      <th className="text-right">Dépenses du site</th>
                      <th className="text-right">Bénéfice</th>
                      <th className="w-1/4">Part de l'encaissé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.data!.par_site.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <EtiquetteSite code={x.code} nom={x.nom} /> <span className="font-semibold">{x.nom}</span>
                        </td>
                        <td className="text-right tabular-nums">{x.nb}</td>
                        <td className="text-right tabular-nums">{argent(x.encaisse, devise)}</td>
                        <td className="text-right tabular-nums">{argent(x.depenses, devise)}</td>
                        <td className={`text-right font-semibold tabular-nums ${x.benefice < 0 ? 'text-danger' : 'text-vert'}`}>
                          {argent(x.benefice, devise)}
                        </td>
                        <td>
                          <div className="h-2 overflow-hidden rounded bg-gris-pale">
                            <div
                              className="h-full rounded bg-primaire"
                              style={{ width: `${t.encaisse > 0 ? Math.max(0, (x.encaisse / t.encaisse) * 100) : 0}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {r.data!.depenses_generales > 0 && (
                      <tr>
                        <td className="text-encre-2">Dépenses générales (siège)</td>
                        <td />
                        <td />
                        <td className="text-right tabular-nums">{argent(r.data!.depenses_generales, devise)}</td>
                        <td className="text-right font-semibold tabular-nums text-danger">{argent(-r.data!.depenses_generales, devise)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className={`${CARTE} mb-4`}>
            <h2 className="mb-3 text-lg font-semibold">Par jour</h2>
            {!r.data!.par_jour.length ? (
              <Vide texte="Aucune activité" />
            ) : (
              <div className={TABLE_WRAP}>
                <table className={TABLEAU}>
                  <thead>
                    <tr>
                      <th>Jour</th>
                      <th className="text-right">Rech.</th>
                      <th className="text-right">Encaissé</th>
                      <th className="text-right">dont Mobile</th>
                      <th className="text-right">Dépenses</th>
                      <th className="text-right">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.data!.par_jour.map((j) => (
                      <tr key={j.jour}>
                        <td className="tabular-nums">{date(j.jour)}</td>
                        <td className="text-right tabular-nums">{j.nb}</td>
                        <td className="text-right tabular-nums">{argent(j.encaisse, devise)}</td>
                        <td className="text-right tabular-nums text-encre-3">{j.mobile ? argent(j.mobile, devise) : '—'}</td>
                        <td className="text-right tabular-nums">{j.depenses ? argent(j.depenses, devise) : '—'}</td>
                        <td className={`text-right font-semibold tabular-nums ${j.encaisse - j.depenses < 0 ? 'text-danger' : ''}`}>
                          {argent(j.encaisse - j.depenses, devise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="text-right tabular-nums">{t.nb_recharges}</td>
                      <td className="text-right tabular-nums">{argent(t.encaisse, devise)}</td>
                      <td />
                      <td className="text-right tabular-nums">{argent(t.depenses, devise)}</td>
                      <td className="text-right tabular-nums">{argent(t.benefice, devise)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className={GRILLE_2}>
            <div className={CARTE}>
              <h2 className="mb-3 text-lg font-semibold">Par mode de paiement</h2>
              <Repartition
                lignes={r.data!.par_mode.map((x) => ({ nom: MODES[x.mode] ?? x.mode, nb: x.nb, valeur: Number(x.net) }))}
                devise={devise}
              />
            </div>
            <div className={CARTE}>
              <h2 className="mb-3 text-lg font-semibold">Par tarif</h2>
              <Repartition
                lignes={r.data!.par_tarif.map((x) => ({ nom: x.libelle, nb: x.nb, valeur: Number(x.encaisse) }))}
                devise={devise}
              />
            </div>
            <div className={CARTE}>
              <h2 className="mb-3 text-lg font-semibold">Par opérateur</h2>
              <Repartition
                lignes={r.data!.par_operateur.map((x) => ({ nom: x.nom, nb: x.nb, valeur: Number(x.encaisse) }))}
                devise={devise}
              />
            </div>
            <div className={CARTE}>
              <h2 className="mb-3 text-lg font-semibold">Dépenses par catégorie</h2>
              <Repartition lignes={r.data!.par_categorie.map((x) => ({ nom: x.categorie, valeur: Number(x.total) }))} devise={devise} />
            </div>
          </div>

          {r.data!.caisses.length > 0 && (
            <div className={`${CARTE} mt-4`}>
              <h2 className="mb-3 text-lg font-semibold">Clôtures de caisse</h2>
              <div className={TABLE_WRAP}>
                <table className={TABLEAU}>
                  <thead>
                    <tr>
                      {tous && <th>Site</th>}
                      <th>Fermée le</th>
                      <th>Par</th>
                      <th className="text-right">Attendu</th>
                      <th className="text-right">Compté</th>
                      <th className="text-right">Écart</th>
                      <th>Commentaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.data!.caisses.map((c) => (
                      <tr key={c.id}>
                        {tous && (
                          <td>
                            <EtiquetteSite code={c.site_code} nom={c.site_nom} />
                          </td>
                        )}
                        <td className="tabular-nums">{dateHeure(c.fermee_le, true)}</td>
                        <td>{c.fermee_par_nom ?? '—'}</td>
                        <td className="text-right tabular-nums">{argent(c.especes_attendues, devise)}</td>
                        <td className="text-right tabular-nums">{argent(c.especes_comptees, devise)}</td>
                        <td
                          className={`text-right font-semibold tabular-nums ${Number(c.ecart) < 0 ? 'text-danger' : Number(c.ecart) > 0 ? 'text-bleu' : 'text-vert'}`}
                        >
                          {Number(c.ecart) > 0 ? '+' : ''}
                          {argent(c.ecart, devise)}
                        </td>
                        <td className="text-encre-3">{c.notes ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}

function Repartition({ lignes, devise }: { lignes: { nom: string; nb?: number; valeur: number }[]; devise: string }) {
  if (!lignes.length) return <Vide texte="Rien sur la période" />;
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <div className="grid gap-2.5">
      {lignes.map((l) => (
        <div key={l.nom}>
          <div className="flex justify-between text-[0.9rem]">
            <span>
              {l.nom} {l.nb != null && <span className="text-encre-3">({l.nb})</span>}
            </span>
            <span className="font-semibold tabular-nums">{argent(l.valeur, devise)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-gris-pale">
            <div className="h-full rounded bg-primaire" style={{ width: `${Math.max(0, (l.valeur / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
