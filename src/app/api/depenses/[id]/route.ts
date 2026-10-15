import { body, dateISO, HttpError, idParam, nombre, notFound, route, texte } from '@/lib/api';
import { execute, queryOne } from '@/lib/db';
import { differences } from '@/lib/journal';
import { lireMode } from '@/lib/caisse';

const CHAMPS = { date_depense: 'date', categorie: 'catégorie', description: 'description', montant: 'montant', mode: 'mode' };

async function verifierCaisseOuverte(caisseId: number | null) {
  if (!caisseId) return;
  const c = await queryOne<{ statut: string }>('SELECT statut FROM caisses WHERE id = ?', [caisseId]);
  if (c?.statut === 'fermee') throw new HttpError(409, 'Cette dépense appartient à une caisse déjà clôturée : modification impossible');
}

export const PUT = route(
  async (req, { params, site, journal }) => {
    const id = idParam(params);
    const avant = await queryOne('SELECT * FROM depenses WHERE id = ?', [id]);
    if (!avant) notFound('Dépense');
    site.verifier(avant.site_id);
    await verifierCaisseOuverte(avant.caisse_id);

    const b = await body(req);
    const apres = {
      date_depense: dateISO(b.date_depense, 'Date', true),
      categorie: texte(b.categorie, 'Catégorie', { requis: true, max: 50 }),
      description: texte(b.description, 'Description', { requis: true, max: 255 }),
      montant: nombre(b.montant, 'Montant', { requis: true, min: 0 }),
      mode: lireMode(b.mode),
    };
    // Si la dépense n'est plus en espèces, elle ne sort plus de la caisse
    const caisseId = apres.mode === 'especes' ? avant.caisse_id : null;
    await execute(
      'UPDATE depenses SET date_depense = ?, categorie = ?, description = ?, montant = ?, mode = ?, caisse_id = ? WHERE id = ?',
      [apres.date_depense, apres.categorie, apres.description, apres.montant, apres.mode, caisseId, id]
    );
    await journal(
      'modification',
      'depense',
      id,
      differences({ ...avant, date_depense: String(avant.date_depense).slice(0, 10) }, apres, CHAMPS),
      avant.site_id
    );
    return queryOne('SELECT * FROM depenses WHERE id = ?', [id]);
  },
  { gerant: true }
);

export const DELETE = route(
  async (_req, { params, site, journal }) => {
    const id = idParam(params);
    const d = await queryOne('SELECT * FROM depenses WHERE id = ?', [id]);
    if (!d) notFound('Dépense');
    site.verifier(d.site_id);
    await verifierCaisseOuverte(d.caisse_id);
    await execute('DELETE FROM depenses WHERE id = ?', [id]);
    await journal('suppression', 'depense', id, `${d.categorie} · ${d.description} · ${d.montant}`, d.site_id);
    return { ok: true };
  },
  { gerant: true }
);
