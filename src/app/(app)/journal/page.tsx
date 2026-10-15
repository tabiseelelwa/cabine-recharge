'use client';
import { useEffect, useState } from 'react';
import { useApi, useMoi } from '@/lib/hooks';
import { dateHeure } from '@/lib/format';
import { EtiquetteSite } from '@/components/Site';
import type { LigneJournal, Utilisateur } from '@/lib/types';
import { alerte, bouton, CARTE, CASE, Chargement, EnTete, Erreur, FILTRES, TABLE_WRAP, TABLEAU, Vide } from '@/components/ui';

const ACTIONS: Record<string, string> = {
  connexion: 'Connexion',
  deconnexion: 'Déconnexion',
  echec_connexion: 'Échec de connexion',
  mot_de_passe: 'Mot de passe changé',
  depot: 'Dépôt',
  pret: 'Marqué chargé',
  paiement: 'Paiement',
  retrait: 'Retrait',
  annulation: 'Annulation',
  code_incorrect: 'Code ticket incorrect',
  notes: 'Notes',
  creation: 'Création',
  modification: 'Modification',
  suppression: 'Suppression',
  panne: 'Panne signalée',
  remise_service: 'Remis en service',
  ouverture: 'Ouverture',
  cloture: 'Clôture',
  sauvegarde: 'Sauvegarde',
  telechargement: 'Téléchargement',
  restauration: 'Restauration',
  prix_site: 'Prix du site',
};

const ENTITES: Record<string, string> = {
  recharge: 'Recharges',
  caisse: 'Caisse',
  depense: 'Dépenses',
  client: 'Clients',
  emplacement: 'Emplacements',
  tarif: 'Tarifs',
  releve: 'Énergie',
  utilisateur: 'Utilisateurs & connexions',
  parametres: 'Paramètres',
  sauvegarde: 'Sauvegardes',
  site: 'Sites',
};

// Actions à surveiller (fraude, erreurs, pertes d'argent)
const SENSIBLES = new Set(['suppression', 'annulation', 'echec_connexion', 'code_incorrect', 'restauration']);

// Lignes sensibles en rouge, mouvements d'argent repérés par un trait bleu à gauche
const STYLE_LIGNE: Record<string, string> = {
  sensible: '[&>td]:bg-danger-pale [&>td:first-child]:shadow-[inset_4px_0_0_var(--danger)]',
  argent: '[&>td:first-child]:shadow-[inset_4px_0_0_var(--bleu)]',
  '': '',
};

function ton(l: LigneJournal) {
  if (SENSIBLES.has(l.action) || l.details?.includes('SANS payer') || (l.action === 'cloture' && /écart -\d/.test(l.details ?? '')))
    return 'sensible';
  if (['paiement', 'depot', 'retrait', 'ouverture', 'cloture'].includes(l.action)) return 'argent';
  return '';
}

export default function JournalPage() {
  const { data: moi } = useMoi();
  const utilisateurs = useApi<Utilisateur[]>('/utilisateurs', undefined, { enabled: !!moi && moi.role !== 'operateur' });
  const [filtres, setFiltres] = useState({ du: '', au: '', utilisateur_id: '', entite: '', sensibles: false });
  const [q, setQ] = useState('');
  const [qDiff, setQDiff] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setQDiff(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [filtres, qDiff]);

  const params = {
    du: filtres.du || undefined,
    au: filtres.au || undefined,
    utilisateur_id: filtres.utilisateur_id || undefined,
    entite: filtres.entite || undefined,
    sensibles: filtres.sensibles ? 1 : undefined,
    q: qDiff || undefined,
    page,
  };
  const journal = useApi<{ lignes: LigneJournal[]; page: number; suivante: boolean }>('/journal', params, {
    enabled: !!moi && moi.role !== 'operateur',
  });
  const maj = (k: keyof typeof filtres, v: string | boolean) => setFiltres((f) => ({ ...f, [k]: v }));

  if (moi && moi.role === 'operateur') return <div className={alerte('erreur')}>Page réservée à l'administrateur et aux gérants.</div>;

  return (
    <>
      <EnTete
        titre="Journal d'activité"
        sousTitre="Toutes les opérations : qui, quoi, quand. Les lignes en rouge méritent votre attention."
      />

      <div className={CARTE}>
        <div className={`${FILTRES} mb-3.5`}>
          <input type="date" value={filtres.du} onChange={(e) => maj('du', e.target.value)} aria-label="Du" />
          <input type="date" value={filtres.au} onChange={(e) => maj('au', e.target.value)} aria-label="Au" />
          <select value={filtres.utilisateur_id} onChange={(e) => maj('utilisateur_id', e.target.value)} aria-label="Utilisateur">
            <option value="">Tous les utilisateurs</option>
            {utilisateurs.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nom}
              </option>
            ))}
          </select>
          <select value={filtres.entite} onChange={(e) => maj('entite', e.target.value)} aria-label="Domaine">
            <option value="">Tous les domaines</option>
            {Object.entries(ENTITES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input className="w-auto min-w-[200px]" placeholder="Ticket, nom, montant…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className={CASE}>
            <input type="checkbox" checked={filtres.sensibles} onChange={(e) => maj('sensibles', e.target.checked)} />
            Seulement les actions sensibles
          </label>
        </div>

        {journal.isLoading ? (
          <Chargement />
        ) : journal.error ? (
          <Erreur erreur={journal.error} />
        ) : !journal.data?.lignes.length ? (
          <Vide texte="Aucune activité pour ces critères" />
        ) : (
          <>
            <div className={TABLE_WRAP}>
              <table className={TABLEAU}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Site</th>
                    <th>Utilisateur</th>
                    <th>Action</th>
                    <th>Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.data.lignes.map((l) => (
                    <tr key={l.id} className={STYLE_LIGNE[ton(l)]}>
                      <td className="whitespace-nowrap tabular-nums">{dateHeure(l.cree_le, true)}</td>
                      <td>
                        <EtiquetteSite code={l.site_code} />
                      </td>
                      <td>
                        {l.utilisateur_nom ?? <span className="text-encre-3">—</span>}
                        {l.ip && <div className="text-sm text-encre-3">{l.ip}</div>}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="font-semibold">{ACTIONS[l.action] ?? l.action}</span>
                        <div className="text-sm text-encre-3">{ENTITES[l.entite] ?? l.entite}</div>
                      </td>
                      <td className="min-w-[260px] text-[0.88rem] text-encre-2">{l.details ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button className={bouton('defaut', 'petit')} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Plus récent
              </button>
              <span className="text-sm text-encre-3">Page {page}</span>
              <button className={bouton('defaut', 'petit')} disabled={!journal.data.suivante} onClick={() => setPage((p) => p + 1)}>
                Plus ancien →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
