export function argent(n: number | string | null | undefined, devise = 'FC'): string {
  const v = Number(n ?? 0);
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${devise}`;
}

/** "2026-10-14 09:30:00" → "14/10 09:30" */
export function dateHeure(s: string | null | undefined, avecAnnee = false): string {
  if (!s) return '—';
  const [d, t = ''] = s.split(' ');
  const [y, m, j] = d.split('-');
  return `${j}/${m}${avecAnnee ? '/' + y : ''}${t ? ' ' + t.slice(0, 5) : ''}`;
}

export function date(s: string | null | undefined): string {
  if (!s) return '—';
  const [y, m, j] = s.slice(0, 10).split('-');
  return `${j}/${m}/${y}`;
}

/** Durée écoulée depuis une date MySQL locale */
export function depuis(s: string | null | undefined): string {
  if (!s) return '';
  const t = new Date(s.replace(' ', 'T')).getTime();
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${Math.floor(h / 24)} j`;
}

export function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function moisCourant(): string {
  return aujourdhui().slice(0, 7);
}

export const LIBELLE_STATUT: Record<string, string> = {
  en_charge: 'En charge',
  pret: 'Prêt',
  retire: 'Retiré',
  annule: 'Annulé',
  libre: 'Libre',
  occupe: 'Occupé',
  hors_service: 'Hors service',
};

export const LIBELLE_ROLE: Record<string, string> = { admin: 'Administrateur', gerant: 'Gérant', operateur: 'Opérateur' };
