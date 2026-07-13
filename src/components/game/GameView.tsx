/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Crown,
  Info,
  LogOut,
  Eye,
  EyeOff,
  RefreshCw,
  Equal
} from 'lucide-react';
import { ROLES, needsTwoFails, getRoleInfo } from '../../core/avalon';
import type { Room, Player } from '../../types';
import { getPersistentId } from '../../lib/session';
import { useSocket } from '../../context/SocketContext';
import { useSettings } from '../../context/SettingsContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { KnowledgeSection } from './KnowledgeSection';

export const GameView = ({ room, me, isHost, onLeave }: { room: Room; me?: Player; isHost: boolean; onLeave: () => void }) => {
  const { t } = useTranslation();
  const socket = useSocket();
  const { showSettings } = useSettings();
  const playerId = getPersistentId();
  const currentMission = room.missions[room.currentMissionIndex];
  const leader = room.players[room.currentLeaderIndex];
  const isLeader = playerId === leader?.id;
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [targetMissionIndex, setTargetMissionIndex] = useState<number | null>(null);
  const [ladyResult, setLadyResult] = useState<{ targetName: string; loyalty: 'good' | 'evil' } | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  const isLancelot = me?.role?.includes('lancelot');
  const currentTeam = (me?.role && room.lancelotLoyalty && isLancelot)
    ? (me.role === 'lancelot_good' ? room.lancelotLoyalty.lancelotGoodTeam : room.lancelotLoyalty.lancelotEvilTeam)
    : (me?.role ? ROLES[me.role].team : 'good');

  useEffect(() => {
    setShowSecrets(false);
  }, [room.phase, room.currentMissionIndex, room.currentLeaderIndex]);

  useEffect(() => {
    const handleLadyResult = ({ holderPlayerId, targetPlayerId, loyalty }: any) => {
      if (holderPlayerId === playerId) {
        const target = room.players.find(p => p.id === targetPlayerId);
        if (target) {
          setLadyResult({ targetName: target.name, loyalty });
        }
      }
    };

    socket.on('lady-result', handleLadyResult);
    return () => {
      socket.off('lady-result', handleLadyResult);
    };
  }, [socket, playerId, room.players]);

  useEffect(() => {
    if (room.phase === 'team-proposal') {
      setSelectedTeam([]);
      setTargetMissionIndex(null);
      setLadyResult(null);
    }
  }, [room.phase, room.currentLeaderIndex]);

  const formatName = (p: Player, showCrown = true) => (
    <span className="inline-flex items-center gap-1">
      <span className={!p.socketId ? 'opacity-40 grayscale' : ''}>
        {p.name}
        {p.id === playerId && <span className="font-normal text-blue-300 ml-1">{t('app.me')}</span>}
        {!p.socketId && <span className="text-[8px] ml-1 text-red-400 uppercase font-bold">{t('app.offline')}</span>}
      </span>
      {showCrown && p.id === leader?.id && <Crown size={14} className="text-[#ffd700] shrink-0" />}
    </span>
  );

  const handlePropose = () => {
    const missionIndex = room.targetingEnabled ? targetMissionIndex : room.currentMissionIndex;
    if (missionIndex === null) return alert(t('app.selectMission'));
    const missionSize = room.missions[missionIndex].size;
    if (selectedTeam.length !== missionSize) return alert(t('app.selectExactPlayers', { count: missionSize }));
    socket.emit('propose-team', { roomCode: room.code, teamPlayerIds: selectedTeam, targetMissionIndex: missionIndex });
  };

  const handleVoteTeam = (vote: 'approve' | 'reject') => {
    socket.emit('vote-team', { roomCode: room.code, vote });
  };

  const handleVoteMission = (vote: 'success' | 'fail') => {
    socket.emit('vote-mission', { roomCode: room.code, vote });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs uppercase tracking-widest text-gray-400 font-bold">{t('app.game.currentMission')}</h2>
            <button 
              onClick={onLeave}
              className="p-1 text-gray-600 hover:text-red-400 transition-colors"
              title={t('app.leaveRoom')}
            >
              <LogOut size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            {room.missions.map((m, i) => (
              <div 
                key={i} 
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${
                  m.status === 'success' ? 'bg-blue-600 border-blue-400' :
                  m.status === 'fail' ? 'bg-red-600 border-red-400' :
                  // Com targeting, currentMissionIndex só é preciso após a proposta —
                  // antes disso ainda guarda a última missão tentada
                  i === room.currentMissionIndex && !(room.targetingEnabled && room.phase === 'team-proposal') ? 'bg-[#ffd700] text-[#0d1b2a] border-white' :
                  'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {m.size}{needsTwoFails(i, room.players.length) ? '*' : ''}
              </div>
            ))}
          </div>
        </div>
        <div className="text-right space-y-1">
          <h2 className="text-xs uppercase tracking-widest text-gray-400 font-bold">{t('app.game.rejections')}</h2>
          <div className="flex gap-1 justify-end">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full ${i <= room.rejectionCount ? 'bg-red-500' : 'bg-white/10'}`}></div>
            ))}
          </div>
        </div>
      </div>

      {/* Lancelot Loyalty Deck */}
      {room.lancelotConfig && room.lancelotConfig.variant !== 'var3' && room.phase !== 'game-over' && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-purple-400" />
              <h3 className="text-[10px] uppercase tracking-widest text-purple-400 font-bold">{t('app.game.loyaltyDeck')}</h3>
            </div>
            <span className="text-[9px] text-gray-400 font-mono">
              {room.lancelotConfig.variant.toUpperCase()} • INÍCIO: R{room.lancelotConfig.startsAt}
            </span>
          </div>
          <div className="flex gap-2 justify-center">
            {room.loyaltyDeckVisible.map((card, i) => {
              const isActive = i === room.loyaltyDeckIndex - 1;
              return (
                <div 
                  key={i}
                  className={`w-12 h-16 rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-500 ${
                    card === 'hidden' 
                      ? 'bg-gray-800 border-gray-700' 
                      : card === 'switch' 
                        ? 'bg-orange-600 border-orange-400' 
                        : 'bg-gray-700/50 border-gray-600/50'
                  } ${isActive 
                    ? 'scale-110 z-10 shadow-[0_0_20px_rgba(168,85,247,0.8)] border-purple-400 ring-2 ring-purple-400/50' 
                    : 'opacity-40 grayscale-[0.3]'
                  }`}
                >
                  {card === 'hidden' ? (
                    <span className="text-gray-600 font-black text-xl">?</span>
                  ) : (
                    <>
                      <span className={`text-[8px] font-bold mb-0.5 ${isActive ? 'text-white' : 'text-white/30'}`}>R{room.lancelotConfig!.startsAt + i}</span>
                      {card === 'switch' ? (
                        <RefreshCw size={14} className={`${isActive ? 'text-white' : 'text-white/40'} mb-1`} />
                      ) : (
                        <Equal size={14} className={`${isActive ? 'text-white' : 'text-white/20'} mb-1`} />
                      )}
                      <span className={`text-[9px] font-black text-center px-1 leading-tight ${isActive ? 'text-white' : 'text-white/30'}`}>
                        {card === 'switch' ? t('app.game.cardSwitch') : t('app.game.cardSame')}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <Card className="space-y-6">
        {ladyResult && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center space-y-2">
            <h4 className="text-xs uppercase tracking-widest text-[#ffd700] font-bold">{t('app.game.investigationResult')}</h4>
            {/* Trans em vez de dangerouslySetInnerHTML: nome vem do jogador (XSS) */}
            <p className="text-sm">
              <Trans i18nKey="app.game.investigationIs" values={{ name: ladyResult.targetName }} components={{ b: <b /> }} />
            </p>
            <Badge team={ladyResult.loyalty}>{ladyResult.loyalty === 'good' ? t('app.game.loyal') : t('app.game.disloyal')}</Badge>
          </div>
        )}

        {room.lancelotLoyalty?.swapOccurred && room.phase !== 'game-over' && (
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl text-center animate-pulse">
            <p className="text-xs uppercase tracking-widest text-purple-400 font-bold">{t('app.game.loyaltySwapAlert')}</p>
            <p className="text-[10px] text-gray-400">{t('app.game.loyaltySwapDesc')}</p>
          </div>
        )}

        {room.phase === 'team-proposal' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <Crown className="mx-auto text-[#ffd700]" size={32} />
              <h3 className="text-2xl font-['Cinzel'] flex items-center justify-center gap-2">
                {isLeader ? t('app.game.leaderRound') : <>{formatName(leader, false)} {t('app.game.leaderRoundOther', { name: '' }).trimStart()}</>}
              </h3>
              <p className="text-gray-400">
                {isLeader
                  ? t('app.game.chooseTeam', { count: currentMission.size })
                  : t('app.game.waitingTeam')}
              </p>
            </div>

            {isLeader ? (
              <div className="space-y-4">
                {room.targetingEnabled && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">{t('app.game.selectMissionLabel')}</p>
                    <div className="flex justify-center gap-2">
                      {room.missions.map((m, i) => {
                        const isAttempted = room.attemptedMissions.includes(i);
                        const isSelected = targetMissionIndex === i;
                        return (
                          <button
                            key={i}
                            disabled={isAttempted}
                            onClick={() => setTargetMissionIndex(i)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${
                              isAttempted ? 'bg-gray-800 border-gray-700 text-gray-600 opacity-40' :
                              isSelected ? 'bg-[#ffd700] text-[#0d1b2a] border-white scale-110' :
                              'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                            }`}
                          >
                            {m.size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {room.players.map(p => {
                    const missionIndex = room.targetingEnabled ? targetMissionIndex : room.currentMissionIndex;
                    const missionSize = missionIndex !== null ? room.missions[missionIndex].size : 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedTeam(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : prev.length < missionSize ? [...prev, p.id] : prev)}
                        className={`p-3 rounded-xl border-2 transition-all font-bold ${
                          selectedTeam.includes(p.id) ? 'border-[#ffd700] bg-[#ffd700]/10' : 'border-white/5 bg-white/5'
                        }`}
                      >
                        {formatName(p)}
                      </button>
                    );
                  })}
                </div>
                <Button onClick={handlePropose} disabled={selectedTeam.length === 0 || (room.targetingEnabled && targetMissionIndex === null)}>{t('app.game.confirmTeam')}</Button>

                {room.excaliburEnabled && !room.excaliburUsed && (
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">{t('app.game.excaliburAssign')}</p>
                    {selectedTeam.length === 0 ? (
                      <p className="text-[10px] text-gray-500 italic">{t('app.game.excaliburSelectTeamFirst')}</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {/* Regra oficial: portador precisa estar na equipe da missão */}
                        {room.players.filter(p => p.id !== playerId && selectedTeam.includes(p.id)).map(p => (
                          <button
                            key={p.id}
                            onClick={() => socket.emit('assign-excalibur', { roomCode: room.code, targetPlayerId: p.id, teamPlayerIds: selectedTeam })}
                            className={`p-2 rounded-lg border transition-all text-xs font-bold ${
                              room.excaliburHolder === p.id ? 'border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700]' : 'border-white/10 bg-white/5 text-gray-400'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 italic">{t('app.game.excaliburHint')}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 animate-pulse text-gray-400 italic">{t('app.game.waitingFormation')}</div>
            )}
          </div>
        )}

        {room.phase === 'team-voting' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-2xl font-['Cinzel']">{t('app.game.teamVote')}</h3>
              <div className="flex flex-wrap justify-center gap-2">
                {room.proposedTeam.map(id => (
                  <span key={id} className="bg-[#ffd700]/20 text-[#ffd700] px-3 py-1 rounded-full text-sm font-bold">
                    {room.players.find(p => p.id === id) ? formatName(room.players.find(p => p.id === id)!) : ''}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {room.hasVotedTeam ? (
                <div className="py-8 space-y-4">
                  <p className="text-gray-400 italic">{t('app.game.youVoted')}</p>
                  <p className="text-sm text-gray-400">{t('app.game.waitingPlayers', { voted: room.teamVotesCount, total: room.players.length })}</p>
                </div>
              ) : (
                <div className="flex gap-4">
                  <Button variant="danger" onClick={() => handleVoteTeam('reject')} className="flex-1">{t('app.game.reject')}</Button>
                  <Button onClick={() => handleVoteTeam('approve')} className="flex-1">{t('app.game.approve')}</Button>
                </div>
              )}

              {isHost && room.teamVotesCount === room.players.length && (
                <div className="py-4 animate-pulse text-[#ffd700] italic">{t('app.game.revealingVotes')}</div>
              )}
            </div>
          </div>
        )}

        {room.phase === 'mission-voting' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-2xl font-['Cinzel']">{t('app.game.onMission')}</h3>
              <p className="text-xs text-gray-400 uppercase tracking-widest">{t('app.game.missionTeamVotes')}</p>
              <div className="flex flex-wrap justify-center gap-1 max-w-xs mx-auto">
                {room.players.map(p => (
                  <div key={p.id} className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1 ${
                    room.lastTeamVoteResult?.votes[p.id] === 'approve' 
                      ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                      : 'bg-red-500/10 border-red-500/30 text-red-500'
                  }`}>
                    {formatName(p)}: {room.lastTeamVoteResult?.votes[p.id] === 'approve' ? t('app.game.yes') : t('app.game.no')}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {room.proposedTeam.includes(playerId || '') ? (
                room.hasVotedMission ? (
                  <div className="py-8 space-y-4">
                    <p className="text-gray-400 italic">{t('app.game.youActed')}</p>
                    <p className="text-sm text-gray-400">{t('app.game.waitingTeamVotes', { voted: room.missionVotesCount, total: room.proposedTeam.length })}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-400">{t('app.game.chooseMissionFate')}</p>
                    <div className="flex gap-4">
                      {(!isLancelot || !room.lancelotConfig?.mandatory || currentTeam === 'good') && (
                        <Button onClick={() => handleVoteMission('success')} className="flex-1 bg-blue-600 hover:bg-blue-500">{t('app.game.success')}</Button>
                      )}
                      {currentTeam === 'evil' && (
                        <Button variant="danger" onClick={() => handleVoteMission('fail')} className="flex-1">{t('app.game.fail')}</Button>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="py-8 space-y-4">
                  <p className="text-gray-400 italic">{t('app.game.teamOnMission')}</p>
                  <p className="text-sm text-gray-400">{t('app.game.waitingResults', { voted: room.missionVotesCount, total: room.proposedTeam.length })}</p>
                </div>
              )}

              {isHost && room.missionVotesCount === room.proposedTeam.length && (
                <div className="py-4 animate-pulse text-[#ffd700] italic">{t('app.game.revealingResult')}</div>
              )}
            </div>
          </div>
        )}

        {room.phase === 'team-result' && room.lastTeamVoteResult && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className={`text-4xl font-['Cinzel'] ${room.lastTeamVoteResult.passed ? 'text-green-500' : 'text-red-500'}`}>
                {room.lastTeamVoteResult.passed ? t('app.game.teamApproved') : t('app.game.teamRejected')}
              </h3>
              <p className="text-gray-400">{t('app.game.individualVotes')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
              {room.players.map(p => (
                <div key={p.id} className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/10 shadow-lg">
                  <span className="font-bold text-lg mb-2 truncate w-full">{formatName(p)}</span>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-tighter ${
                    room.lastTeamVoteResult?.votes[p.id] === 'approve' 
                      ? 'bg-green-500/20 text-green-500 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-500 border border-red-500/30'
                  }`}>
                    {room.lastTeamVoteResult?.votes[p.id] === 'approve' ? (
                      <><CheckCircle2 size={14} /> {t('app.game.approved')}</>
                    ) : (
                      <><XCircle size={14} /> {t('app.game.rejected')}</>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isHost && (
              <Button onClick={() => socket.emit('continue-game', { roomCode: room.code })}>{t('app.game.continue')}</Button>
            )}
          </div>
        )}

        {room.phase === 'excalibur-usage' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-2xl font-['Cinzel'] text-[#ffd700]">{t('app.game.excaliburTitle')}</h3>
              <p className="text-gray-400">
                {room.excaliburHolder === playerId
                  ? t('app.game.excaliburYouHave')
                  : t('app.game.excaliburOtherDeciding', { name: room.players.find(p => p.id === room.excaliburHolder)?.name })}
              </p>
            </div>

            {room.excaliburHolder === playerId ? (
              <div className="space-y-4">
                <p className="text-sm font-bold">{t('app.game.excaliburChoosePlayer')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {/* Excalibur não pode inverter o próprio voto */}
                  {room.proposedTeam.filter(id => id !== playerId).map(id => (
                    <div key={id}>
                    <Button
                      variant="outline"
                      onClick={() => socket.emit('use-excalibur', { roomCode: room.code, targetPlayerId: id })}
                    >
                      {room.players.find(p => p.id === id)?.name}
                    </Button>
                    </div>
                  ))}
                </div>
                <Button variant="secondary" onClick={() => socket.emit('skip-excalibur', { roomCode: room.code })}>{t('app.game.skipUse')}</Button>
              </div>
            ) : (
              <div className="py-8 animate-pulse text-[#ffd700] italic">{t('app.game.waitingExcalibur')}</div>
            )}
          </div>
        )}

        {room.phase === 'mission-result' && room.lastMissionVoteResult && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className={`text-3xl font-['Cinzel'] ${room.lastMissionVoteResult.passed ? 'text-blue-500' : 'text-red-500'}`}>
                {room.lastMissionVoteResult.passed ? t('app.game.missionSucceeded') : t('app.game.missionFailed')}
              </h3>
              <p className="text-gray-400">{t('app.game.anonymousVotes')}</p>
            </div>

            {room.excaliburUsed && room.excaliburTarget && (
              <div className="p-3 bg-[#ffd700]/10 border border-[#ffd700]/30 rounded-xl max-w-xs mx-auto space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-[#ffd700] font-bold">{t('app.game.excaliburUsed')}</p>
                <p className="text-xs">
                  <Trans i18nKey="app.game.excaliburRevealVote" values={{ name: room.players.find(p => p.id === room.excaliburTarget)?.name }} components={{ b: <b /> }} />
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">{room.excaliburReveal === 'success' ? '🏆' : '💣'}</span>
                  <span className={`font-bold ${room.excaliburReveal === 'success' ? 'text-blue-400' : 'text-red-400'}`}>
                    {room.excaliburReveal === 'success' ? 'SUCESSO' : 'FALHA'}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 italic">{t('app.game.excaliburVoteInverted')}</p>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <div className="flex flex-col items-center p-6 bg-blue-600/20 rounded-2xl border-2 border-blue-600/50 w-32">
                <span className="text-4xl mb-2">🏆</span>
                <span className="text-3xl font-bold">{room.lastMissionVoteResult.votes.filter(v => v === 'success').length}</span>
                <span className="text-xs uppercase tracking-widest opacity-60">{t('app.game.successCount')}</span>
              </div>
              <div className="flex flex-col items-center p-6 bg-red-600/20 rounded-2xl border-2 border-red-600/50 w-32">
                <span className="text-4xl mb-2">💣</span>
                <span className="text-3xl font-bold">{room.lastMissionVoteResult.votes.filter(v => v === 'fail').length}</span>
                <span className="text-xs uppercase tracking-widest opacity-60">{t('app.game.failCount')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-widest">{t('app.game.recallTeamVotes')}</p>
              <div className="flex flex-wrap justify-center gap-1 max-w-xs mx-auto">
                {room.players.map(p => (
                  <div key={p.id} className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1 ${
                    room.lastTeamVoteResult?.votes[p.id] === 'approve' 
                      ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                      : 'bg-red-500/10 border-red-500/30 text-red-500'
                  }`}>
                    {formatName(p)}: {room.lastTeamVoteResult?.votes[p.id] === 'approve' ? t('app.game.yes') : t('app.game.no')}
                  </div>
                ))}
              </div>
            </div>

            {isHost && (
              <Button onClick={() => socket.emit('continue-game', { roomCode: room.code })}>{t('app.game.continue')}</Button>
            )}
          </div>
        )}

        {room.phase === 'lady-of-the-lake' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-2xl font-['Cinzel'] text-[#ffd700]">{t('app.game.ladyOfLake')}</h3>
              <p className="text-gray-400">
                {room.ladyOfLakeHolder === playerId
                  ? t('app.game.ladyYouAre')
                  : t('app.game.ladyOtherInvestigating', { name: room.players.find(p => p.id === room.ladyOfLakeHolder)?.name })}
              </p>
            </div>

            {room.ladyOfLakeHolder === playerId ? (
              <div className="space-y-4">
                <p className="text-sm font-bold">{t('app.game.ladyChoosePlayer')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {room.players.filter(p => p.id !== playerId && !room.ladyOfLakeUsed.includes(p.id)).map(p => (
                    <div key={p.id}>
                    <Button
                      variant="outline"
                      onClick={() => socket.emit('lady-examine', { roomCode: room.code, targetPlayerId: p.id })}
                    >
                      {p.name}
                    </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 animate-pulse text-[#ffd700] italic">{t('app.game.waitingLady')}</div>
            )}
          </div>
        )}

        {room.phase === 'assassination' && (
          <div className="space-y-6 text-center">
            <h3 className="text-2xl font-['Cinzel'] text-red-500">{t('app.game.assassinationPhase')}</h3>
            
            {me?.role && ROLES[me.role].team === 'evil' ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
                <p className="text-red-400 font-bold flex items-center justify-center gap-2 uppercase tracking-widest">
                  <Users size={18} /> {t('app.game.evilMeeting')}
                </p>
                <p className="text-sm text-gray-300">
                  {t('app.game.evilMeetingDesc')}
                </p>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
                <p className="text-red-400 font-bold flex items-center justify-center gap-2 uppercase tracking-widest">
                  <Info size={18} /> {t('app.game.goodWarning')}
                </p>
                <p className="text-sm text-gray-300">
                  {t('app.game.goodWarningDesc')}
                </p>
              </div>
            )}

            <p className="text-gray-300">{t('app.game.goodWon3')}</p>
            
            {me?.role === 'assassin' ? (
              <div className="space-y-4">
                <p className="font-bold">{t('app.game.whoIsMerlin')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {room.players.filter(p => p.id !== playerId).map(p => (
                    <div key={p.id}>
                      <Button variant="outline" onClick={() => socket.emit('assassinate', { roomCode: room.code, targetPlayerId: p.id })} className="text-sm">
                        {formatName(p)}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 animate-pulse text-red-400 italic">{t('app.game.assassinActing')}</div>
            )}
          </div>
        )}

        {room.phase === 'game-over' && (
          <div className="space-y-8 text-center">
            <div className="space-y-2">
              <h3 className={`text-5xl font-['Cinzel'] ${room.winner === 'good' ? 'text-blue-500' : 'text-red-500'}`}>
                {room.winner === 'good' ? t('app.game.goodWins') : t('app.game.evilWins')}
              </h3>
              <p className="text-gray-400 italic">{room.gameOverReason}</p>
              {room.assassinationTargetId && (
                <div className="mt-4 p-4 bg-black/20 rounded-2xl border border-white/10 inline-block">
                  <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">{t('app.game.assassinTarget')}</p>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xl">
                      {room.players.find(p => p.id === room.assassinationTargetId) ? formatName(room.players.find(p => p.id === room.assassinationTargetId)!) : ''}
                    </span>
                    {room.players.find(p => p.id === room.assassinationTargetId)?.role === 'merlin' ? (
                      <div className="bg-green-500/20 p-1 rounded-full border border-green-500/50">
                        <CheckCircle2 className="text-green-500" size={20} />
                      </div>
                    ) : (
                      <div className="bg-red-500/20 p-1 rounded-full border border-red-500/50">
                        <XCircle className="text-red-500" size={20} />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {room.players.find(p => p.id === room.assassinationTargetId)?.role === 'merlin'
                      ? t('app.game.hitMerlin')
                      : t('app.game.missedMerlin')}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-sm uppercase tracking-widest text-gray-400 font-bold">{t('app.game.finalReveal')}</h4>
              <div className="grid grid-cols-1 gap-2">
                {room.players.map(p => {
                  const isLancelot = p.role?.includes('lancelot');
                  const playerTeam = (p.role && room.lancelotLoyalty && isLancelot)
                    ? (p.role === 'lancelot_good' ? room.lancelotLoyalty.lancelotGoodTeam : room.lancelotLoyalty.lancelotEvilTeam)
                    : (p.role ? ROLES[p.role].team : 'good');
                  const won = playerTeam === room.winner;

                  return (
                    <div 
                      key={p.id} 
                      className={`flex items-center justify-between bg-black/20 p-3 rounded-xl border transition-all duration-500 ${
                        won 
                          ? 'border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]' 
                          : 'border-white/5 opacity-30 grayscale-[0.5]'
                      }`}
                    >
                      <span className={`font-bold ${won ? 'text-white' : 'text-gray-400'}`}>{formatName(p)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${won ? 'text-gray-400' : 'text-gray-600'}`}>{p.role && getRoleInfo(p.role, t).name}</span>
                        <span className={won ? '' : 'opacity-50'}>{p.role && ROLES[p.role].icon}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {isHost && (
                <Button onClick={() => socket.emit('reset-game', { roomCode: room.code })}>
                  {t('app.game.playAgain')}
                </Button>
              )}
              <Button variant="secondary" onClick={onLeave}>
                {t('app.game.leaveRoom')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Footer Player Info */}
      {me?.role && room.phase !== 'game-over' && (
        <div className="mt-8 max-w-md mx-auto space-y-4">
          <div className="flex justify-center">
            <button
              onClick={() => setShowSecrets(!showSecrets)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all font-black uppercase tracking-widest text-[10px] ${
                showSecrets 
                  ? 'bg-[#ffd700] text-[#0d1b2a] border-[#ffd700]' 
                  : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/30'
              }`}
            >
              {showSecrets ? <><EyeOff size={14} /> {t('app.game.hideSecrets')}</> : <><Eye size={14} /> {t('app.game.showSecrets')}</>}
            </button>
          </div>

          <AnimatePresence>
            {showSecrets && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-4"
              >
                <div className="bg-[#1b263b] border border-[#ffd700]/30 rounded-xl p-4 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{ROLES[me.role].icon}</span>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">{t('app.game.yourCharacter')}</p>
                        <p className="font-bold text-[#ffd700] text-lg">{getRoleInfo(me.role, t).name}</p>
                      </div>
                    </div>
                    <Badge team={currentTeam}>{currentTeam === 'good' ? t('app.game.good') : t('app.game.evil')}</Badge>
                  </div>
                  
                  {me.role.includes('lancelot') && room.lancelotLoyalty && room.lancelotConfig?.variant !== 'var3' && (
                    <div className="bg-purple-500/20 border border-purple-500/40 rounded-xl p-2 text-center mb-4">
                      <p className="text-[9px] uppercase font-bold text-purple-300 tracking-widest">{t('app.game.currentLoyalty')}</p>
                      <p className="text-sm font-black text-white">
                        {me.role === 'lancelot_good' ? room.lancelotLoyalty.lancelotGoodTeam.toUpperCase() : room.lancelotLoyalty.lancelotEvilTeam.toUpperCase()}
                      </p>
                    </div>
                  )}

                  <KnowledgeSection room={room} me={me} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};
