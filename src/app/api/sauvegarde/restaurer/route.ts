import fs from 'node:fs/promises';
import { HttpError, route } from '@/lib/api';
import { cheminFichier, restaurer } from '@/lib/sauvegarde';

export const maxDuration = 300;

/**
 * Restaure la base :
 *  - corps de la requête = contenu d'un fichier .sql envoyé depuis l'ordinateur / le téléphone ;
 *  - ou ?fichier=nom.sql pour une copie présente sur le PC de la cabine.
 * L'en-tête X-Confirmation doit valoir RESTAURER.
 */
export const POST = route(
  async (req, { journal }) => {
    if (req.headers.get('x-confirmation') !== 'RESTAURER') {
      throw new HttpError(400, 'Confirmation manquante');
    }
    const fichier = req.nextUrl.searchParams.get('fichier');
    let sql: string;
    let source: string;
    if (fichier) {
      sql = await fs.readFile(cheminFichier(fichier), 'utf8').catch(() => {
        throw new HttpError(404, 'Fichier introuvable');
      });
      source = `copie du PC « ${fichier} »`;
    } else {
      sql = await req.text();
      if (!sql.trim()) throw new HttpError(400, 'Fichier vide');
      source = `fichier envoyé (${Math.round(sql.length / 1024)} Ko)`;
    }

    const res = await restaurer(sql);
    await journal(
      'restauration',
      'sauvegarde',
      null,
      `Base restaurée depuis ${source} · état précédent copié dans ${res.copieAvant}`,
      null
    );
    return res;
  },
  { admin: true }
);
