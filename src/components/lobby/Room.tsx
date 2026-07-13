/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut } from 'lucide-react';
import { getPersistentId, getSessionToken } from '../../lib/session';
import { useSocket } from '../../context/SocketContext';
import { useSettings } from '../../context/SettingsContext';
import { Layout } from '../ui/Layout';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { Room as RoomState } from '../../types';
import { LobbyView } from './LobbyView';
import { CharacterRevealView } from '../game/CharacterRevealView';
import { NarrationView } from '../game/NarrationView';
import { GameView } from '../game/GameView';

export const Room = () => {
  const { t } = useTranslation();
  const { code } = useParams();
  const socket = useSocket();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { settings, setShowSettings } = useSettings();

  useEffect(() => {
    const handleRoomUpdate = (updatedRoom: RoomState) => {
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
