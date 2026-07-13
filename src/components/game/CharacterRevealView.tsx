/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { ROLES, getRoleInfo } from '../../core/avalon';
import type { Room, Player } from '../../types';
import { useSocket } from '../../context/SocketContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const CharacterRevealView = ({ room, me }: { room: Room; me?: Player }) => {
  const { t } = useTranslation();
  const socket = useSocket();
  const [revealed, setRevealed] = useState(false);
  const role = me?.role ? ROLES[me.role] : null;

  if (!role) return null;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 text-center">
      <h2 className="text-3xl font-['Cinzel'] text-[#ffd700]">{t('app.character.yourDestiny')}</h2>
      
      <Card className="relative overflow-hidden py-12 space-y-6">
        <div className={`space-y-6 transition-all duration-500 ${revealed ? 'blur-0' : 'blur-xl opacity-20'}`}>
          <div className="text-8xl">{role.icon}</div>
          <div className="space-y-2">
            <Badge team={role.team}>{role.team === 'good' ? t('app.character.loyalServant') : t('app.character.mordredServant')}</Badge>
            <h3 className="text-4xl font-['Cinzel'] font-bold">{me?.role ? getRoleInfo(me.role, t).name : ''}</h3>
          </div>
          <p className="text-gray-300 px-4">{me?.role ? getRoleInfo(me.role, t).description : ''}</p>
        </div>

        {!revealed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <Button onClick={() => setRevealed(true)} className="w-auto shadow-2xl">{t('app.character.reveal')}</Button>
          </div>
        )}
      </Card>

      {revealed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <p className="text-sm text-gray-400 italic">{t('app.character.memorize')}</p>
          <Button variant={me?.isConfirmed ? 'secondary' : 'primary'} onClick={() => socket.emit('confirm-character', { roomCode: room.code })}>
            {me?.isConfirmed ? t('app.character.waiting') : t('app.character.confirm')}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
