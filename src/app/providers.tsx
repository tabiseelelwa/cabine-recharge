'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { ToastProvider } from '@/components/ui';
import { useServiceWorker } from '@/components/Preferences';

export default function Providers({ children }: { children: ReactNode }) {
  useServiceWorker();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: (n, e: any) => n < 2 && ![401, 403, 404].includes(e?.response?.status),
            refetchOnWindowFocus: true,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
