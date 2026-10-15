'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, messageErreur } from './http';
import { useToast } from '@/components/ui';
import type { InfosSites, Parametres, Utilisateur } from './types';

/** GET générique */
export function useApi<T>(url: string, params?: Record<string, unknown>, opts: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useQuery<T>({
    queryKey: [url, params ?? {}],
    queryFn: () => http.get<T>(url, { params }).then((r) => r.data),
    ...opts,
  });
}

/**
 * Mutation générique (POST / PUT / PATCH / DELETE) avec notification
 * et invalidation des listes concernées.
 */
export function useAction<V = unknown, R = unknown>(
  fn: (v: V) => Promise<R>,
  opts: { invalide?: string[]; succes?: string | ((r: R) => string); onSuccess?: (r: R) => void } = {}
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<R, unknown, V>({
    mutationFn: fn,
    onSuccess: (r) => {
      (opts.invalide ?? []).forEach((k) => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(k) }));
      if (opts.succes) toast(typeof opts.succes === 'function' ? opts.succes(r) : opts.succes, 'ok');
      opts.onSuccess?.(r);
    },
    onError: (e) => toast(messageErreur(e), 'erreur'),
  });
}

export const post =
  <R = any>(url: string) =>
  (data: unknown) =>
    http.post<R>(url, data).then((r) => r.data);
export const put =
  <R = any>(url: string) =>
  (data: unknown) =>
    http.put<R>(url, data).then((r) => r.data);
export const del = (url: string) => () => http.delete(url).then((r) => r.data);

export function useMoi() {
  return useApi<Utilisateur>('/auth/me', undefined);
}

export function useParametres() {
  const q = useApi<Parametres>('/parametres');
  return { ...q, devise: q.data?.devise || 'FC' };
}

/**
 * Sites visibles et site choisi dans le menu.
 *  - tous : vue « Tous les sites » (consultation ; les opérations demandent de choisir un site)
 *  - changer(id | 'tous') : change de site et recharge toutes les données
 */
export function useSites() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useApi<InfosSites>('/sites');
  const d = q.data;
  const accessibles = d ? d.sites.filter((s) => d.accessibles.includes(s.id)) : [];
  const siteActif = d?.actif ? (d.sites.find((s) => s.id === d.actif) ?? null) : null;
  async function changer(site: number | 'tous') {
    try {
      await http.post('/sites/actif', { site });
      await qc.resetQueries();
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
  }
  return {
    ...q,
    sites: d?.sites ?? [],
    accessibles,
    siteActif,
    tous: !!d && !d.actif,
    peutTous: !!d?.peut_tous,
    changer,
  };
}
