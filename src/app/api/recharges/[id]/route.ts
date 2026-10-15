import type { RowDataPacket } from 'mysql2/promise';
import { body, HttpError, idParam, nombre, notFound, route, texte } from '@/lib/api';
import { query, queryOne, transaction } from '@/lib/db';
import { SELECT_RECHARGE } from '@/lib/requetes';
import { enregistrerPaiement, libelleMode } from '@/lib/caisse';

const charger = (id: number) => queryOne(`${SELECT_RECHARGE} WHERE r.id = ?`, [id]);

export const GET = route(async (_req, { params, site }) => {
  const id = idParam(params);
  const rec = await charger(id);
  if (!rec) notFound('Recharge');
  site.verifier(rec.site_id);
  const [paiements, infosSite] = await Promise.all([
    query(
      `SELECT p.*, u.nom AS operateur_nom FROM paiements p LEFT JOIN utilisateurs u ON u.id = p.operateur_id
       WHERE p.recharge_id = ? ORDER BY p.paye_le`,
      [id]
    ),
    // Pour le ticket : coordonnées du site où le téléphone a été déposé
    queryOne('SELECT adresse AS site_adresse, telephone AS site_telephone, message_ticket AS site_message FROM sites WHERE id = ?', [
      rec.site_id,
    ]),
  ]);
  return { ...rec, ...infosSite, paiements };
});

/**
 * Actions sur une recharge :
 *  { action: 'pret' }                                                 → téléphone chargé, prêt à être retiré
 *  { action: 'payer', montant, mode, reference }                      → enregistre un paiement
 *  { action: 'retirer', code, encaisser, mode, reference }            → remise au client (code du ticket exigé)
 *  { action: 'annuler', rembourser, mode }                            → annulation, libère l'emplacement
 *  { action: 'notes', notes }                                         → modifie les notes
 */
export const PATCH = route(async (req, { params, session, site, journal }) => {
  const id = idParam(params);
  const b = await body(req);
  const action = String(b.action || '');
  let details = '';
  let actionJournal = action;
  let siteRecharge: number | null = null;

  await transaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM recharges WHERE id = ? FOR UPDATE', [id]);
    const r = rows[0];
    if (!r) notFound('Recharge');
    site.verifier(r.site_id);
    siteRecharge = r.site_id;
    const reste = Number(r.montant) - Number(r.montant_paye);
    details = `Ticket ${r.ticket}`;
    const liberer = async () => {
      if (r.emplacement_id) {
        await conn.query("UPDATE emplacements SET statut = 'libre' WHERE id = ? AND statut = 'occupe'", [r.emplacement_id]);
      }
    };

    switch (action) {
      case 'pret': {
        if (r.statut !== 'en_charge') throw new HttpError(409, 'Seule une recharge en cours peut être marquée prête');
        await conn.query("UPDATE recharges SET statut = 'pret', pret_le = NOW() WHERE id = ?", [id]);
        break;
      }
      case 'payer': {
        if (r.statut === 'annule') throw new HttpError(409, 'Recharge annulée');
        const montant = nombre(b.montant, 'Montant', { requis: true, min: 1 })!;
        if (montant > reste) throw new HttpError(400, `Le reste à payer est de ${reste}`);
        const p = await enregistrerPaiement(conn, {
          siteId: r.site_id,
          rechargeId: id,
          montant,
          mode: b.mode,
          reference: b.reference,
          operateurId: session.id,
        });
        await conn.query('UPDATE recharges SET montant_paye = montant_paye + ? WHERE id = ?', [montant, id]);
        actionJournal = 'paiement';
        details += ` · ${montant} en ${libelleMode(p.mode)}${p.reference ? ` (réf. ${p.reference})` : ''}`;
        break;
      }
      case 'retirer': {
        if (!['en_charge', 'pret'].includes(r.statut)) throw new HttpError(409, 'Ce téléphone a déjà été retiré ou annulé');
        const code = texte(b.code, 'Code du ticket', { requis: true })!.toUpperCase();
        if (code !== r.ticket) {
          await journal('code_incorrect', 'recharge', id, `Ticket ${r.ticket} · code saisi : ${code.slice(0, 10)}`, r.site_id);
          throw new HttpError(400, 'Code du ticket incorrect. Vérifiez le ticket du client.');
        }
        const encaisser = b.encaisser !== false;
        if (reste > 0 && !encaisser && session.role === 'operateur') {
          throw new HttpError(403, 'Le client doit payer le reste avant de récupérer son téléphone');
        }
        if (reste > 0 && encaisser) {
          const p = await enregistrerPaiement(conn, {
            siteId: r.site_id,
            rechargeId: id,
            montant: reste,
            mode: b.mode,
            reference: b.reference,
            operateurId: session.id,
          });
          details += ` · reste ${reste} encaissé en ${libelleMode(p.mode)}${p.reference ? ` (réf. ${p.reference})` : ''}`;
        } else if (reste > 0) {
          details += ` · remis SANS payer le reste (${reste})`;
        }
        await conn.query(
          `UPDATE recharges SET statut = 'retire', retire_le = NOW(), pret_le = COALESCE(pret_le, NOW()),
           montant_paye = IF(?, montant, montant_paye) WHERE id = ?`,
          [encaisser ? 1 : 0, id]
        );
        actionJournal = 'retrait';
        await liberer();
        break;
      }
      case 'annuler': {
        if (!['en_charge', 'pret'].includes(r.statut)) throw new HttpError(409, "Impossible d'annuler cette recharge");
        const paye = Number(r.montant_paye);
        if (paye > 0 && b.rembourser) {
          const p = await enregistrerPaiement(conn, {
            siteId: r.site_id,
            rechargeId: id,
            montant: -paye,
            mode: b.mode,
            reference: null,
            operateurId: session.id,
          });
          await conn.query('UPDATE recharges SET montant_paye = 0 WHERE id = ?', [id]);
          details += ` · ${paye} remboursé en ${libelleMode(p.mode)}`;
        } else if (paye > 0) {
          details += ` · ${paye} conservé (non remboursé)`;
        }
        await conn.query("UPDATE recharges SET statut = 'annule', retire_le = NOW() WHERE id = ?", [id]);
        actionJournal = 'annulation';
        await liberer();
        break;
      }
      case 'notes': {
        const notes = texte(b.notes, 'Notes', { max: 255 });
        await conn.query('UPDATE recharges SET notes = ? WHERE id = ?', [notes, id]);
        details += ` · notes : ${notes ?? '∅'}`;
        break;
      }
      default:
        throw new HttpError(400, 'Action inconnue');
    }
  });

  await journal(actionJournal, 'recharge', id, details, siteRecharge);
  return charger(id);
});

// Suppression définitive (administrateur ou gérant du site) : à n'utiliser que pour corriger une erreur de saisie
export const DELETE = route(
  async (_req, { params, site, journal }) => {
    const id = idParam(params);
    let details = '';
    let siteRecharge: number | null = null;
    await transaction(async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT r.site_id, r.emplacement_id, r.statut, r.ticket, r.montant, r.montant_paye, c.nom
         FROM recharges r JOIN clients c ON c.id = r.client_id WHERE r.id = ? FOR UPDATE`,
        [id]
      );
      const r = rows[0];
      if (!r) notFound('Recharge');
      site.verifier(r.site_id);
      siteRecharge = r.site_id;
      details = `Ticket ${r.ticket} · ${r.nom} · montant ${r.montant} · payé ${r.montant_paye} · statut ${r.statut}`;
      if (r.emplacement_id && ['en_charge', 'pret'].includes(r.statut)) {
        await conn.query("UPDATE emplacements SET statut = 'libre' WHERE id = ? AND statut = 'occupe'", [r.emplacement_id]);
      }
      await conn.query('DELETE FROM recharges WHERE id = ?', [id]);
    });
    await journal('suppression', 'recharge', id, details, siteRecharge);
    return { ok: true };
  },
  { gerant: true }
);
