'use client';
import { useState } from 'react';
import { http } from '@/lib/http';
import { useAction, useApi, useMoi, useParametres } from '@/lib/hooks';
import { argent, dateHeure } from '@/lib/format';
import { MODES } from '@/lib/modes';
import type { Client, Emplacement, Recharge, Tarif } from '@/lib/types';
import { ACTIONS, alerte, bouton, CASE, Field, FORM, LIGNE_FORM, lireForm, Modal } from './ui';
import { Icone } from './Icone';
import { AlerteCaisseFermee, BlocPaiement, ChoixPaiement, PAIEMENT_DEFAUT, useEtatCaisse, type ValeurPaiement } from './Paiement';

// Récapitulatif « libellé : valeur » sur deux colonnes
const RECAP = 'my-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-left text-[0.93rem] [&_dd]:font-medium [&_dt]:text-encre-3';

const INVALIDE = ['/recharges', '/stats', '/emplacements', '/clients', '/caisse', '/rapports', '/journal'];

function imprimerTicket(id: number) {
  window.open(`/ticket/${id}`, '_blank', 'width=420,height=640');
}

const corpsPaiement = (p: ValeurPaiement) => ({ mode: p.mode, reference: p.reference.trim() || null });

/* ================= Nouveau dépôt ================= */
export function DepotModal({ onClose }: { onClose: () => void }) {
  const { devise } = useParametres();
  const caisse = useEtatCaisse();
  const tarifs = useApi<Tarif[]>('/tarifs', { actifs: 1 });
  const empl = useApi<Emplacement[]>('/emplacements');
  const [tel, setTel] = useState('');
  const [nom, setNom] = useState('');
  const [tarifId, setTarifId] = useState('');
  const [payeChoisi, setPayeChoisi] = useState<boolean | null>(null);
  const [paiement, setPaiement] = useState<ValeurPaiement>(PAIEMENT_DEFAUT);
  const [cree, setCree] = useState<Recharge | null>(null);

  // Par défaut on encaisse au dépôt, sauf si la caisse est fermée
  const payeMaintenant = payeChoisi ?? !caisse.bloque;

  // Recherche du client par numéro pour pré-remplir le nom
  const suggestions = useApi<Client[]>('/clients', { q: tel }, { enabled: tel.replace(/\D/g, '').length >= 4 });
  const clientConnu = suggestions.data?.find((c) => c.telephone === tel.replace(/\s+/g, ''));

  const tarif = tarifs.data?.find((t) => String(t.id) === tarifId) ?? tarifs.data?.[0];
  const libres = empl.data?.filter((e) => e.statut === 'libre') ?? [];

  const creer = useAction((data: unknown) => http.post<Recharge>('/recharges', data).then((r) => r.data), {
    invalide: INVALIDE,
    succes: (r) => `Dépôt enregistré : ticket ${r.ticket}`,
    onSuccess: setCree,
  });

  if (cree) return <TicketConfirme recharge={cree} onClose={onClose} />;

  return (
    <Modal titre="Nouveau dépôt de téléphone" onClose={onClose}>
      <form
        className={FORM}
        onSubmit={(e) => {
          const d = lireForm(e);
          creer.mutate({
            ...d,
            tarif_id: tarif?.id,
            montant_paye: payeMaintenant ? (tarif?.prix ?? 0) : 0,
            mode_paiement: paiement.mode,
            reference_paiement: paiement.reference.trim() || null,
          });
        }}
      >
        <div className={LIGNE_FORM}>
          <Field label="Téléphone du client *" aide={clientConnu ? `Client connu · ${clientConnu.nb_recharges} visite(s)` : undefined}>
            <input
              name="client_telephone"
              inputMode="tel"
              required
              autoFocus
              value={tel}
              list="clients-connus"
              onChange={(e) => {
                setTel(e.target.value);
                const c = suggestions.data?.find((x) => x.telephone === e.target.value.replace(/\s+/g, ''));
                if (c) setNom(c.nom);
              }}
              placeholder="08x xxx xxxx"
            />
            <datalist id="clients-connus">
              {suggestions.data?.slice(0, 8).map((c) => (
                <option key={c.id} value={c.telephone}>
                  {c.nom}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="Nom du client *">
            <input name="client_nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
        </div>
        <div className={LIGNE_FORM}>
          <Field label="Appareil (marque / modèle) *">
            <input name="appareil" required placeholder="ex. Tecno Spark 10, noir" />
          </Field>
          <Field label="Batterie au dépôt (%)">
            <input name="batterie_depot" type="number" min={0} max={100} inputMode="numeric" />
          </Field>
        </div>
        <div className={LIGNE_FORM}>
          <Field label="Tarif *">
            <select value={tarif ? String(tarif.id) : ''} onChange={(e) => setTarifId(e.target.value)} required>
              {tarifs.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.libelle} : {argent(t.prix, devise)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Emplacement" aide={empl.data && !libres.length ? 'Aucun emplacement libre' : undefined}>
            <select name="emplacement_id" defaultValue="">
              <option value="">Sans emplacement</option>
              {libres.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} · {e.type_prise}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <input name="notes" placeholder="ex. avec son propre câble, écran fissuré…" />
        </Field>

        <BlocPaiement>
          <label className={CASE}>
            <input type="checkbox" checked={payeMaintenant} onChange={(e) => setPayeChoisi(e.target.checked)} />
            Le client paie maintenant ({argent(tarif?.prix ?? 0, devise)})
          </label>
          {payeMaintenant && (caisse.bloque ? <AlerteCaisseFermee /> : <ChoixPaiement valeur={paiement} onChange={setPaiement} />)}
        </BlocPaiement>

        <div className={ACTIONS}>
          <button type="button" className={bouton()} onClick={onClose}>
            Annuler
          </button>
          <button className={bouton('principal')} disabled={creer.isPending || !tarif || (payeMaintenant && caisse.bloque)}>
            {creer.isPending ? 'Enregistrement…' : 'Enregistrer le dépôt'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Ticket après dépôt ================= */
export function TicketConfirme({ recharge: r, onClose }: { recharge: Recharge; onClose: () => void }) {
  const { devise } = useParametres();
  return (
    <Modal titre="Dépôt enregistré" onClose={onClose}>
      <div className="pt-1.5 pb-1 text-center">
        <div className="text-encre-3">Code du ticket à donner au client</div>
        <div className="my-3 rounded-xl border-2 border-primaire-bord bg-primaire-pale px-2.5 py-3.5 font-mono text-[2.6rem] font-extrabold tracking-[0.2em] text-primaire-fort">
          {r.ticket}
        </div>
        <dl className={RECAP}>
          <dt>Client</dt>
          <dd>
            {r.client_nom} · {r.client_telephone}
          </dd>
          <dt>Appareil</dt>
          <dd>{r.appareil}</dd>
          <dt>Emplacement</dt>
          <dd>{r.emplacement_code ?? '—'}</dd>
          <dt>Tarif</dt>
          <dd>
            {r.tarif_libelle} · {argent(r.montant, devise)}
          </dd>
          <dt>Payé</dt>
          <dd>
            {Number(r.reste) > 0 ? `${argent(r.montant_paye, devise)} (reste ${argent(r.reste, devise)})` : 'Oui, soldé'}
            {r.modes_paiement &&
              ` · ${r.modes_paiement
                .split(',')
                .map((m) => MODES[m as keyof typeof MODES] ?? m)
                .join(', ')}`}
          </dd>
        </dl>
        <div className="mt-1.5 flex flex-wrap justify-center gap-2">
          <button className={bouton()} onClick={() => imprimerTicket(r.id)}>
            <Icone nom="imprimer" className="size-4" /> Imprimer le ticket
          </button>
          <button className={bouton('principal')} onClick={onClose}>
            Terminé
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ================= Retrait (remise au client) ================= */
export function RetraitModal({ recharge: r, onClose }: { recharge: Recharge; onClose: () => void }) {
  const { devise } = useParametres();
  const { data: moi } = useMoi();
  const caisse = useEtatCaisse(r.site_id);
  const reste = Number(r.reste);
  const [encaisser, setEncaisser] = useState(true);
  const [paiement, setPaiement] = useState<ValeurPaiement>(PAIEMENT_DEFAUT);
  const doitEncaisser = reste > 0 && encaisser;

  const retirer = useAction(
    (data: Record<string, unknown>) => http.patch(`/recharges/${r.id}`, { action: 'retirer', ...data }).then((x) => x.data),
    { invalide: INVALIDE, succes: 'Téléphone remis au client', onSuccess: onClose }
  );

  return (
    <Modal titre="Remettre le téléphone" onClose={onClose}>
      <form
        className={FORM}
        onSubmit={(e) => {
          const d = lireForm(e);
          retirer.mutate({ code: String(d.code).trim().toUpperCase(), encaisser, ...corpsPaiement(paiement) });
        }}
      >
        <dl className={RECAP}>
          <dt>Client</dt>
          <dd>
            {r.client_nom} · {r.client_telephone}
          </dd>
          <dt>Appareil</dt>
          <dd>{r.appareil}</dd>
          <dt>Emplacement</dt>
          <dd>{r.emplacement_code ?? '—'}</dd>
          <dt>Déposé</dt>
          <dd>{dateHeure(r.depose_le)}</dd>
        </dl>
        {reste > 0 ? (
          <BlocPaiement>
            <div>
              Reste à encaisser : <strong>{argent(reste, devise)}</strong>
            </div>
            {moi?.role === 'admin' && (
              <label className={CASE}>
                <input type="checkbox" checked={encaisser} onChange={(e) => setEncaisser(e.target.checked)} />
                J'encaisse le reste maintenant
              </label>
            )}
            {doitEncaisser && (caisse.bloque ? <AlerteCaisseFermee /> : <ChoixPaiement valeur={paiement} onChange={setPaiement} />)}
          </BlocPaiement>
        ) : (
          <div className={alerte('ok', false)}>Déjà payé</div>
        )}
        <Field label="Code du ticket présenté par le client *" aide="Vérifie que le téléphone est remis à la bonne personne">
          <input
            name="code"
            required
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={10}
            className="font-mono text-[1.3rem] uppercase tracking-[0.2em]"
          />
        </Field>
        <div className={ACTIONS}>
          <button type="button" className={bouton()} onClick={onClose}>
            Annuler
          </button>
          <button className={bouton('vert')} disabled={retirer.isPending || (doitEncaisser && caisse.bloque)}>
            {doitEncaisser ? `Encaisser ${argent(reste, devise)} et remettre` : 'Remettre le téléphone'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Paiement partiel ================= */
export function PaiementModal({ recharge: r, onClose }: { recharge: Recharge; onClose: () => void }) {
  const { devise } = useParametres();
  const caisse = useEtatCaisse(r.site_id);
  const [paiement, setPaiement] = useState<ValeurPaiement>(PAIEMENT_DEFAUT);
  const payer = useAction(
    (montant: number) => http.patch(`/recharges/${r.id}`, { action: 'payer', montant, ...corpsPaiement(paiement) }).then((x) => x.data),
    { invalide: INVALIDE, succes: 'Paiement enregistré', onSuccess: onClose }
  );
  return (
    <Modal titre={`Paiement · ticket ${r.ticket}`} onClose={onClose}>
      <form className={FORM} onSubmit={(e) => payer.mutate(Number(lireForm(e).montant))}>
        <p>
          Montant : {argent(r.montant, devise)} · Déjà payé : {argent(r.montant_paye, devise)} ·{' '}
          <strong>Reste : {argent(r.reste, devise)}</strong>
        </p>
        {caisse.bloque ? (
          <AlerteCaisseFermee />
        ) : (
          <>
            <Field label="Montant reçu *">
              <input
                name="montant"
                type="number"
                min={1}
                max={Number(r.reste)}
                step="any"
                defaultValue={Number(r.reste)}
                required
                autoFocus
              />
            </Field>
            <ChoixPaiement valeur={paiement} onChange={setPaiement} />
          </>
        )}
        <div className={ACTIONS}>
          <button type="button" className={bouton()} onClick={onClose}>
            Annuler
          </button>
          <button className={bouton('principal')} disabled={payer.isPending || caisse.bloque}>
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Annulation (avec remboursement éventuel) ================= */
export function AnnulerModal({ recharge: r, onClose }: { recharge: Recharge; onClose: () => void }) {
  const { devise } = useParametres();
  const caisse = useEtatCaisse(r.site_id);
  const paye = Number(r.montant_paye);
  const [rembourser, setRembourser] = useState(true);
  const [paiement, setPaiement] = useState<ValeurPaiement>(PAIEMENT_DEFAUT);
  const doitRembourser = paye > 0 && rembourser;

  const annuler = useAction(
    () => http.patch(`/recharges/${r.id}`, { action: 'annuler', rembourser: doitRembourser, mode: paiement.mode }).then((x) => x.data),
    { invalide: INVALIDE, succes: 'Dépôt annulé', onSuccess: onClose }
  );

  return (
    <Modal titre={`Annuler le dépôt ${r.ticket}`} onClose={onClose}>
      <div className={FORM}>
        <p>
          {r.client_nom} · {r.appareil}. L'emplacement {r.emplacement_code ?? ''} sera libéré.
        </p>
        {paye > 0 && (
          <BlocPaiement>
            <div>
              Le client a déjà payé <strong>{argent(paye, devise)}</strong>.
            </div>
            <label className={CASE}>
              <input type="checkbox" checked={rembourser} onChange={(e) => setRembourser(e.target.checked)} />
              Je rembourse le client
            </label>
            {doitRembourser &&
              (caisse.bloque ? (
                <AlerteCaisseFermee />
              ) : (
                <ChoixPaiement label="Rembourser en" valeur={paiement} onChange={setPaiement} sansReference />
              ))}
          </BlocPaiement>
        )}
        <div className={ACTIONS}>
          <button type="button" className={bouton()} onClick={onClose}>
            Retour
          </button>
          <button
            className={bouton('danger')}
            onClick={() => annuler.mutate(undefined)}
            disabled={annuler.isPending || (doitRembourser && caisse.bloque)}
          >
            {doitRembourser ? `Rembourser ${argent(paye, devise)} et annuler` : 'Annuler le dépôt'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export { imprimerTicket, INVALIDE };
