import { body, route, texte } from '@/lib/api';
import { pool, query } from '@/lib/db';
import { modesActifs } from '@/lib/modes';

// Paramètres communs à toute l'entreprise. Les coordonnées, le seuil batterie et le message du ticket sont propres à chaque site.
const CLES = ['nom_cabine', 'devise', 'modes_paiement', 'caisse_obligatoire'] as const;
const LIBELLES: Record<string, string> = {
  nom_cabine: "nom de l'entreprise",
  devise: 'devise',
  modes_paiement: 'modes de paiement',
  caisse_obligatoire: 'caisse obligatoire',
};

async function lire() {
  const rows = await query<{ cle: string; valeur: string }>('SELECT cle, valeur FROM parametres');
  return Object.fromEntries(rows.map((r) => [r.cle, r.valeur])) as Record<string, string>;
}

export const GET = route(async () => lire());

export const PUT = route(
  async (req, { journal }) => {
    const b = await body(req);
    const avant = await lire();
    const values: [string, string][] = [];
    for (const k of CLES) {
      if (!(k in b)) continue;
      let v = texte(b[k], k, { max: 500 }) ?? '';
      if (k === 'modes_paiement') v = modesActifs(v).join(',');
      if (k === 'caisse_obligatoire') v = b[k] === true || v === '1' || v === 'true' ? '1' : '0';
      values.push([k, v]);
    }
    if (values.length) {
      await pool.query('INSERT INTO parametres (cle, valeur) VALUES ? ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)', [values]);
      const changes = values
        .filter(([k, v]) => (avant[k] ?? '') !== v)
        .map(([k, v]) => `${LIBELLES[k]} : ${avant[k] || '∅'} → ${v || '∅'}`);
      if (changes.length) await journal('modification', 'parametres', null, changes.join(' ; '), null);
    }
    return lire();
  },
  { admin: true }
);
