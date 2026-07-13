/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Users } from 'lucide-react';
import { getPersistentId, getSessionToken, setSessionToken } from '../../lib/session';
import { useSocket } from '../../context/SocketContext';
import { useSettings } from '../../context/SettingsContext';
import { GameTitle } from '../ui/GameTitle';
import { Layout } from '../ui/Layout';
import { Button } from '../ui/Button';

export const Home = () => {
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
