/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export const ConfirmModal = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-confirm flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d1b2a]/95 border-2 border-[#ffd700] rounded-2xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(255,215,0,0.2)] text-center space-y-4"
      >
        <h3 className="text-lg font-['Cinzel'] font-bold text-[#ffd700]">{title}</h3>
        <p className="text-sm text-gray-300">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {cancelLabel ?? t('app.common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className="flex-1">
            {confirmLabel ?? t('app.common.confirm')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
