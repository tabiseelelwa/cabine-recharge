import { route } from '@/lib/api';
import { queryOne } from '@/lib/db';
import { dossierSauvegardes, enregistrerSurDisque, genererDump, listerFichiers } from '@/lib/sauvegarde';

// Liste des sauvegardes conservées sur le PC de la cabine
export const GET = route(
  async () => {
    const [fichiers, manuelle, auto] = await Promise.all([
      listerFichiers(),
      queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'derniere_sauvegarde'"),
      queryOne<{ valeur: string }>("SELECT valeur FROM parametres WHERE cle = 'derniere_sauvegarde_auto'"),
    ]);
    return {
      dossier: dossierSauvegardes(),
      fichiers,
      derniere_sauvegarde: manuelle?.valeur || null,
      derniere_sauvegarde_auto: auto?.valeur || null,
    };
  },
  { admin: true }
);

// Crée immédiatement une sauvegarde sur le PC de la cabine
export const POST = route(
  async (_req, { journal }) => {
    const nom = await enregistrerSurDisque(await genererDump(), 'manuelle');
    await journal('sauvegarde', 'sauvegarde', null, `Copie enregistrée sur le PC : ${nom}`, null);
    return { nom };
  },
  { admin: true }
);
