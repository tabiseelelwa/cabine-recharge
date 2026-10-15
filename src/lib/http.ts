import axios, { AxiosError } from 'axios';

// Client HTTP du front : même origine, cookies de session inclus
export const http = axios.create({ baseURL: '/api', withCredentials: true, timeout: 20000 });

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/** Message lisible à partir d'une erreur axios */
export function messageErreur(e: unknown): string {
  const err = e as AxiosError<{ message?: string }>;
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'Le serveur met trop de temps à répondre';
  if (err?.message === 'Network Error') return 'Connexion au serveur impossible';
  return 'Une erreur est survenue';
}
