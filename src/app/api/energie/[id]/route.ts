import { idParam, notFound, route } from '@/lib/api';
import { execute, queryOne } from '@/lib/db';

export const DELETE = route(
  async (_req, { params, site, journal }) => {
    const id = idParam(params);
    const r = await queryOne('SELECT releve_le, niveau_batterie, site_id FROM releves_energie WHERE id = ?', [id]);
    if (!r) notFound('Relevé');
    site.verifier(r.site_id);
    await execute('DELETE FROM releves_energie WHERE id = ?', [id]);
    await journal('suppression', 'releve', id, `${r.releve_le} · ${r.niveau_batterie} %`, r.site_id);
    return { ok: true };
  },
  { gerant: true }
);
