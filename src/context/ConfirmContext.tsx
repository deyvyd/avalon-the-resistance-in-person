/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
  return context.confirm;
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [current, setCurrent] = useState<PendingConfirm | null>(null);
  // Fila simples: se um confirm já está visível, o próximo pedido aguarda em
  // vez de sobrepor o modal atual. Não há hoje um fluxo que dispare 2 confirms
  // seguidos, mas isso evita perder um pedido caso aconteça.
  const queueRef = useRef<PendingConfirm[]>([]);
  const showingRef = useRef(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const request: PendingConfirm = { ...options, resolve };
      if (showingRef.current) {
        queueRef.current.push(request);
      } else {
        showingRef.current = true;
        setCurrent(request);
      }
    });
  }, []);

  const resolveCurrent = (value: boolean) => {
    current?.resolve(value);
    const next = queueRef.current.shift() ?? null;
    showingRef.current = next !== null;
    setCurrent(next);
  };

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {current && (
          <ConfirmModal
            title={current.title}
            message={current.message}
            confirmLabel={current.confirmLabel}
            cancelLabel={current.cancelLabel}
            danger={current.danger}
            onConfirm={() => resolveCurrent(true)}
            onCancel={() => resolveCurrent(false)}
          />
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};
