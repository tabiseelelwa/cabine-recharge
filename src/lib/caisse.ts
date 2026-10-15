import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { HttpError, texte } from './api';
import { estMode, MODES, type ModePaiement } from './modes';

type Q = Pick<PoolConnection, 'query'>;

/** Id de la caisse ouverte d'un site (verrouillée jusqu'à la fin de la transaction), ou null */
export async function caisseOuverteId(conn: Q, siteId: number, verrouiller = true): Promise<number | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM caisses WHERE site_id = ? AND statut = 'ouverte' LIMIT 1 ${verrouiller ? 'FOR UPDATE' : ''}`,
    [siteId]
  );
  return rows[0]?.id ?? null;
}

export async function caisseObligatoire(conn: Q): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>("SELECT valeur FROM parametres WHERE cle = 'caisse_obligatoire'");
  return (rows[0]?.valeur ?? '1') !== '0';
}

export function lireMode(v: unknown): ModePaiement {
  const mode = v == null || v === '' ? 'especes' : v;
  if (!estMode(mode)) throw new HttpError(400, 'Mode de paiement invalide');
  return mode;
}

/**
 * Enregistre un mouvement d'argent lié à une recharge (montant négatif = remboursement)
 * et le rattache à la caisse ouverte. À appeler dans une transaction.
 */
export async function enregistrerPaiement(
  conn: Q,
  p: { siteId: number; rechargeId: number | null; montant: number; mode: unknown; reference: unknown; operateurId: number }
) {
  const mode = lireMode(p.mode);
  const reference = texte(p.reference, 'Référence de transaction', { max: 50 });
  // L'argent va dans la caisse du site où se trouve le téléphone
  const caisseId = await caisseOuverteId(conn, p.siteId);
  if (!caisseId && (await caisseObligatoire(conn))) {
    throw new HttpError(409, "La caisse de ce site est fermée. Ouvrez la caisse (menu « Caisse ») avant d'encaisser.");
  }
  await conn.query(
    'INSERT INTO paiements (site_id, recharge_id, montant, mode, reference, caisse_id, operateur_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [p.siteId, p.rechargeId, p.montant, mode, reference, caisseId, p.operateurId]
  );
  return { mode, reference, caisseId };
}

export const libelleMode = (m: string) => MODES[m as ModePaiement] ?? m;

/** Bilan d'une session de caisse : encaissements par mode, dépenses en espèces, espèces attendues */
export async function resumeCaisse(conn: Q, caisseId: number) {
  const [[caisse]] = await conn.query<RowDataPacket[]>('SELECT fond_initial FROM caisses WHERE id = ?', [caisseId]);
  const [parMode] = await conn.query<RowDataPacket[]>(
    `SELECT mode,
            COALESCE(SUM(CASE WHEN montant > 0 THEN montant END), 0) AS recu,
            COALESCE(SUM(CASE WHEN montant < 0 THEN -montant END), 0) AS rembourse,
            COUNT(*) AS nb
     FROM paiements WHERE caisse_id = ? GROUP BY mode ORDER BY mode`,
    [caisseId]
  );
  const [[dep]] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(montant), 0) AS total, COUNT(*) AS nb FROM depenses WHERE caisse_id = ? AND mode = 'especes'`,
    [caisseId]
  );

  const fond = Number(caisse?.fond_initial ?? 0);
  const modes = parMode.map((m) => ({
    mode: m.mode as ModePaiement,
    recu: Number(m.recu),
    rembourse: Number(m.rembourse),
    net: Number(m.recu) - Number(m.rembourse),
    nb: Number(m.nb),
  }));
  const especes = modes.find((m) => m.mode === 'especes');
  const depensesEspeces = Number(dep?.total ?? 0);
  return {
    fond_initial: fond,
    par_mode: modes,
    total_encaisse: modes.reduce((a, m) => a + m.net, 0),
    total_mobile: modes.filter((m) => m.mode !== 'especes').reduce((a, m) => a + m.net, 0),
    especes_nettes: especes?.net ?? 0,
    depenses_especes: depensesEspeces,
    nb_depenses: Number(dep?.nb ?? 0),
    especes_attendues: fond + (especes?.net ?? 0) - depensesEspeces,
  };
}
