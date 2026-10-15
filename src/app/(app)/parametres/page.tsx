'use client';
import { useState } from 'react';
import Link from 'next/link';
import { put, useAction, useMoi, useParametres } from '@/lib/hooks';
import { ACTIONS, bouton, CARTE, CASE, Chargement, EnTete, Field, FORM, GRILLE_2, LIGNE_FORM, lireForm } from '@/components/ui';
import { MODES, modesActifs, type ModePaiement } from '@/lib/modes';

const MODES_OPTIONNELS: ModePaiement[] = ['mpesa', 'airtel', 'orange', 'autre'];

export default function ParametresPage() {
  const { data: moi } = useMoi();
  const { data: p, isLoading } = useParametres();
  const [cle, setCle] = useState(0);

  const sauver = useAction(put('/parametres'), { invalide: ['/parametres', '/stats'], succes: 'Paramètres enregistrés' });
  const changerMdp = useAction(put('/auth/me'), { succes: 'Mot de passe modifié', onSuccess: () => setCle((k) => k + 1) });

  if (isLoading || !moi) return <Chargement />;
  const admin = moi.role === 'admin';

  return (
    <>
      <EnTete titre={admin ? 'Paramètres' : 'Mon compte'} />
      <div className={GRILLE_2}>
        {admin && p && (
          <div className={CARTE}>
            <h2 className="mb-1 text-lg font-semibold">L'entreprise</h2>
            <p className="mb-3.5 text-sm text-encre-3">
              Réglages communs à tous les sites. L'adresse, le téléphone, l'alerte batterie et le message du ticket se règlent pour chaque
              site, dans{' '}
              <Link href="/sites" className="text-bleu underline">
                Sites
              </Link>
              .
            </p>
            <form
              className={FORM}
              onSubmit={(e) => {
                const d = lireForm(e);
                const modes = ['especes', ...MODES_OPTIONNELS.filter((m) => d[`mode_${m}`])];
                MODES_OPTIONNELS.forEach((m) => delete d[`mode_${m}`]);
                sauver.mutate({ ...d, modes_paiement: modes.join(',') });
              }}
            >
              <div className={LIGNE_FORM}>
                <Field label="Nom de l'entreprise" aide="Affiché dans le menu">
                  <input name="nom_cabine" defaultValue={p.nom_cabine} maxLength={100} />
                </Field>
                <Field label="Devise" aide="ex. FC, USD, $">
                  <input name="devise" defaultValue={p.devise} maxLength={10} />
                </Field>
              </div>
              <fieldset className="grid gap-2.5 rounded-lg border border-ligne px-3.5 pb-3.5 pt-3">
                <legend className="px-1.5 font-bold">Paiements et caisse</legend>
                <div className="text-sm font-semibold text-encre-2">Modes de paiement acceptés</div>
                <div className="flex flex-wrap gap-x-[18px] gap-y-2">
                  <label className={CASE}>
                    <input type="checkbox" checked disabled /> {MODES.especes}
                  </label>
                  {MODES_OPTIONNELS.map((m) => (
                    <label className={CASE} key={m}>
                      <input type="checkbox" name={`mode_${m}`} defaultChecked={modesActifs(p.modes_paiement).includes(m)} /> {MODES[m]}
                    </label>
                  ))}
                </div>
                <label className={CASE}>
                  <input type="checkbox" name="caisse_obligatoire" defaultChecked={p.caisse_obligatoire !== '0'} />
                  Caisse obligatoire : un site ne peut pas encaisser tant que sa caisse n'est pas ouverte
                </label>
              </fieldset>
              <div className={ACTIONS}>
                <button className={bouton('principal')} disabled={sauver.isPending}>
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={CARTE}>
          <h2 className="mb-1 text-lg font-semibold">Mon mot de passe</h2>
          <p className="mb-3 text-sm text-encre-3">
            Connecté en tant que <strong>{moi.identifiant}</strong>
          </p>
          <form
            key={cle}
            className={FORM}
            onSubmit={(e) => {
              const d = lireForm(e);
              if (d.nouveau !== d.confirmation) {
                alert('Les deux nouveaux mots de passe ne correspondent pas');
                return;
              }
              changerMdp.mutate({ ancien: d.ancien, nouveau: d.nouveau });
            }}
          >
            <Field label="Mot de passe actuel">
              <input name="ancien" type="password" required autoComplete="current-password" />
            </Field>
            <Field label="Nouveau mot de passe" aide="6 caractères minimum">
              <input name="nouveau" type="password" minLength={6} required autoComplete="new-password" />
            </Field>
            <Field label="Confirmer le nouveau mot de passe">
              <input name="confirmation" type="password" minLength={6} required autoComplete="new-password" />
            </Field>
            <div className={ACTIONS}>
              <button className={bouton('bleu')} disabled={changerMdp.isPending}>
                Changer le mot de passe
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
