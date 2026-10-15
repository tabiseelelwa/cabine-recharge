import { body, HttpError, nombre, route, texte } from '@/lib/api';
import { execute, query, queryOne } from '@/lib/db';

// Relevés du système solaire (batteries lithium). ?jours=30
export const GET = route(async (req, { site }) => {
  const jours = Math.min(Math.max(Number(req.nextUrl.searchParams.get('jours')) || 30, 1), 365);
  const f = site.filtre('r.site_id');
  return query(
    `SELECT r.*, u.nom AS operateur_nom, s.code AS site_code, s.nom AS site_nom, s.seuil_batterie
     FROM releves_energie r
     JOIN sites s ON s.id = r.site_id
     LEFT JOIN utilisateurs u ON u.id = r.operateur_id
     WHERE r.releve_le >= DATE_SUB(NOW(), INTERVAL ? DAY) AND ${f.sql}
     ORDER BY r.releve_le DESC`,
    [jours, ...f.params]
  );
});

export const POST = route(async (req, { session, site, journal }) => {
  const siteId = site.exiger();
  const b = await body(req);
  const meteo = b.meteo || null;
  if (meteo && !['ensoleille', 'nuageux', 'pluvieux'].includes(meteo)) throw new HttpError(400, 'Météo invalide');
  const res = await execute(
    'INSERT INTO releves_energie (site_id, niveau_batterie, tension, production_wh, meteo, notes, operateur_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      siteId,
      nombre(b.niveau_batterie, 'Niveau batterie', { requis: true, min: 0, max: 100, entier: true }),
      nombre(b.tension, 'Tension', { min: 0, max: 1000 }),
      nombre(b.production_wh, 'Production', { min: 0, entier: true }),
      meteo,
      texte(b.notes, 'Notes', { max: 255 }),
      session.id,
    ]
  );
  await journal('creation', 'releve', res.insertId, `Batterie ${b.niveau_batterie} %${b.tension ? ` · ${b.tension} V` : ''}`);
  return queryOne('SELECT * FROM releves_energie WHERE id = ?', [res.insertId]);
});
