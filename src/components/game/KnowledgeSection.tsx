/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useTranslation } from 'react-i18next';
import type { Room, Player } from '../../types';
import { Badge } from '../ui/Badge';

export const KnowledgeSection = ({ room, me }: { room: Room; me: Player }) => {
  const { t } = useTranslation();
  if (!room.knowledge || room.knowledge.length === 0) return null;

  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name ?? '?';
  const iconFor = (hint: string) =>
    hint === 'lancelot' ? '⚔️' : hint === 'maybe-merlin' ? '🧙‍♂️' : me.role === 'merlin' ? '💀' : '🗡️';

  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
      <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{t('app.game.acquiredKnowledge')}</h3>
      <div className="grid grid-cols-1 gap-2">
        {room.knowledge.map((k, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-black/20 rounded-lg border border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-xl">{iconFor(k.hint)}</span>
              <p className="text-xs font-bold text-white">{nameOf(k.playerId)}</p>
            </div>
            <div className="flex gap-1 items-center">
              {k.hint === 'maybe-merlin' ? (
                <Badge variant="purple">{t('app.game.merlinMaybe')}</Badge>
              ) : (
                <>
                  {k.hint === 'lancelot' && <span className="text-[10px] text-gray-400 font-bold mr-1">{t('app.game.lancelotLabel')}</span>}
                  <Badge team={k.team}>{k.team === 'good' ? t('app.game.good') : t('app.game.evil')}</Badge>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
