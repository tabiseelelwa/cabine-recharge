'use client';
import { useState } from 'react';
import { http } from '@/lib/http';
import { post, useAction, useApi, useMoi, useSites } from '@/lib/hooks';
import { ChoisirSite, EtiquetteSite } from '@/components/Site';
import { dateHeure } from '@/lib/format';
import type { Releve } from '@/lib/types';
import {
  ACTIONS,
  alerte,
  bouton,
  boutonIcone,
  CARTE,
  Chargement,
  EnTete,
  Erreur,
  Field,
  FORM,
  GRILLE_2,
  Jauge,
  LIGNE_FORM,
  lireForm,
  TABLE_WRAP,
  TABLEAU,
  TETE,
  TITRE_CARTE,
  Vide,
} from '@/components/ui';
import { Icone } from '@/components/Icone';

const METEO: Record<string, string> = { ensoleille: '☀ Ensoleillé', nuageux: '⛅ Nuageux', pluvieux: '🌧 Pluvieux' };

export default function EnergiePage() {
  const { siteActif, tous } = useSites();
  const { data: moi } = useMoi();
  // Seuil d'alerte propre à chaque site
  const seuil = Number(siteActif?.seuil_batterie ?? 25);
  const [jours, setJours] = useState(7);
  const liste = useApi<Releve[]>('/energie', { jours });
  const [cle, setCle] = useState(0); // remet le formulaire à zéro

  const ajouter = useAction(post('/energie'), {
    invalide: ['/energie', '/stats'],
    succes: 'Relevé enregistré',
    onSuccess: () => setCle((k) => k + 1),
  });
  const supprimer = useAction((id: number) => http.delete(`/energie/${id}`).then((r) => r.data), {
    invalide: ['/energie', '/stats'],
    succes: 'Relevé supprimé',
  });

  const releves = liste.data ?? [];
  const dernier = releves[0];
  const chrono = [...releves].reverse();

  return (
    <>
      <EnTete
        titre="Énergie solaire"
        sousTitre="Notez régulièrement le niveau de vos batteries lithium (matin, midi, soir) pour anticiper les coupures"
      />

      {tous && <ChoisirSite pour="noter un relevé ou voir la courbe d'un site" />}

      {!tous && (
        <div className={GRILLE_2}>
          <div className={CARTE}>
            <h2 className="mb-3.5 text-lg font-semibold">Nouveau relevé</h2>
            <form key={cle} className={FORM} onSubmit={(e) => ajouter.mutate(lireForm(e))}>
              <Field label="Niveau de charge des batteries (%) *" aide="Lu sur l'afficheur du régulateur / BMS">
                <input name="niveau_batterie" type="number" min={0} max={100} required inputMode="numeric" />
              </Field>
              <div className={LIGNE_FORM}>
                <Field label="Tension (V)">
                  <input name="tension" type="number" step="0.01" min={0} placeholder="ex. 25.6" />
                </Field>
                <Field label="Production du jour (Wh)">
                  <input name="production_wh" type="number" min={0} />
                </Field>
              </div>
              <Field label="Météo">
                <select name="meteo" defaultValue="">
                  <option value="">—</option>
                  {Object.entries(METEO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notes">
                <input name="notes" placeholder="ex. panneaux nettoyés, onduleur coupé…" />
              </Field>
              <div className={ACTIONS}>
                <button className={bouton('principal')} disabled={ajouter.isPending}>
                  Enregistrer le relevé
                </button>
              </div>
            </form>
          </div>

          <div className={CARTE}>
            <div className={TETE}>
              <h2 className={TITRE_CARTE}>État actuel</h2>
              <select value={jours} onChange={(e) => setJours(Number(e.target.value))} className="w-auto" aria-label="Période">
                <option value={1}>24 heures</option>
                <option value={7}>7 jours</option>
                <option value={30}>30 jours</option>
              </select>
            </div>
            {dernier ? (
              <>
                <Jauge niveau={dernier.niveau_batterie} seuil={seuil} />
                <p className="mb-3 mt-2 text-sm text-encre-3">
                  {dateHeure(dernier.releve_le)} {dernier.meteo && `· ${METEO[dernier.meteo]}`}
                </p>
                {dernier.niveau_batterie <= seuil && (
                  <div className={alerte('erreur')}>Sous le seuil d'alerte ({seuil} %). Réduisez la charge jusqu'au retour du soleil.</div>
                )}
                {chrono.length > 1 && <Courbe releves={chrono} seuil={seuil} />}
              </>
            ) : (
              <Vide texte="Aucun relevé sur la période" />
            )}
          </div>
        </div>
      )}

      <div className={`${CARTE} mt-4`}>
        <h2 className="mb-3 text-lg font-semibold">Historique</h2>
        {liste.isLoading ? (
          <Chargement />
        ) : liste.error ? (
          <Erreur erreur={liste.error} />
        ) : !releves.length ? (
          <Vide texte="Aucun relevé" />
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLEAU}>
              <thead>
                <tr>
                  {tous && <th>Site</th>}
                  <th>Date</th>
                  <th className="text-right">Batterie</th>
                  <th className="text-right">Tension</th>
                  <th className="text-right">Production</th>
                  <th>Météo</th>
                  <th>Notes</th>
                  <th>Par</th>
                  {moi?.role === 'admin' && <th />}
                </tr>
              </thead>
              <tbody>
                {releves.map((r) => (
                  <tr key={r.id}>
                    {tous && (
                      <td>
                        <EtiquetteSite code={r.site_code} nom={r.site_nom} />
                      </td>
                    )}
                    <td className="tabular-nums">{dateHeure(r.releve_le, true)}</td>
                    <td className={`text-right font-semibold tabular-nums ${r.niveau_batterie <= r.seuil_batterie ? 'text-danger' : ''}`}>
                      {r.niveau_batterie} %
                    </td>
                    <td className="text-right tabular-nums">{r.tension != null ? `${r.tension} V` : '—'}</td>
                    <td className="text-right tabular-nums">{r.production_wh != null ? `${r.production_wh} Wh` : '—'}</td>
                    <td>{r.meteo ? METEO[r.meteo] : '—'}</td>
                    <td className="text-encre-3">{r.notes ?? ''}</td>
                    <td className="text-encre-3">{r.operateur_nom ?? '—'}</td>
                    {moi?.role === 'admin' && (
                      <td className="whitespace-nowrap text-right">
                        <button
                          className={boutonIcone}
                          title="Supprimer"
                          onClick={() => confirm('Supprimer ce relevé ?') && supprimer.mutate(r.id)}
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
    </>
  );
}

/** Petite courbe SVG du niveau de batterie */
function Courbe({ releves, seuil }: { releves: Releve[]; seuil: number }) {
  const L = 320,
    H = 120,
    m = 4;
  const x = (i: number) => m + (i / (releves.length - 1)) * (L - 2 * m);
  const y = (v: number) => H - m - (v / 100) * (H - 2 * m);
  const pts = releves.map((r, i) => `${x(i)},${y(r.niveau_batterie)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="mt-2 h-[140px] w-full" role="img" aria-label="Évolution du niveau de batterie">
      <line x1={m} x2={L - m} y1={y(seuil)} y2={y(seuil)} stroke="var(--danger)" strokeDasharray="4 4" strokeWidth={1} />
      <text x={L - m} y={y(seuil) - 4} textAnchor="end" fontSize="9" fill="var(--danger)">
        seuil {seuil} %
      </text>
      <polyline points={`${m},${H - m} ${pts} ${L - m},${H - m}`} fill="var(--bleu-pale)" stroke="none" />
      <polyline points={pts} fill="none" stroke="var(--bleu)" strokeWidth={2} strokeLinejoin="round" />
      {releves.map((r, i) => (
        <circle key={r.id} cx={x(i)} cy={y(r.niveau_batterie)} r={2.5} fill="var(--bleu)">
          <title>{`${dateHeure(r.releve_le)} : ${r.niveau_batterie} %`}</title>
        </circle>
      ))}
    </svg>
  );
}
