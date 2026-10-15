import { dateISO, route } from '@/lib/api';
import { query } from '@/lib/db';

// Journal d'activité (administrateur, ou gérant pour ses sites) : ?du=&au=&utilisateur_id=&entite=&q=&page=
// L'administrateur en vue « Tous les sites » voit aussi les actions sans site (connexions, paramètres…).
export const GET = route(
  async (req, { site }) => {
    const sp = req.nextUrl.searchParams;
    const f = site.filtre('j.site_id', true);
    const where: string[] = [f.sql];
    const params: unknown[] = [...f.params];

    const du = dateISO(sp.get('du'), 'du');
    if (du) {
      where.push('j.cree_le >= ?');
      params.push(`${du} 00:00:00`);
    }
    const au = dateISO(sp.get('au'), 'au');
    if (au) {
      where.push('j.cree_le <= ?');
      params.push(`${au} 23:59:59`);
    }
    const utilisateur = Number(sp.get('utilisateur_id'));
    if (utilisateur > 0) {
      where.push('j.utilisateur_id = ?');
      params.push(utilisateur);
    }
    const entite = sp.get('entite');
    if (entite && /^[a-z_]{1,30}$/.test(entite)) {
      where.push('j.entite = ?');
      params.push(entite);
    }
    if (sp.get('sensibles') === '1') {
      where.push(
        "(j.action IN ('suppression','annulation','echec_connexion','code_incorrect','restauration','cloture') OR j.details LIKE '%SANS payer%' OR (j.entite = 'tarif' AND j.action = 'modification'))"
      );
    }
    const q = sp.get('q')?.trim();
    if (q) {
      where.push('(j.details LIKE ? OR j.utilisateur_nom LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    const page = Math.max(1, Number(sp.get('page')) || 1);
    const parPage = 100;
    const rows = await query(
      `SELECT j.*, s.code AS site_code FROM journal j LEFT JOIN sites s ON s.id = j.site_id WHERE ${where.join(' AND ')}
       ORDER BY j.cree_le DESC, j.id DESC LIMIT ? OFFSET ?`,
      [...params, parPage + 1, (page - 1) * parPage]
    );
    return { lignes: rows.slice(0, parPage), page, suivante: rows.length > parPage };
  },
  { gerant: true }
);
