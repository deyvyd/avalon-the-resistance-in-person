/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { Toast } from '../components/ui/Toast';

const TOAST_DURATION_MS = 3500;

interface ToastContextValue {
  error: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setMessage(null);
  }, []);

  // Slot único: nova chamada substitui a mensagem atual e reseta o timer —
  // todos os casos de uso hoje são erros de ação do próprio jogador, nunca
  // dois simultâneos, então não há necessidade de fila.
  const error = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(dismiss, TOAST_DURATION_MS);
  }, [dismiss]);

  const value = useMemo(() => ({ error }), [error]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {message && <Toast message={message} onDismiss={dismiss} />}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};
