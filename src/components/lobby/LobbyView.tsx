/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Shield,
  Skull,
  Sword,
  CheckCircle2,
  Crown,
  Info,
  Copy,
  LogOut,
  Droplets,
  Target,
  ChevronDown,
  ChevronUp,
  MapPinned,
  Book,
  SkipForward
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
// Manuais são texto estático grande — só baixa o chunk quando o jogador abre
const GameGuide = lazy(() => import('../game/GameGuide').then(m => ({ default: m.GameGuide })));
const GameManual = lazy(() => import('../game/GameManual').then(m => ({ default: m.GameManual })));
import { ROLES, TEAM_DISTRIBUTION, getRoleInfo } from '../../core/avalon';
import type { Room } from '../../types';
import { getPersistentId } from '../../lib/session';
import { useSocket } from '../../context/SocketContext';
import { useSettings } from '../../context/SettingsContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LancelotModal } from '../modals/LancelotModal';
import { MatchHistoryView } from './MatchHistoryView';

export const LobbyView = ({ room, isHost, onLeave }: { room: Room; isHost: boolean; onLeave: () => void }) => {
  const { t } = useTranslation();
  const socket = useSocket();
  const { showSettings } = useSettings();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [lancelotConfigId, setLancelotConfigId] = useState<string>('none');
  const [ladyOfLakeEnabled, setLadyOfLakeEnabled] = useState(false);
  const [excaliburEnabled, setExcaliburEnabled] = useState(false);
  const [targetingEnabled, setTargetingEnabled] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLancelotModal, setShowLancelotModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showOptionalRules, setShowOptionalRules] = useState(false);

  useEffect(() => {
    const handleOpenManual = () => setShowManual(true);
    const handleOpenGuide = () => setShowGuide(true);
    window.addEventListener('open-manual', handleOpenManual);
    window.addEventListener('open-guide', handleOpenGuide);
    return () => {
      window.removeEventListener('open-manual', handleOpenManual);
      window.removeEventListener('open-guide', handleOpenGuide);
    };
  }, []);
  const playerCount = room.players.length;
  const distribution = TEAM_DISTRIBUTION[playerCount] || { good: 0, evil: 0 };

  const selectedGood = selectedRoles.filter(r => ROLES[r].team === 'good');
  const selectedEvil = selectedRoles.filter(r => ROLES[r].team === 'evil');

  const goodSlots = distribution.good;
  const evilSlots = distribution.evil;

  const canSelectGood = selectedGood.length < goodSlots - 1; // -1 for Merlin
  const canSelectEvil = selectedEvil.length < evilSlots - 1; // -1 for Assassin

  const toggleRole = (roleId: string) => {
    if (!isHost) return;
    
    let newRoles = [...selectedRoles];
    if (newRoles.includes(roleId)) {
      if (roleId === 'lancelot_good' || roleId === 'lancelot_evil') {
        newRoles = newRoles.filter(r => r !== 'lancelot_good' && r !== 'lancelot_evil');
        setLancelotConfigId('none');
      } else {
        newRoles = newRoles.filter(r => r !== roleId);
      }
    } else {
      if (roleId === 'lancelot_good' || roleId === 'lancelot_evil') {
        if (!canSelectGood || !canSelectEvil) {
          // Check if we can select both
          const canBoth = (selectedGood.length < goodSlots - 1) && (selectedEvil.length < evilSlots - 1);
          if (!canBoth) return;
        }
        newRoles.push('lancelot_good', 'lancelot_evil');
        setShowLancelotModal(true);
      } else {
        const role = ROLES[roleId];
        if (role.team === 'good' && !canSelectGood) return;
        if (role.team === 'evil' && !canSelectEvil) return;
        newRoles.push(roleId);
      }
    }
    setSelectedRoles(newRoles);
  };

  const handleStart = () => {
    if (playerCount < 5) return alert(t('app.minPlayers'));
    socket.emit('start-game', {
      roomCode: room.code,
      selectedRoles,
      lancelotConfigId: lancelotConfigId === 'none' ? null : lancelotConfigId,
      ladyOfLakeEnabled,
      excaliburEnabled,
      targetingEnabled
    });
  };

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const newPlayers = [...room.players];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPlayers.length) return;
    
    [newPlayers[index], newPlayers[targetIndex]] = [newPlayers[targetIndex], newPlayers[index]];
    socket.emit('reorder-players', { roomCode: room.code, playerIds: newPlayers.map(p => p.id) });
  };

  const setFirstLeader = (playerId: string) => {
    socket.emit('set-first-leader', { roomCode: room.code, playerId: room.firstLeaderId === playerId ? null : playerId });
  };

  if (showHistory) {
    return <MatchHistoryView history={room.matchHistory} onBack={() => setShowHistory(false)} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <LancelotModal 
        isOpen={showLancelotModal} 
        onClose={() => {
          setShowLancelotModal(false);
          // Se fechou sem confirmar e não tinha config, remove os lancelots
          if (lancelotConfigId === 'none') {
            setSelectedRoles(prev => prev.filter(r => r !== 'lancelot_good' && r !== 'lancelot_evil'));
          }
        }}
        onConfirm={(configKey) => {
          setLancelotConfigId(configKey);
          setShowLancelotModal(false);
        }}
        initialConfig={lancelotConfigId === 'none' ? null : lancelotConfigId}
      />
      <div className="text-center space-y-2">
        <div className="flex justify-between items-center px-4">
          <div className="w-10"></div>
          <h2 className="text-sm uppercase tracking-widest text-gray-400 font-bold">{t('app.lobby.room')}</h2>
          {room.matchHistory.length > 0 ? (
            <button onClick={() => setShowHistory(true)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-[#ffd700]">
              <Info size={20} />
            </button>
          ) : <div className="w-10"></div>}
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-4">
            <span className="text-4xl font-mono font-bold text-[#ffd700]">{room.code}</span>
            <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10">
              <Copy size={20} />
            </button>
          </div>
          {isHost && (
            <div className="bg-white p-2 rounded-xl">
              <QRCodeSVG value={window.location.href} size={120} />
            </div>
          )}
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-['Cinzel'] text-xl text-[#ffd700]">{t('app.lobby.players', { count: playerCount })}</h3>
            {isHost && <p className="text-[10px] text-gray-400 uppercase tracking-widest">{t('app.lobby.setOrderHint')}</p>}
          </div>
          <Users size={20} className="text-gray-400" />
        </div>
        <div className="space-y-2">
          {room.players.map((p, index) => (
            <div key={p.id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 group">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.id === room.hostId ? 'bg-[#ffd700]' : 'bg-green-500'}`}></div>
                <span className="truncate font-bold">
                  {p.name}
                  {p.id === getPersistentId() && <span className="font-normal text-blue-300 ml-1">{t('app.me')}</span>}
                </span>
                {room.firstLeaderId === p.id && <Crown size={14} className="text-[#ffd700] flex-shrink-0" />}
              </div>
              
              {isHost && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setFirstLeader(p.id)}
                    className={`p-1.5 rounded-lg transition-colors ${room.firstLeaderId === p.id ? 'bg-[#ffd700] text-[#0d1b2a]' : 'hover:bg-white/10 text-gray-400'}`}
                    title={t('app.lobby.setFirstLeaderTitle')}
                  >
                    <Crown size={16} />
                  </button>
                  <div className="flex flex-col gap-0.5">
                    <button 
                      onClick={() => movePlayer(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-white/10 rounded disabled:opacity-20"
                    >
                      <SkipForward size={12} className="-rotate-90" />
                    </button>
                    <button 
                      onClick={() => movePlayer(index, 'down')}
                      disabled={index === room.players.length - 1}
                      className="p-1 hover:bg-white/10 rounded disabled:opacity-20"
                    >
                      <SkipForward size={12} className="rotate-90" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {isHost && playerCount >= 5 && (
        <div className="space-y-8">
          <div className="space-y-6">
            {/* Forças do Bem */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="font-['Cinzel'] text-lg text-[#3498db] flex items-center gap-2">
                  <Shield size={18} /> {t('app.lobby.forcesGood')} <span className="text-gray-400">{t('app.lobby.goodSlots', { count: goodSlots })}</span>
                </h3>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Mandatory and Generic Good */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-[#3498db] bg-[#3498db]/10 shadow-[0_0_10px_rgba(52,152,219,0.1)] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-white">🧙‍♂️ Merlin</span>
                        <span className="text-[8px] uppercase bg-[#ffd700] text-[#0d1b2a] px-1 rounded font-bold">{t('app.lobby.mandatory')}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">{t('app.lobby.merlinHint')}</p>
                    </div>
                  </div>
                  
                  {/* Servos de Arthur */}
                  <div className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                    (goodSlots - 1 - selectedGood.length) > 0 
                      ? 'border-[#3498db] bg-[#3498db]/10 shadow-[0_0_10px_rgba(52,152,219,0.1)]' 
                      : 'border-white/10 bg-white/5 opacity-60 grayscale'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-white">
                          🛡️ <span className={(goodSlots - 1 - selectedGood.length) > 0 ? 'text-[#ffd700]' : ''}>{goodSlots - 1 - selectedGood.length}</span> {goodSlots - 1 - selectedGood.length === 1 ? t('app.lobby.servantOne') : t('app.lobby.servantMany')} de Arthur
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">{t('app.lobby.fillsRemaining')}</p>
                    </div>
                  </div>
                </div>

                {/* Optional Good */}
                <div className="grid grid-cols-2 gap-3">
                  {['percival', 'lancelot_good'].map(roleId => {
                    const isSelected = selectedRoles.includes(roleId);
                    const disabled = !isSelected && !canSelectGood;
                    return (
                      <div
                        key={roleId}
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        onClick={() => !disabled && toggleRole(roleId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            !disabled && toggleRole(roleId);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1 cursor-pointer ${
                          isSelected 
                            ? 'border-[#3498db] bg-[#3498db]/10 shadow-[0_0_10px_rgba(52,152,219,0.1)]' 
                            : 'border-white/10 bg-white/5 opacity-60'
                        } ${disabled ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{ROLES[roleId].icon}</span>
                            <span className="font-bold text-sm">{getRoleInfo(roleId, t).name}</span>
                          </div>
                          {roleId === 'lancelot_good' && isSelected && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowLancelotModal(true); }}
                              className="p-1 hover:bg-white/10 rounded text-[#ffd700]"
                            >
                              <Sword size={12} />
                            </button>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-400 leading-tight h-6 overflow-hidden">{getRoleInfo(roleId, t).description}</p>
                        {roleId === 'lancelot_good' && isSelected && (
                          <div className="mt-1 text-[8px] text-[#ffd700] font-bold uppercase tracking-tighter flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-[#ffd700]" />
                            {lancelotConfigId === 'none' ? t('app.lobby.configure') : lancelotConfigId.toUpperCase().replace('_', ' + ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Forças do Mal */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="font-['Cinzel'] text-lg text-[#c0392b] flex items-center gap-2">
                  <Skull size={18} /> {t('app.lobby.forcesBad')} <span className="text-gray-400">{t('app.lobby.badSlots', { count: evilSlots })}</span>
                </h3>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Mandatory and Generic Evil */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-red-500/50 bg-red-500/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">💀 {t('roles.assassin.name')}</span>
                        <span className="text-[8px] uppercase bg-[#ffd700] text-[#0d1b2a] px-1 rounded font-bold">{t('app.lobby.mandatory')}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">{t('app.lobby.assassinHint')}</p>
                    </div>
                  </div>
                  
                  {/* Minions de Mordred */}
                  <div className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                    (evilSlots - 1 - selectedEvil.length) > 0 
                      ? 'border-[#c0392b] bg-[#c0392b]/10 shadow-[0_0_10px_rgba(192,57,43,0.1)]' 
                      : 'border-white/10 bg-white/5 opacity-60 grayscale'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-white">
                          🗡️ <span className={(evilSlots - 1 - selectedEvil.length) > 0 ? 'text-[#ffd700]' : ''}>{evilSlots - 1 - selectedEvil.length}</span> {evilSlots - 1 - selectedEvil.length === 1 ? t('app.lobby.minionOne') : t('app.lobby.minionMany')} de Mordred
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">{t('app.lobby.fillsRemaining')}</p>
                    </div>
                  </div>
                </div>

                {/* Optional Evil */}
                <div className="grid grid-cols-2 gap-3">
                  {['morgana', 'mordred', 'oberon', 'lancelot_evil'].map(roleId => {
                    const isSelected = selectedRoles.includes(roleId);
                    const disabled = !isSelected && !canSelectEvil;
                    return (
                      <div
                        key={roleId}
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        onClick={() => !disabled && toggleRole(roleId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            !disabled && toggleRole(roleId);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1 cursor-pointer ${
                          isSelected 
                            ? 'border-red-500 bg-red-500/10' 
                            : 'border-white/10 bg-white/5 opacity-60'
                        } ${disabled ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{ROLES[roleId].icon}</span>
                            <span className="font-bold text-sm">{getRoleInfo(roleId, t).name}</span>
                          </div>
                          {roleId === 'lancelot_evil' && isSelected && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowLancelotModal(true); }}
                              className="p-1 hover:bg-white/10 rounded text-[#ffd700]"
                            >
                              <Sword size={12} />
                            </button>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-400 leading-tight h-6 overflow-hidden">{getRoleInfo(roleId, t).description}</p>
                        {roleId === 'lancelot_evil' && isSelected && (
                          <div className="mt-1 text-[8px] text-[#ffd700] font-bold uppercase tracking-tighter flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-[#ffd700]" />
                            {lancelotConfigId === 'none' ? t('app.lobby.configure') : lancelotConfigId.toUpperCase().replace('_', ' + ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Regras Opcionais */}
            <div className="space-y-2">
              <button 
                onClick={() => setShowOptionalRules(!showOptionalRules)}
                className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-2 group-hover:text-gray-300 transition-colors">{t('app.lobby.optionalRules')}</h3>
                <div className="flex items-center gap-2">
                  {!showOptionalRules && (ladyOfLakeEnabled || excaliburEnabled || targetingEnabled) && (
                    <span className="text-[10px] bg-[#ffd700]/20 text-[#ffd700] px-2 py-0.5 rounded-full font-bold">
                      {t('app.lobby.activeCount', { count: (ladyOfLakeEnabled ? 1 : 0) + (excaliburEnabled ? 1 : 0) + (targetingEnabled ? 1 : 0) })}
                    </span>
                  )}
                  {showOptionalRules ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>
              
              <AnimatePresence>
                {showOptionalRules && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-3 px-2 pb-2"
                  >
                    {/* Lady of the Lake */}
                    <button 
                      onClick={() => setLadyOfLakeEnabled(!ladyOfLakeEnabled)}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        ladyOfLakeEnabled ? 'border-[#ffd700] bg-[#ffd700]/10' : 'border-white/5 bg-[#1b263b] opacity-60'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${ladyOfLakeEnabled ? 'bg-[#ffd700]/20 text-[#ffd700]' : 'bg-white/5 text-gray-400'}`}>
                        <Droplets size={24} />
                      </div>
                      <div className="text-left flex-1">
                        <span className="font-['Cinzel'] font-bold text-sm block">{t('app.lobby.ladyOfLake')}</span>
                        <p className="text-[10px] text-gray-400">{t('app.lobby.ladyOfLakeDesc')}</p>
                      </div>
                      {ladyOfLakeEnabled && <CheckCircle2 size={16} className="text-[#ffd700]" />}
                    </button>

                    {/* Excalibur */}
                    <button 
                      onClick={() => setExcaliburEnabled(!excaliburEnabled)}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        excaliburEnabled ? 'border-[#ffd700] bg-[#ffd700]/10' : 'border-white/5 bg-[#1b263b] opacity-60'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${excaliburEnabled ? 'bg-[#ffd700]/20 text-[#ffd700]' : 'bg-white/5 text-gray-400'}`}>
                        <Sword size={24} />
                      </div>
                      <div className="text-left flex-1">
                        <span className="font-['Cinzel'] font-bold text-sm block">{t('app.lobby.excalibur')}</span>
                        <p className="text-[10px] text-gray-400">{t('app.lobby.excaliburDesc')}</p>
                      </div>
                      {excaliburEnabled && <CheckCircle2 size={16} className="text-[#ffd700]" />}
                    </button>

                    {/* Targeting (Missão Alvo) */}
                    <button 
                      onClick={() => setTargetingEnabled(!targetingEnabled)}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        targetingEnabled ? 'border-[#ffd700] bg-[#ffd700]/10' : 'border-white/5 bg-[#1b263b] opacity-60'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${targetingEnabled ? 'bg-[#ffd700]/20 text-[#ffd700]' : 'bg-white/5 text-gray-400'}`}>
                        <Target size={24} />
                      </div>
                      <div className="text-left flex-1">
                        <span className="font-['Cinzel'] font-bold text-sm block">{t('app.lobby.targetMission')}</span>
                        <p className="text-[10px] text-gray-400">{t('app.lobby.targetMissionDesc')}</p>
                      </div>
                      {targetingEnabled && <CheckCircle2 size={16} className="text-[#ffd700]" />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <Button onClick={handleStart} className="shadow-[0_0_20px_rgba(255,215,0,0.2)]">
            {t('app.lobby.sortCharacters')}
          </Button>
        </div>
      )}

      {(playerCount < 5 || !isHost) && (
        <div className="text-center p-8 border-2 border-dashed border-white/10 rounded-2xl">
          <p className="text-gray-400 italic">
            {playerCount < 5
              ? t('app.lobby.waitingPlayers')
              : t('app.lobby.waitingHost')}
          </p>
        </div>
      )}

      <button
        onClick={onLeave}
        className="w-full py-3 px-4 rounded-xl border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest"
      >
        <LogOut size={16} />
        {t('app.leaveRoom')}
      </button>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col sm:flex-row gap-3">
        <button 
          onClick={() => setShowManual(true)}
          className="p-4 rounded-full bg-[#0d1b2a]/80 backdrop-blur-md border border-[#ffd700] text-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.2)] hover:scale-110 transition-all flex items-center gap-2 font-bold text-sm font-['Cinzel']"
        >
          <Book size={20} />
          <span className="hidden sm:inline">{t('app.lobby.manual')}</span>
        </button>

        <button 
          onClick={() => setShowGuide(true)}
          className="p-4 rounded-full bg-[#0d1b2a]/80 backdrop-blur-md border border-[#ffd700] text-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.2)] hover:scale-110 transition-all flex items-center gap-2 font-bold text-sm font-['Cinzel']"
        >
          <MapPinned size={20} />
          <span className="hidden sm:inline">{t('app.lobby.guide')}</span>
        </button>
      </div>

      {showGuide && (
        <Suspense fallback={null}>
          <GameGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
        </Suspense>
      )}
      {showManual && (
        <Suspense fallback={null}>
          <GameManual isOpen={showManual} onClose={() => setShowManual(false)} />
        </Suspense>
      )}
    </motion.div>
  );
};
