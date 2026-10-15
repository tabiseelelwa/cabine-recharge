// Modes de paiement (partagé entre le serveur et l'interface)
export const MODES = {
  especes: 'Espèces',
  mpesa: 'M-Pesa',
  airtel: 'Airtel Money',
  orange: 'Orange Money',
  autre: 'Autre',
} as const;

export type ModePaiement = keyof typeof MODES;

export function estMode(v: unknown): v is ModePaiement {
  return typeof v === 'string' && v in MODES;
}

/** Modes activés dans les paramètres (« especes,mpesa,… »). Espèces toujours présent. */
export function modesActifs(param: string | undefined | null): ModePaiement[] {
  const liste = (param || 'especes,mpesa,airtel,orange')
    .split(',')
    .map((s) => s.trim())
    .filter(estMode);
  return liste.includes('especes') ? liste : ['especes', ...liste];
}

export const estMobile = (m: string) => m !== 'especes';
