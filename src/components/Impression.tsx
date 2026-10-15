'use client';
import type { ReactNode } from 'react';
import { bouton, cx } from './ui';

/**
 * Feuille au format imprimante thermique 58 mm (tickets, rapports de clôture).
 * Toujours noir sur blanc, quel que soit le thème de l'application.
 */
export function Feuille58({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white py-4 print:py-0">
      {/* Taille du papier : seule règle que Tailwind ne peut pas exprimer */}
      <style>{'@page { size: 58mm auto; margin: 0; }'}</style>
      <div className="mx-auto w-[58mm] bg-white px-[2mm] py-[4mm] font-mono text-xs text-black">
        <h2 className="text-center text-[15px] font-bold">{titre}</h2>
        {children}
      </div>
      <div className="flex justify-center gap-2 p-5 print:hidden">
        <button className={bouton('principal')} onClick={() => window.print()}>
          Imprimer
        </button>
        <button className={bouton()} onClick={() => window.close()}>
          Fermer
        </button>
      </div>
    </div>
  );
}

export function Ligne({ a, b, fort }: { a: ReactNode; b: ReactNode; fort?: boolean }) {
  return (
    <div className={cx('flex justify-between gap-2', fort && 'font-bold')}>
      <span>{a}</span>
      <span className="text-right">{b}</span>
    </div>
  );
}

export function Centre({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-center', className)}>{children}</div>;
}

export function Separateur() {
  return <hr className="my-2 border-0 border-t border-dashed border-black" />;
}
