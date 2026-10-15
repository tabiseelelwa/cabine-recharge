import { body, idParam, nombre, notFound, route } from '@/lib/api';
import { execute, queryOne } from '@/lib/db';

/**
 * Prix ou état d'un tarif sur le site choisi (administrateur ou gérant du site).
 * Corps : { prix: nombre | null (null = prix commun), actif: booléen }
 */
export const PUT = route(
  async (req, { params, site, journal }) => {
    const tarifId = idParam(params);
    const siteId = site.exiger();
    const t = await queryOne<{ libelle: string; prix: number }>('SELECT libelle, prix FROM tarifs WHERE id = ?', [tarifId]);
    if (!t) notFound('Tarif');
    const b = await body(req);
    const prix = nombre(b.prix, 'Prix', { min: 0 });
    const actif = b.actif === false ? 0 : 1;

    if (prix === null && actif) {
      // Retour au tarif commun : plus d'exception pour ce site
      await execute('DELETE FROM tarifs_sites WHERE tarif_id = ? AND site_id = ?', [tarifId, siteId]);
    } else {
      await execute(
        'INSERT INTO tarifs_sites (tarif_id, site_id, prix, actif) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE prix = VALUES(prix), actif = VALUES(actif)',
        [tarifId, siteId, prix, actif]
      );
    }
    await journal(
      'prix_site',
      'tarif',
      tarifId,
      `${t.libelle} · ${prix === null ? `prix commun (${t.prix})` : `prix du site : ${prix}`}${actif ? '' : ' · désactivé sur ce site'}`
    );
    return { ok: true };
  },
  { gerant: true }
);
