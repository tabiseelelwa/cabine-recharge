import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { HttpError, route } from '@/lib/api';
import { cheminFichier, enregistrerSurDisque, genererDump, marquerTelechargement } from '@/lib/sauvegarde';

/**
 * Télécharge une sauvegarde :
 *  - sans paramètre : crée une sauvegarde maintenant (copie aussi gardée sur le PC) ;
 *  - ?fichier=nom.sql : télécharge une copie déjà présente sur le PC.
 */
export const GET = route(
  async (req, { journal }) => {
    const fichier = req.nextUrl.searchParams.get('fichier');
    let nom: string;
    let contenu: string;

    if (fichier) {
      try {
        contenu = await fs.readFile(cheminFichier(fichier), 'utf8');
      } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(404, 'Fichier introuvable');
      }
      nom = fichier;
    } else {
      contenu = await genererDump();
      nom = await enregistrerSurDisque(contenu, 'manuelle');
    }

    await marquerTelechargement();
    await journal('telechargement', 'sauvegarde', null, nom, null);

    return new NextResponse(contenu, {
      headers: {
        'Content-Type': 'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="cabine_${nom}"`,
        'Cache-Control': 'no-store',
      },
    });
  },
  { admin: true }
);
