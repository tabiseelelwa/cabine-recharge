import { body, nombre, route, texte } from '@/lib/api';
import { execute, query, queryOne } from '@/lib/db';
import { SELECT_TARIFS_SITE } from '@/lib/requetes';

/**
 * Tarifs.
 *  - Un site choisi : prix et état sur ce site (prix commun ou prix du site). ?actifs=1 pour ne garder que les utilisables.
 *  - « Tous les sites » : tarifs communs, avec les exceptions de chaque site.
 */
export const GET = route(async (req, { site }) => {
  const actifs = req.nextUrl.searchParams.get('actifs') === '1';
  if (site.actif) {
    return query(
      `${SELECT_TARIFS_SITE} ${actifs ? 'WHERE t.actif = 1 AND COALESCE(ts.actif, 1) = 1' : ''} ORDER BY (t.actif = 1 AND COALESCE(ts.actif, 1) = 1) DESC, COALESCE(ts.prix, t.prix)`,
      [site.actif]
    );
  }
  const [tarifs, exceptions] = await Promise.all([
    query(
      `SELECT t.id, t.libelle, t.description, t.duree_minutes, t.prix, t.prix AS prix_commun, NULL AS prix_site,
              t.actif, t.actif AS actif_commun, 1 AS actif_site
       FROM tarifs t ${actifs ? 'WHERE t.actif = 1' : ''} ORDER BY t.actif DESC, t.prix`
    ),
    query(
      `SELECT ts.tarif_id, ts.site_id, s.code AS site_code, s.nom AS site_nom, ts.prix, ts.actif
       FROM tarifs_sites ts JOIN sites s ON s.id = ts.site_id WHERE ts.site_id IN (?) ORDER BY s.code`,
      [site.vue]
    ),
  ]);
  return tarifs.map((t) => ({ ...t, exceptions: exceptions.filter((e) => e.tarif_id === t.id) }));
});

// Nouveau tarif commun à tous les sites (administrateur)
export const POST = route(
  async (req, { journal }) => {
    const b = await body(req);
    const libelle = texte(b.libelle, 'Libellé', { requis: true, max: 100 });
    const prix = nombre(b.prix, 'Prix', { requis: true, min: 0 });
    const res = await execute('INSERT INTO tarifs (libelle, description, prix, duree_minutes, actif) VALUES (?, ?, ?, ?, ?)', [
      libelle,
      texte(b.description, 'Description', { max: 255 }),
      prix,
      nombre(b.duree_minutes, 'Durée', { min: 1, entier: true }),
      b.actif === false ? 0 : 1,
    ]);
    await journal('creation', 'tarif', res.insertId, `${libelle} · ${prix}`, null);
    return queryOne('SELECT * FROM tarifs WHERE id = ?', [res.insertId]);
  },
  { admin: true }
);
