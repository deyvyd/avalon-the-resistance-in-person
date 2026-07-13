/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Shield,
  Skull,
  Sword,
  CheckCircle2,
  XCircle,
  Crown,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  SkipForward,
  SkipBack,
  Info,
  Copy,
  LogOut,
  Droplets,
  Target,
  Eye,
  EyeOff,
  RefreshCw,
  Equal,
  Check,
  ChevronDown,
  ChevronUp,
  MapPinned,
  Book
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
// Manuais são texto estático grande — só baixa o chunk quando o jogador abre
const GameGuide = lazy(() => import('./components/GameGuide').then(m => ({ default: m.GameGuide })));
const GameManual = lazy(() => import('./components/GameManual').then(m => ({ default: m.GameManual })));
import {
  ROLES,
  MISSION_SIZES,
  needsTwoFails,
  generateNarrationSequence,
  shouldPauseAfter,
  Roles,
  TEAM_DISTRIBUTION,
  getRoleInfo
} from './core/avalon';
import type { Player, Mission, GamePhase, MatchRecord, TeamVoteResult, MissionVoteResult, Room } from './types';
import { getPersistentId, getSessionToken, setSessionToken } from './lib/session';
import { SocketContext, useSocket } from './context/SocketContext';
import { useSettings, SettingsProvider } from './context/SettingsContext';
import { GameTitle } from './components/ui/GameTitle';
import { Layout } from './components/ui/Layout';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { SettingsModal } from './components/modals/SettingsModal';
import { LancelotModal } from './components/modals/LancelotModal';

// --- Components ---

// --- Pages ---

const MatchHistoryView = ({ history, onBack }: { history: MatchRecord[]; onBack: () => void }) => {
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

const Home = () => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const socket = useSocket();
  const navigate = useNavigate();
  const { setShowSettings } = useSettings();

  const handleCreate = () => {
    if (!name) return alert(t('app.enterNameAlert'));
    socket.emit('create-room', { playerName: name, playerId: getPersistentId() });
  };

  const handleJoin = () => {
    if (!name || !roomCode) return alert(t('app.fillNameAndCode'));
    socket.emit('join-room', { roomCode: roomCode.toUpperCase(), playerName: name, playerId: getPersistentId(), sessionToken: getSessionToken() });
  };

  useEffect(() => {
    const handleRoomCreated = ({ roomCode, sessionToken }: any) => {
      setSessionToken(sessionToken);
      navigate(`/room/${roomCode}`);
    };
    const handleJoined = ({ roomCode, sessionToken }: any) => {
      setSessionToken(sessionToken);
      navigate(`/room/${roomCode}`);
    };
    const handleError = ({ code, message }: { code?: string; message: string }) =>
      alert(code ? t(`errors.${code}`, message) : message);

    socket.on('room-created', handleRoomCreated);
    socket.on('joined-room', handleJoined);
    socket.on('error', handleError);

    return () => {
      // off com referência: off('error') sem handler removeria listeners de outros componentes
      socket.off('room-created', handleRoomCreated);
      socket.off('joined-room', handleJoined);
      socket.off('error', handleError);
    };
  }, [socket, navigate, t]);

  return (
    <Layout showTitle={false} onSettingsClick={() => setShowSettings(true)}>
      <div className="space-y-12 text-center pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GameTitle />
          <p className="text-gray-400 italic">{t('app.subtitle')}</p>
        </motion.div>

        <div className="space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-2">{t('app.yourName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Arthur"
              className="w-full bg-[#1b263b] border-2 border-white/10 rounded-xl py-4 px-6 focus:border-[#ffd700] outline-none transition-all"
            />
          </div>

          <div className="pt-4 space-y-4">
            <Button onClick={handleCreate}>{t('app.createRoom')}</Button>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
              <div className="relative flex justify-center text-xs uppercase bg-[#0d1b2a] px-4 text-gray-400 font-bold">{t('app.joinRoomOr')}</div>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder={t('app.roomCodePlaceholder')}
                className="w-full bg-[#1b263b] border-2 border-white/10 rounded-xl py-4 px-6 text-center font-mono text-2xl tracking-widest focus:border-[#ffd700] outline-none transition-all uppercase"
              />
              <Button variant="secondary" onClick={handleJoin}>{t('app.joinRoom')}</Button>
            </div>

            <div className="pt-8 opacity-40 hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  localStorage.removeItem('avalon_player_id');
                  localStorage.removeItem('avalon_session_token');
                  sessionStorage.removeItem('avalon_player_id');
                  sessionStorage.removeItem('avalon_session_token');
                  window.location.reload();
                }}
                className="text-[10px] uppercase tracking-widest flex items-center gap-2 mx-auto"
              >
                <Users size={12} />
                <span>{t('app.resetIdentity')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const Room = () => {
  const { t } = useTranslation();
  const { code } = useParams();
  const socket = useSocket();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { settings, setShowSettings } = useSettings();

  useEffect(() => {
    const handleRoomUpdate = (updatedRoom: Room) => {
      setRoom(updatedRoom);
      setIsJoining(false);
    };

    const handleError = ({ code, message }: { code?: string; message: string }) => {
      alert(code ? t(`errors.${code}`, message) : message);
      setIsJoining(false);
      if (code === 'ROOM_NOT_FOUND') navigate('/');
    };

    const requestRoomInfo = () => {
      socket.emit('get-room-info', { roomCode: code?.toUpperCase(), playerId: getPersistentId(), sessionToken: getSessionToken() });
    };

    socket.on('room-updated', handleRoomUpdate);
    socket.on('error', handleError);
    // Reconexão (wifi caiu, app voltou do background): sem isso o cliente
    // fica preso no último estado conhecido até a página ser recarregada
    socket.on('connect', requestRoomInfo);

    requestRoomInfo();

    return () => {
      socket.off('room-updated', handleRoomUpdate);
      socket.off('error', handleError);
      socket.off('connect', requestRoomInfo);
    };
  }, [socket, navigate, code]);

  const handleJoin = () => {
    if (!playerName) return alert(t('app.enterNameAlert'));
    setIsJoining(true);
    socket.emit('join-room', { roomCode: code?.toUpperCase(), playerName, playerId: getPersistentId(), sessionToken: getSessionToken() });
  };

  if (!room) {
    return (
      <Layout onSettingsClick={() => setShowSettings(true)}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#ffd700]"></div>
        </div>
      </Layout>
    );
  }

  const playerId = getPersistentId();
  const me = room.players.find(p => p.id === playerId);
  const isHost = playerId === room.hostId;

  // Se o usuário NÃO está na sala, mostrar formulário de entrada
  if (!me) {
    return (
      <Layout onSettingsClick={() => setShowSettings(true)}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 text-center py-12">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-widest text-gray-400 font-bold">{t('app.enterRoom')}</h2>
            <h1 className="text-4xl font-mono font-bold text-[#ffd700]">{code}</h1>
          </div>

          <Card className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-2">{t('app.yourName')}</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ex: Mordred"
                className="w-full bg-[#0d1b2a] border-2 border-white/10 rounded-xl py-4 px-6 focus:border-[#ffd700] outline-none transition-all"
              />
            </div>
            <Button onClick={handleJoin} disabled={isJoining}>
              {isJoining ? t('app.joining') : t('app.joinGame')}
            </Button>
          </Card>
          
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto">
            <LogOut size={16} />
            <span>{t('app.leaveRoom')}</span>
          </button>
        </motion.div>
      </Layout>
    );
  }

  const handleLeave = () => {
    if (settings.confirmOnLeave) {
      if (!window.confirm(t('app.confirmLeave'))) return;
    }
    socket.emit('leave-room', { roomCode: code?.toUpperCase(), playerId: getPersistentId() });
    navigate('/');
  };

  return (
    <Layout onSettingsClick={() => setShowSettings(true)}>
      <AnimatePresence mode="wait">
        {room.phase === 'lobby' && <LobbyView room={room} isHost={isHost} onLeave={handleLeave} />}
        {room.phase === 'character-reveal' && <CharacterRevealView room={room} me={me} />}
        {room.phase === 'narration' && <NarrationView room={room} isHost={isHost} />}
        {(['team-proposal', 'team-voting', 'team-result', 'mission-voting', 'mission-result', 'assassination', 'game-over'].includes(room.phase)) && (
          <GameView room={room} me={me} isHost={isHost} onLeave={handleLeave} />
        )}
      </AnimatePresence>
    </Layout>
  );
};

const LobbyView = ({ room, isHost, onLeave }: { room: Room; isHost: boolean; onLeave: () => void }) => {
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

const CharacterRevealView = ({ room, me }: { room: Room; me?: Player }) => {
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

const NarrationView = ({ room, isHost }: { room: Room; isHost: boolean }) => {
  const { t } = useTranslation();
  const socket = useSocket();
  const { settings, showSettings } = useSettings();
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showSettings) {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPaused(true);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }
  }, [showSettings]);

  const roles: Roles = {
    merlin: true,
    assassin: true,
    percival: room.selectedRoles.includes('percival'),
    morgana: room.selectedRoles.includes('morgana'),
    mordred: room.selectedRoles.includes('mordred'),
    oberon: room.selectedRoles.includes('oberon'),
    lancelotGood: room.selectedRoles.includes('lancelot_good'),
    lancelotEvil: room.selectedRoles.includes('lancelot_evil'),
  };

  const sequence = generateNarrationSequence(roles, room.lancelotConfig, room.players.length);
  
  const narrationTexts: Record<string, string> = {
    '1': t('narration.1'),
    '2': t('narration.2'),
    '3': t('narration.3'),
    '3-lancelot': t('narration.3-lancelot'),
    '4': t('narration.4'),
    '4-oberon': t('narration.4-oberon'),
    '4-lancelot': t('narration.4-lancelot'),
    '4-oberon-lancelot': t('narration.4-oberon-lancelot'),
    '5': t('narration.5'),
    '5-mordred': t('narration.5-mordred'),
    '5-lancelot': t('narration.5-lancelot'),
    '5-mordred-lancelot': t('narration.5-mordred-lancelot'),
    '6': t('narration.6'),
    '7': t('narration.7'),
    '8': t('narration.8'),
    '8-morgana': t('narration.8-morgana'),
    '9': t('narration.9'),
    '9-morgana': t('narration.9-morgana'),
    '10': t('narration.10'),
    '11': t('narration.11'),
    '12': t('narration.12'),
    '13': t('narration.13'),
    '14': t('narration.14'),
  };

  const playStep = (index: number) => {
    if (index >= sequence.length) {
      if (isHost) {
        socket.emit('narration-ended', { roomCode: room.code });
      }
      return;
    }

    setStep(index);
    const audioFile = sequence[index];
    const audio = new Audio(new URL(`./assets/audios/${audioFile}.mp3`, import.meta.url).href);
    // HTMLAudioElement lança IndexSizeError acima de 1.0; slider vai até 1.5 como "boost" visual
    audio.volume = Math.min(1, settings.narrationVolume);
    audioRef.current = audio;

    audio.onended = () => {
      if (shouldPauseAfter(audioFile)) {
        timerRef.current = setTimeout(() => {
          playStep(index + 1);
        }, settings.pauseDuration * 1000);
      } else {
        playStep(index + 1);
      }
    };

    audio.play().catch(e => console.error("Erro ao tocar áudio:", e));
  };

  const togglePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      playStep(step);
    } else {
      if (isPaused) {
        audioRef.current?.play();
        setIsPaused(false);
      } else {
        audioRef.current?.pause();
        setIsPaused(true);
      }
    }
  };

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setStep(0);
    setIsPlaying(false);
    setIsPaused(false);
  };

  const skip = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (step + 1 < sequence.length) {
      playStep(step + 1);
    } else {
      if (isHost) {
        socket.emit('narration-ended', { roomCode: room.code });
      }
    }
  };

  const skipAll = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (isHost) {
      socket.emit('narration-ended', { roomCode: room.code });
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 text-center py-12">
      <div className="space-y-4">
        <div className="text-8xl animate-pulse">🌙</div>
        <h2 className="text-4xl font-['Cinzel'] text-[#ffd700]">{t('app.narrationView.nightFalls')}</h2>
      </div>

      <Card className="py-12">
        {isHost ? (
          <div className="space-y-8">
            <p className="text-2xl font-bold italic">"{narrationTexts[sequence[step]] || '...'}"</p>
            <div className="flex flex-col gap-6 items-center">
              <div className="flex justify-center gap-4">
                <Button variant="secondary" onClick={restart} className="w-auto px-4"><RotateCcw size={20} /></Button>
                <Button onClick={togglePlay} className="w-auto px-8">
                  {!isPlaying ? t('app.narrationView.startNarration') : (isPaused ? <Play /> : <Pause />)}
                </Button>
                <Button variant="secondary" onClick={skip} className="w-auto px-4" disabled={!isPlaying}><SkipForward size={20} /></Button>
              </div>
              
              {!isPlaying && (
                <button 
                  onClick={skipAll}
                  className="text-gray-400 hover:text-white text-[10px] uppercase tracking-[0.2em] font-black transition-colors flex items-center gap-2"
                >
                  <VolumeX size={14} />
                  {t('app.narrationView.skipFullNarration')}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">{t('app.narrationView.step', { current: step + 1, total: sequence.length })}</p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <Volume2 size={16} />
              <span>{isPlaying ? t('app.narrationView.playing', { file: sequence[step] }) : t('app.narrationView.readyToStart')}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-xl text-gray-300">{t('app.narrationView.followAudioHost')}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.4 }}
                  className="w-3 h-3 bg-[#ffd700] rounded-full"
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

const KnowledgeSection = ({ room, me }: { room: Room; me: Player }) => {
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

const GameView = ({ room, me, isHost, onLeave }: { room: Room; me?: Player; isHost: boolean; onLeave: () => void }) => {
  const { t } = useTranslation();
  const socket = useSocket();
  const { showSettings } = useSettings();
  const playerId = getPersistentId();
  const currentMission = room.missions[room.currentMissionIndex];
  const leader = room.players[room.currentLeaderIndex];
  const isLeader = playerId === leader.id;
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
      {showCrown && p.id === leader.id && <Crown size={14} className="text-[#ffd700] shrink-0" />}
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
                  i === room.currentMissionIndex ? 'bg-[#ffd700] text-[#0d1b2a] border-white' :
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
            <p className="text-sm" dangerouslySetInnerHTML={{ __html: t('app.game.investigationIs', { name: ladyResult.targetName }) }} />
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
                    <div className="grid grid-cols-2 gap-2">
                      {room.players.filter(p => p.id !== playerId).map(p => (
                        <button
                          key={p.id}
                          onClick={() => socket.emit('assign-excalibur', { roomCode: room.code, targetPlayerId: p.id })}
                          className={`p-2 rounded-lg border transition-all text-xs font-bold ${
                            room.excaliburHolder === p.id ? 'border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700]' : 'border-white/10 bg-white/5 text-gray-400'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
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
                  {room.proposedTeam.map(id => (
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
                <p className="text-xs" dangerouslySetInnerHTML={{ __html: t('app.game.excaliburRevealVote', { name: room.players.find(p => p.id === room.excaliburTarget)?.name }) }} />
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
              <Button variant="secondary" onClick={() => window.location.href = '/'}>
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
                    <Badge team={ROLES[me.role].team}>{ROLES[me.role].team === 'good' ? t('app.game.good') : t('app.game.evil')}</Badge>
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

// --- App ---

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin, { path: '/avalon/socket.io' });
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);

  if (!socket) return null;

  return (
    <SocketContext.Provider value={socket}>
      <SettingsProvider>
        <Router basename="/avalon">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:code" element={<Room />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Router>
      </SettingsProvider>
    </SocketContext.Provider>
  );
}
