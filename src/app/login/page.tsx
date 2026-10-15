'use client';
import { useState } from 'react';
import { http, messageErreur } from '@/lib/http';
import { Alerte, bouton, cx, Field, FORM } from '@/components/ui';
import { Logo } from '@/components/Icone';

export default function LoginPage() {
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setEnCours(true);
    setErreur('');
    try {
      await http.post('/auth/login', { identifiant: fd.get('identifiant'), mot_de_passe: fd.get('mot_de_passe') });
      window.location.href = '/';
    } catch (err) {
      setErreur(messageErreur(err));
      setEnCours(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primaire-pale via-fond to-bleu-pale p-5">
      <form className={cx(FORM, 'w-full max-w-[380px] rounded-2xl border border-ligne bg-carte px-7 py-8 shadow-xl')} onSubmit={onSubmit}>
        <div className="flex items-center gap-3 pb-3">
          <Logo className="size-11" />
          <div>
            <div className="text-lg font-bold leading-tight">Cabine Solaire</div>
            <div className="text-sm text-bleu">Gestion des recharges</div>
          </div>
        </div>
        {erreur && (
          <Alerte ton="erreur" className="mb-0">
            {erreur}
          </Alerte>
        )}
        <Field label="Identifiant">
          <input name="identifiant" autoComplete="username" autoCapitalize="none" required autoFocus />
        </Field>
        <Field label="Mot de passe">
          <input name="mot_de_passe" type="password" autoComplete="current-password" required />
        </Field>
        <button className={cx(bouton('principal'), 'mt-1')} disabled={enCours}>
          {enCours ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
