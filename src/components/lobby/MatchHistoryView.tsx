/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { SkipBack } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { getRoleInfo } from '../../core/avalon';
import type { MatchRecord } from '../../types';

export const MatchHistoryView = ({ history, onBack }: { history: MatchRecord[]; onBack: () => void }) => {
  const { t } = useTranslation();
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg">
          <SkipBack size={24} />
        </button>
        <h2 className="text-2xl font-['Cinzel'] text-[#ffd700]">{t('app.lobby.history')}</h2>
      </div>

      <div className="space-y-4">
        {history.map((match) => (
          <div key={match.id}>
            <Card className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="text-xs text-gray-400 font-mono">{new Date(match.timestamp).toLocaleString('pt-BR')}</div>
              <Badge team={match.winner}>{match.winner === 'good' ? t('app.lobby.goodWin') : t('app.lobby.evilWin')}</Badge>
            </div>
            
            <div className="grid grid-cols-5 gap-1">
              {match.missions.map((m, i) => (
                <div key={i} className={`h-2 rounded-full ${m.status === 'success' ? 'bg-[#3498db]' : m.status === 'fail' ? 'bg-[#c0392b]' : 'bg-gray-700'}`}></div>
              ))}
            </div>

            <p className="text-sm font-bold">{match.reason}</p>
            
            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex flex-wrap gap-1">
                {match.players.map((p, i) => (
                  <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded border ${p.team === 'good' ? 'border-[#3498db]/30 text-[#3498db]' : 'border-[#c0392b]/30 text-[#c0392b]'}`}>
                    {p.name} ({getRoleInfo(p.role, t).name})
                  </span>
                ))}
              </div>
              <div className="text-[9px] text-gray-400 uppercase tracking-widest">
                {t('app.lobby.durationLabel', { minutes: Math.floor(match.duration / 60), seconds: match.duration % 60, count: match.playerCount })}
              </div>
            </div>
          </Card>
        </div>
      ))}
      </div>
    </motion.div>
  );
};
