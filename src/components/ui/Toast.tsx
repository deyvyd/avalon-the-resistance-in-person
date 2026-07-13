/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

export const Toast = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    className="fixed bottom-4 left-4 right-4 z-modal-elevated flex justify-center pointer-events-none"
  >
    <div
      onClick={onDismiss}
      className="pointer-events-auto max-w-sm w-full bg-[#1b263b] border border-red-500/40 border-l-4 border-l-[#c0392b] rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 cursor-pointer"
    >
      <AlertTriangle size={18} className="text-[#c0392b] shrink-0" />
      <p className="text-sm text-white">{message}</p>
    </div>
  </motion.div>
);
