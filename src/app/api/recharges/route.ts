import crypto from 'node:crypto';
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { body, HttpError, nombre, route, texte, dateISO } from '@/lib/api';
import { query, transaction } from '@/lib/db';
import { SELECT_RECHARGE, SELECT_TARIFS_SITE } from '@/lib/requetes';
import { enregistrerPaiement, libelleMode } from '@/lib/caisse';

// Liste filtrable : ?statut=en_charge|pret|retire|annule|actifs  &q=  &date=AAAA-MM-JJ
export const GET = route(async (req, { site }) => {
  const sp = req.nextUrl.searchParams;
  const f = site.filtre('r.site_id');
  const where: string[] = [f.sql];
  const params: unknown[] = [...f.params];

  const statut = sp.get('statut');
  if (statut === 'actifs') where.push("r.statut IN ('en_charge','pret')");
  else if (statut && ['en_charge', 'pret', 'retire', 'annule'].includes(statut)) {
    where.push('r.statut = ?');
    params.push(statut);
  }

  const q = sp.get('q')?.trim();
  if (q) {
    where.push('(r.ticket LIKE ? OR c.nom LIKE ? OR c.telephone LIKE ? OR r.appareil LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const date = dateISO(sp.get('date'), 'date');
  if (date) {
    where.push('DATE(r.depose_le) = ?');
    params.push(date);
  }

  const clientId = Number(sp.get('client_id'));
  if (clientId > 0) {
    where.push('r.client_id = ?');
    params.push(clientId);
  }

  const sql = `${SELECT_RECHARGE} WHERE ${where.join(' AND ')}
               ORDER BY r.depose_le DESC LIMIT 300`;
  return query(sql, params);
});

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I pour éviter les confusions
function genererTicket(): string {
  const bytes = crypto.randomBytes(5);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

async function trouverOuCreerClient(conn: PoolConnection, nom: string, telephone: string): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>('SELECT id, nom FROM clients WHERE telephone = ?', [telephone]);
  if (rows.length) {
    if (rows[0].nom !== nom) await conn.query('UPDATE clients SET nom = ? WHERE id = ?', [nom, rows[0].id]);
    return rows[0].id;
  }
  const [res] = await conn.query<ResultSetHeader>('INSERT INTO clients (nom, telephone) VALUES (?, ?)', [nom, telephone]);
  return res.insertId;
}

// Nouveau dépôt d'un téléphone
export const POST = route(async (req, { session, site, journal }) => {
  const siteId = site.exiger();
  const b = await body(req);
  const nom = texte(b.client_nom, 'Nom du client', { requis: true, max: 100 })!;
  const telephone = texte(b.client_telephone, 'Téléphone du client', { requis: true, max: 30 })!.replace(/\s+/g, '');
  const appareil = texte(b.appareil, 'Appareil', { requis: true, max: 100 })!;
  const batterie = nombre(b.batterie_depot, 'Batterie au dépôt', { min: 0, max: 100, entier: true });
  const tarifId = nombre(b.tarif_id, 'Tarif', { requis: true, entier: true })!;
  const emplacementId = nombre(b.emplacement_id, 'Emplacement', { entier: true });
  const paye = nombre(b.montant_paye, 'Montant payé', { min: 0 }) ?? 0;
  const notes = texte(b.notes, 'Notes', { max: 255 });

  const id = await transaction(async (conn) => {
    // Prix du tarif sur ce site (prix commun ou prix propre au site)
    const [tarifs] = await conn.query<RowDataPacket[]>(`${SELECT_TARIFS_SITE} WHERE t.id = ?`, [siteId, tarifId]);
    if (!tarifs.length || !Number(tarifs[0].actif)) throw new HttpError(400, 'Tarif introuvable ou désactivé sur ce site');
    const montant = Number(tarifs[0].prix);
    if (paye > montant) throw new HttpError(400, 'Le montant payé dépasse le prix');

    if (emplacementId) {
      // Verrouille l'emplacement pour éviter deux dépôts simultanés
      const [empl] = await conn.query<RowDataPacket[]>('SELECT statut FROM emplacements WHERE id = ? AND site_id = ? FOR UPDATE', [
        emplacementId,
        siteId,
      ]);
      if (!empl.length) throw new HttpError(400, 'Emplacement introuvable sur ce site');
      if (empl[0].statut !== 'libre') throw new HttpError(409, "Cet emplacement n'est pas libre");
      await conn.query("UPDATE emplacements SET statut = 'occupe' WHERE id = ?", [emplacementId]);
    }

    const clientId = await trouverOuCreerClient(conn, nom, telephone);

    let rechargeId = 0;
    for (let essai = 0; essai < 5 && !rechargeId; essai++) {
      try {
        const [res] = await conn.query<ResultSetHeader>(
          `INSERT INTO recharges (site_id, ticket, client_id, appareil, batterie_depot, emplacement_id, tarif_id, montant, montant_paye, operateur_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [siteId, genererTicket(), clientId, appareil, batterie, emplacementId, tarifId, montant, paye, session.id, notes]
        );
        rechargeId = res.insertId;
      } catch (e) {
        if ((e as { code?: string }).code !== 'ER_DUP_ENTRY') throw e;
      }
    }
    if (!rechargeId) throw new HttpError(500, 'Impossible de générer un ticket unique, réessayez');

    if (paye > 0) {
      await enregistrerPaiement(conn, {
        siteId,
        rechargeId,
        montant: paye,
        mode: b.mode_paiement,
        reference: b.reference_paiement,
        operateurId: session.id,
      });
    }
    return rechargeId;
  });

  const [rec] = await query(`${SELECT_RECHARGE} WHERE r.id = ?`, [id]);
  await journal(
    'depot',
    'recharge',
    id,
    `Ticket ${rec.ticket} · ${rec.client_nom} (${rec.client_telephone}) · ${rec.appareil} · ${rec.tarif_libelle} ${rec.montant}` +
      (paye > 0 ? ` · payé ${paye} en ${libelleMode(b.mode_paiement || 'especes')}` : ' · non payé') +
      (rec.emplacement_code ? ` · empl. ${rec.emplacement_code}` : '')
  );
  return rec;
});
