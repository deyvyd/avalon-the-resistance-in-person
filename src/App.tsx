/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Shield, 
  Skull, 
  Sword, 
  CheckCircle2, 
  XCircle, 
  Crown, 
  Play, 
  Volume2, 
  VolumeX, 
  SkipForward, 
  SkipBack,
  Info,
  QrCode,
  Copy,
  LogOut
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ROLES, MISSION_SIZES, needsTwoFails, Team, getNarrationSequence, TEAM_DISTRIBUTION } from './core/avalon';

// --- Types ---

const getPersistentId = () => {
  let id = sessionStorage.getItem('avalon_player_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('avalon_player_id', id);
  }
  return id;
};

interface Player {
  id: string; // Persistent ID
  socketId: string;
  name: string;
  role?: string;
  isConfirmed: boolean;
}

interface Mission {
  index: number;
  size: number;
  status: 'pending' | 'success' | 'fail';
  votes: ('success' | 'fail')[];
  team: string[];
}

type GamePhase =
  | 'lobby'
  | 'character-reveal'
  | 'narration'
  | 'team-proposal'
  | 'team-voting'
  | 'team-result'
  | 'mission-voting'
  | 'mission-result'
  | 'assassination'
  | 'game-over';

interface TeamVoteResult {
  votes: Record<string, 'approve' | 'reject'>;
  passed: boolean;
}

interface MissionVoteResult {
  votes: ('success' | 'fail')[];
  passed: boolean;
}

interface Room {
  code: string;
  hostId: string;
  players: Player[];
  phase: GamePhase;
  selectedRoles: string[];
  missions: Mission[];
  currentMissionIndex: number;
  currentLeaderIndex: number;
  rejectionCount: number;
  proposedTeam: string[];
  teamVotes: Record<string, 'approve' | 'reject'>;
  missionVotes: Record<string, 'success' | 'fail'>;
  lastTeamVoteResult?: TeamVoteResult;
  lastMissionVoteResult?: MissionVoteResult;
  assassinationTargetId?: string;
  firstLeaderId?: string;
  winner?: 'good' | 'evil';
  gameOverReason?: string;
}

// --- Context ---

const SocketContext = createContext<Socket | null>(null);

const useSocket = () => {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error('useSocket must be used within a SocketProvider');
  return socket;
};

// --- Components ---

const GameTitle = ({ small = false }: { small?: boolean }) => (
  <div className={`text-center mb-8 ${small ? 'scale-75 -mb-4' : ''}`}>
    <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold mb-1">The Resistance</div>
    <h1 className="text-5xl font-['Cinzel'] text-[#ffd700] drop-shadow-[0_0_15px_rgba(255,215,0,0.3)] tracking-widest">AVALON</h1>
  </div>
);

const Layout = ({ children, showTitle = true }: { children: ReactNode; showTitle?: boolean }) => (
  <div className="min-h-screen bg-[#0d1b2a] text-white font-['Lato'] selection:bg-[#ffd700] selection:text-[#0d1b2a] pb-12">
    <div className="max-w-md mx-auto px-4 py-8">
      {showTitle && <GameTitle small={!window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('/room/')} />}
      {children}
    </div>
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false,
  className = ''
}: { 
  children: ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  disabled?: boolean;
  className?: string;
}) => {
  const variants = {
    primary: 'bg-[#ffd700] text-[#0d1b2a] hover:bg-[#ffed4a]',
    secondary: 'bg-[#2a3f5f] text-white hover:bg-[#3a547a]',
    danger: 'bg-[#c0392b] text-white hover:bg-[#e74c3c]',
    outline: 'border-2 border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700] hover:text-[#0d1b2a]'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4 px-6 rounded-xl font-['Cinzel'] font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`bg-[#1b263b] border border-white/10 rounded-2xl p-6 shadow-xl ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, team }: { children: ReactNode; team: Team }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
    team === 'good' ? 'bg-[#3498db] text-white' : 'bg-[#c0392b] text-white'
  }`}>
    {children}
  </span>
);

// --- Pages ---

const Home = () => {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const socket = useSocket();
  const navigate = useNavigate();

  const handleCreate = () => {
    if (!name) return alert('Digite seu nome');
    socket.emit('create-room', { playerName: name, playerId: getPersistentId() });
  };

  const handleJoin = () => {
    if (!name || !roomCode) return alert('Preencha nome e código da sala');
    socket.emit('join-room', { roomCode: roomCode.toUpperCase(), playerName: name, playerId: getPersistentId() });
  };

  useEffect(() => {
    socket.on('room-created', ({ roomCode }) => {
      navigate(`/room/${roomCode}`);
    });
    socket.on('joined-room', ({ roomCode }) => {
      navigate(`/room/${roomCode}`);
    });
    socket.on('error', ({ message }) => alert(message));

    return () => {
      socket.off('room-created');
      socket.off('joined-room');
      socket.off('error');
    };
  }, [socket, navigate]);

  return (
    <Layout showTitle={false}>
      <div className="space-y-12 text-center pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GameTitle />
          <p className="text-gray-400 italic">Resistência & Traição</p>
        </motion.div>

        <div className="space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-xs uppercase tracking-widest text-gray-500 font-bold ml-2">Seu Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Arthur"
              className="w-full bg-[#1b263b] border-2 border-white/10 rounded-xl py-4 px-6 focus:border-[#ffd700] outline-none transition-all"
            />
          </div>

          <div className="pt-4 space-y-4">
            <Button onClick={handleCreate}>Criar Nova Sala</Button>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
              <div className="relative flex justify-center text-xs uppercase bg-[#0d1b2a] px-4 text-gray-500 font-bold">Ou entre em uma</div>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Código da Sala (Ex: X7K2)"
                className="w-full bg-[#1b263b] border-2 border-white/10 rounded-xl py-4 px-6 text-center font-mono text-2xl tracking-widest focus:border-[#ffd700] outline-none transition-all uppercase"
              />
              <Button variant="secondary" onClick={handleJoin}>Entrar na Sala</Button>
            </div>

            <div className="pt-8 opacity-40 hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  sessionStorage.removeItem('avalon_player_id');
                  window.location.reload();
                }}
                className="text-[10px] uppercase tracking-widest flex items-center gap-2 mx-auto"
              >
                <Users size={12} />
                <span>Resetar Identidade (Para Testes)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const Room = () => {
  const { code } = useParams();
  const socket = useSocket();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const handleRoomUpdate = (updatedRoom: Room) => {
      setRoom(updatedRoom);
      setIsJoining(false);
    };

    const handleError = ({ message }: { message: string }) => {
      alert(message);
      setIsJoining(false);
      if (message === "Sala não encontrada") navigate('/');
    };

    socket.on('room-updated', handleRoomUpdate);
    socket.on('error', handleError);

    // Solicitar informações da sala ao entrar
    socket.emit('get-room-info', { roomCode: code?.toUpperCase(), playerId: getPersistentId() });
    
    return () => {
      socket.off('room-updated', handleRoomUpdate);
      socket.off('error', handleError);
    };
  }, [socket, navigate, code]);

  const handleJoin = () => {
    if (!playerName) return alert('Digite seu nome');
    setIsJoining(true);
    socket.emit('join-room', { roomCode: code?.toUpperCase(), playerName, playerId: getPersistentId() });
  };

  if (!room) {
    return (
      <Layout>
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
      <Layout>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 text-center py-12">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold">Entrar na Sala</h2>
            <h1 className="text-4xl font-mono font-bold text-[#ffd700]">{code}</h1>
          </div>

          <Card className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-xs uppercase tracking-widest text-gray-500 font-bold ml-2">Seu Nome</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ex: Mordred"
                className="w-full bg-[#0d1b2a] border-2 border-white/10 rounded-xl py-4 px-6 focus:border-[#ffd700] outline-none transition-all"
              />
            </div>
            <Button onClick={handleJoin} disabled={isJoining}>
              {isJoining ? 'Entrando...' : 'Entrar no Jogo'}
            </Button>
          </Card>
          
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto">
            <LogOut size={16} />
            <span>Sair da Sala</span>
          </button>
        </motion.div>
      </Layout>
    );
  }

  const handleLeave = () => {
    socket.emit('leave-room', { roomCode: code?.toUpperCase(), playerId: getPersistentId() });
    navigate('/');
  };

  return (
    <Layout>
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
  const socket = useSocket();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const playerCount = room.players.length;
  const distribution = TEAM_DISTRIBUTION[playerCount] || { good: 0, evil: 0 };

  const selectedGood = selectedRoles.filter(r => ROLES[r].team === 'good');
  const selectedEvil = selectedRoles.filter(r => ROLES[r].team === 'evil');

  const goodSlots = distribution.good;
  const evilSlots = distribution.evil;

  const canSelectGood = selectedGood.length < goodSlots - 1; // -1 for Merlin
  const canSelectEvil = selectedEvil.length < evilSlots - 1; // -1 for Assassin

  const toggleRole = (roleId: string) => {
    const role = ROLES[roleId];
    const isSelected = selectedRoles.includes(roleId);
    
    if (!isSelected) {
      if (role.team === 'good' && !canSelectGood) return;
      if (role.team === 'evil' && !canSelectEvil) return;
    }

    setSelectedRoles(prev => 
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const handleStart = () => {
    if (playerCount < 5) return alert('Mínimo 5 jogadores');
    socket.emit('start-game', { roomCode: room.code, selectedRoles });
  };

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const newPlayers = [...room.players];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPlayers.length) return;
    
    [newPlayers[index], newPlayers[targetIndex]] = [newPlayers[targetIndex], newPlayers[index]];
    socket.emit('reorder-players', { roomCode: room.code, players: newPlayers });
  };

  const setFirstLeader = (playerId: string) => {
    socket.emit('set-first-leader', { roomCode: room.code, playerId: room.firstLeaderId === playerId ? null : playerId });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold">Sala</h2>
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
            <h3 className="font-['Cinzel'] text-xl text-[#ffd700]">Jogadores ({playerCount}/10)</h3>
            {isHost && <p className="text-[10px] text-gray-500 uppercase tracking-widest">Defina a ordem da mesa e quem começa liderando</p>}
          </div>
          <Users size={20} className="text-gray-500" />
        </div>
        <div className="space-y-2">
          {room.players.map((p, index) => (
            <div key={p.id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 group">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.id === room.hostId ? 'bg-[#ffd700]' : 'bg-green-500'}`}></div>
                <span className="truncate font-bold">
                  {p.name}
                  {p.id === socket.id && <span className="font-normal text-blue-300 ml-1">(Eu)</span>}
                </span>
                {room.firstLeaderId === p.id && <Crown size={14} className="text-[#ffd700] flex-shrink-0" />}
              </div>
              
              {isHost && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setFirstLeader(p.id)}
                    className={`p-1.5 rounded-lg transition-colors ${room.firstLeaderId === p.id ? 'bg-[#ffd700] text-[#0d1b2a]' : 'hover:bg-white/10 text-gray-500'}`}
                    title="Definir como 1ª liderança"
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

      {isHost && (
        <div className="space-y-8">
          <div className="space-y-6">
            {/* Forças do Bem */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="font-['Cinzel'] text-lg text-[#3498db] flex items-center gap-2">
                  <Shield size={18} /> Forças do Bem <span className="text-gray-500">→ {goodSlots} Personagens</span>
                </h3>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Mandatory and Generic Good */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-[#ffd700] bg-[#ffd700]/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">🧙‍♂️ Merlin</span>
                        <span className="text-[8px] uppercase bg-[#ffd700] text-[#0d1b2a] px-1 rounded font-bold">Obrigatório</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">Conhece os servos do mal</p>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">🛡️ {goodSlots - 1 - selectedGood.length} Servos de Arthur</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">Preenchem vagas restantes</p>
                    </div>
                  </div>
                </div>

                {/* Optional Good */}
                <div className="grid grid-cols-1 gap-3">
                  {['percival'].map(roleId => {
                    const isSelected = selectedRoles.includes(roleId);
                    const disabled = !isSelected && !canSelectGood;
                    return (
                      <button
                        key={roleId}
                        onClick={() => toggleRole(roleId)}
                        disabled={disabled}
                        className={`p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
                          isSelected 
                            ? 'border-[#ffd700] bg-[#ffd700]/10' 
                            : 'border-white/10 bg-white/5 opacity-60'
                        } ${disabled ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
                      >
                        <span className="text-2xl">{ROLES[roleId].icon}</span>
                        <div className="flex-1">
                          <div className="font-bold text-sm">{ROLES[roleId].name}</div>
                          <p className="text-[10px] text-gray-400 leading-tight">{ROLES[roleId].description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Forças do Mal */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="font-['Cinzel'] text-lg text-[#c0392b] flex items-center gap-2">
                  <Skull size={18} /> Forças do Mal <span className="text-gray-500">→ {evilSlots} Personagens</span>
                </h3>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Mandatory and Generic Evil */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-red-500/50 bg-red-500/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">💀 Assassino</span>
                        <span className="text-[8px] uppercase bg-red-500 text-white px-1 rounded font-bold">Obrigatório</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">Tenta identificar Merlin</p>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">🗡️ {evilSlots - 1 - selectedEvil.length} Minions de Mordred</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">Preenchem vagas restantes</p>
                    </div>
                  </div>
                </div>

                {/* Optional Evil */}
                <div className="grid grid-cols-2 gap-3">
                  {['morgana', 'mordred', 'oberon'].map(roleId => {
                    const isSelected = selectedRoles.includes(roleId);
                    const disabled = !isSelected && !canSelectEvil;
                    return (
                      <button
                        key={roleId}
                        onClick={() => toggleRole(roleId)}
                        disabled={disabled}
                        className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1 ${
                          isSelected 
                            ? 'border-red-500 bg-red-500/10' 
                            : 'border-white/10 bg-white/5 opacity-60'
                        } ${disabled ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{ROLES[roleId].icon}</span>
                          <span className="font-bold text-sm">{ROLES[roleId].name}</span>
                        </div>
                        <p className="text-[9px] text-gray-400 leading-tight h-6 overflow-hidden">{ROLES[roleId].description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleStart} disabled={playerCount < 5} className="shadow-[0_0_20px_rgba(255,215,0,0.2)]">
            Sortear Personagens
          </Button>
        </div>
      )}

      {!isHost && (
        <div className="text-center p-8 border-2 border-dashed border-white/10 rounded-2xl">
          <p className="text-gray-400 italic">Aguardando o host iniciar a partida...</p>
        </div>
      )}

      <button 
        onClick={onLeave}
        className="w-full py-3 px-4 rounded-xl border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-400/30 transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest"
      >
        <LogOut size={16} />
        Sair da Sala
      </button>
    </motion.div>
  );
};

const CharacterRevealView = ({ room, me }: { room: Room; me?: Player }) => {
  const socket = useSocket();
  const [revealed, setRevealed] = useState(false);
  const role = me?.role ? ROLES[me.role] : null;

  if (!role) return null;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 text-center">
      <h2 className="text-3xl font-['Cinzel'] text-[#ffd700]">Seu Destino</h2>
      
      <Card className="relative overflow-hidden py-12 space-y-6">
        <div className={`space-y-6 transition-all duration-500 ${revealed ? 'blur-0' : 'blur-xl opacity-20'}`}>
          <div className="text-8xl">{role.icon}</div>
          <div className="space-y-2">
            <Badge team={role.team}>{role.team === 'good' ? 'Leal Servo de Arthur' : 'Servo de Mordred'}</Badge>
            <h3 className="text-4xl font-['Cinzel'] font-bold">{role.name}</h3>
          </div>
          <p className="text-gray-300 px-4">{role.description}</p>
        </div>

        {!revealed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <Button onClick={() => setRevealed(true)} className="w-auto shadow-2xl">Revelar Personagem</Button>
          </div>
        )}
      </Card>

      {revealed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <p className="text-sm text-gray-400 italic">Memorize seu personagem e não mostre a ninguém!</p>
          <Button variant={me?.isConfirmed ? 'secondary' : 'primary'} onClick={() => socket.emit('confirm-character', { roomCode: room.code })}>
            {me?.isConfirmed ? 'Aguardando outros...' : 'Entendi'}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};

const NarrationView = ({ room, isHost }: { room: Room; isHost: boolean }) => {
  const socket = useSocket();
  const [step, setStep] = useState(0);
  const sequence = getNarrationSequence(room.selectedRoles);
  
  const narrationTexts: Record<string, string> = {
    '1': 'Bem-vindos ao Avalon...',
    '2': 'Todos fechem os olhos...',
    '3': 'Servos do Mal, levantem o polegar',
    '4': 'Servos do Mal, abram os olhos e conheçam seus companheiros',
    '4-oberon': 'Servos do Mal, exceto Oberon, abram os olhos...',
    '5': 'Servos do Mal, fechem os olhos',
    '5-mordred': 'Servos do Mal, fechem os olhos. Mordred, abaixe seu polegar',
    '6': 'Merlin, abra os olhos e veja os servos do mal',
    '7': 'Servos do Mal, abaixem seus polegares. Merlin, feche os olhos',
    '8': 'Merlin, levante o polegar',
    '8-morgana': 'Merlin e Morgana, levantem o polegar',
    '9': 'Percival, abra os olhos e veja Merlin',
    '9-morgana': 'Percival, abra os olhos e veja Merlin e Morgana',
    '10': 'Percival, feche os olhos. Todos abaixem suas mãos',
    '13': 'Todos podem abrir os olhos',
    '14': 'Que comecem as missões de Avalon! Boa sorte, cavaleiros e servos'
  };

  useEffect(() => {
    if (isHost && step === sequence.length) {
      setTimeout(() => {
        socket.emit('narration-ended', { roomCode: room.code });
      }, 2000);
    }
  }, [step, isHost, room.code, socket, sequence.length]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 text-center py-12">
      <div className="space-y-4">
        <div className="text-8xl animate-pulse">🌙</div>
        <h2 className="text-4xl font-['Cinzel'] text-[#ffd700]">A Noite Cai</h2>
      </div>

      <Card className="py-12">
        {isHost ? (
          <div className="space-y-8">
            <p className="text-2xl font-bold italic">"{narrationTexts[sequence[step]] || '...'}"</p>
            <div className="flex justify-center gap-4">
              <Button variant="secondary" onClick={() => setStep(s => Math.max(0, s - 1))} className="w-auto px-4"><SkipBack /></Button>
              <Button onClick={() => setStep(s => Math.min(sequence.length, s + 1))} className="w-auto px-8">
                {step === sequence.length - 1 ? 'Finalizar' : 'Próximo'}
              </Button>
            </div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Passo {step + 1} de {sequence.length}</p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Volume2 size={16} />
              <span>Tocando: {sequence[step]}.mp3</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-xl text-gray-300">Feche os olhos e siga as instruções do áudio do Host.</p>
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

const GameView = ({ room, me, isHost, onLeave }: { room: Room; me?: Player; isHost: boolean; onLeave: () => void }) => {
  const socket = useSocket();
  const playerId = sessionStorage.getItem('avalon_player_id');
  const currentMission = room.missions[room.currentMissionIndex];
  const leader = room.players[room.currentLeaderIndex];
  const isLeader = playerId === leader.id;
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);

  useEffect(() => {
    if (room.phase === 'team-proposal') {
      setSelectedTeam([]);
    }
  }, [room.phase, room.currentLeaderIndex]);

  const formatName = (p: Player, showCrown = true) => (
    <span className="inline-flex items-center gap-1">
      <span className={!p.socketId ? 'opacity-40 grayscale' : ''}>
        {p.name}
        {p.id === playerId && <span className="font-normal text-blue-300 ml-1">(Eu)</span>}
        {!p.socketId && <span className="text-[8px] ml-1 text-red-400 uppercase font-bold">(Offline)</span>}
      </span>
      {showCrown && p.id === leader.id && <Crown size={14} className="text-[#ffd700] shrink-0" />}
    </span>
  );

  const handlePropose = () => {
    if (selectedTeam.length !== currentMission.size) return alert(`Selecione exatamente ${currentMission.size} jogadores`);
    socket.emit('propose-team', { roomCode: room.code, teamPlayerIds: selectedTeam });
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
            <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Missão Atual</h2>
            <button 
              onClick={onLeave}
              className="p-1 text-gray-600 hover:text-red-400 transition-colors"
              title="Sair da Sala"
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
                  'bg-white/5 border-white/10 text-gray-500'
                }`}
              >
                {m.size}{needsTwoFails(i, room.players.length) ? '*' : ''}
              </div>
            ))}
          </div>
        </div>
        <div className="text-right space-y-1">
          <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Rejeições</h2>
          <div className="flex gap-1 justify-end">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full ${i <= room.rejectionCount ? 'bg-red-500' : 'bg-white/10'}`}></div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Card className="space-y-6">
        {room.phase === 'team-proposal' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <Crown className="mx-auto text-[#ffd700]" size={32} />
              <h3 className="text-2xl font-['Cinzel'] flex items-center justify-center gap-2">
                {isLeader ? 'Você é líder da rodada!' : <>{formatName(leader, false)} é líder da rodada</>}
              </h3>
              <p className="text-gray-400">
                {isLeader 
                  ? `Escolha uma equipe de ${currentMission.size} cavaleiros.` 
                  : 'Aguarde enquanto a equipe é formada.'}
              </p>
            </div>

            {isLeader ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {room.players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedTeam(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : prev.length < currentMission.size ? [...prev, p.id] : prev)}
                      className={`p-3 rounded-xl border-2 transition-all font-bold ${
                        selectedTeam.includes(p.id) ? 'border-[#ffd700] bg-[#ffd700]/10' : 'border-white/5 bg-white/5'
                      }`}
                    >
                      {formatName(p)}
                    </button>
                  ))}
                </div>
                <Button onClick={handlePropose} disabled={selectedTeam.length !== currentMission.size}>Confirmar Equipe</Button>
              </div>
            ) : (
              <div className="py-8 animate-pulse text-gray-500 italic">Aguardando a formação da equipe...</div>
            )}
          </div>
        )}

        {room.phase === 'team-voting' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-2xl font-['Cinzel']">Votação da Equipe</h3>
              <div className="flex flex-wrap justify-center gap-2">
                {room.proposedTeam.map(id => (
                  <span key={id} className="bg-[#ffd700]/20 text-[#ffd700] px-3 py-1 rounded-full text-sm font-bold">
                    {room.players.find(p => p.id === id) ? formatName(room.players.find(p => p.id === id)!) : ''}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {room.teamVotes[playerId || ''] ? (
                <div className="py-8 space-y-4">
                  <p className="text-gray-400 italic">Você votou!</p>
                  <p className="text-sm text-gray-500">Aguardando outros jogadores ({Object.keys(room.teamVotes).length}/{room.players.length})</p>
                </div>
              ) : (
                <div className="flex gap-4">
                  <Button variant="danger" onClick={() => handleVoteTeam('reject')} className="flex-1">❌ Rejeitar</Button>
                  <Button onClick={() => handleVoteTeam('approve')} className="flex-1">✅ Aprovar</Button>
                </div>
              )}

              {isHost && Object.keys(room.teamVotes).length === room.players.length && (
                <div className="py-4 animate-pulse text-[#ffd700] italic">Revelando votos...</div>
              )}
            </div>
          </div>
        )}

        {room.phase === 'mission-voting' && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-2xl font-['Cinzel']">Em Missão</h3>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Votos que aprovaram esta equipe:</p>
              <div className="flex flex-wrap justify-center gap-1 max-w-xs mx-auto">
                {room.players.map(p => (
                  <div key={p.id} className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1 ${
                    room.lastTeamVoteResult?.votes[p.id] === 'approve' 
                      ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                      : 'bg-red-500/10 border-red-500/30 text-red-500'
                  }`}>
                    {formatName(p)}: {room.lastTeamVoteResult?.votes[p.id] === 'approve' ? 'SIM' : 'NÃO'}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {room.proposedTeam.includes(playerId || '') ? (
                room.missionVotes[playerId || ''] ? (
                  <div className="py-8 space-y-4">
                    <p className="text-gray-400 italic">Você agiu!</p>
                    <p className="text-sm text-gray-500">Aguardando equipe ({Object.keys(room.missionVotes).length}/{room.proposedTeam.length})</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-400">Escolha seu destino na missão:</p>
                    <div className="flex gap-4">
                      <Button onClick={() => handleVoteMission('success')} className="flex-1 bg-blue-600 hover:bg-blue-500">🏆 Sucesso</Button>
                      {me?.role && ROLES[me.role].team === 'evil' && (
                        <Button variant="danger" onClick={() => handleVoteMission('fail')} className="flex-1">💣 Falha</Button>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="py-8 space-y-4">
                  <p className="text-gray-400 italic">A equipe está em missão...</p>
                  <p className="text-sm text-gray-500">Aguardando resultados ({Object.keys(room.missionVotes).length}/{room.proposedTeam.length})</p>
                </div>
              )}

              {isHost && Object.keys(room.missionVotes).length === room.proposedTeam.length && (
                <div className="py-4 animate-pulse text-[#ffd700] italic">Revelando resultado...</div>
              )}
            </div>
          </div>
        )}

        {room.phase === 'team-result' && room.lastTeamVoteResult && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className={`text-4xl font-['Cinzel'] ${room.lastTeamVoteResult.passed ? 'text-green-500' : 'text-red-500'}`}>
                EQUIPE {room.lastTeamVoteResult.passed ? 'APROVADA' : 'REJEITADA'}
              </h3>
              <p className="text-gray-400">Votos individuais:</p>
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
                      <><CheckCircle2 size={14} /> APROVOU</>
                    ) : (
                      <><XCircle size={14} /> REJEITOU</>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isHost && (
              <Button onClick={() => socket.emit('continue-game', { roomCode: room.code })}>Continuar</Button>
            )}
          </div>
        )}

        {room.phase === 'mission-result' && room.lastMissionVoteResult && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h3 className={`text-3xl font-['Cinzel'] ${room.lastMissionVoteResult.passed ? 'text-blue-500' : 'text-red-500'}`}>
                Missão {room.lastMissionVoteResult.passed ? 'Sucedida' : 'Falhou'}
              </h3>
              <p className="text-gray-400">Resultado dos votos (anônimos):</p>
            </div>

            <div className="flex justify-center gap-4">
              <div className="flex flex-col items-center p-6 bg-blue-600/20 rounded-2xl border-2 border-blue-600/50 w-32">
                <span className="text-4xl mb-2">🏆</span>
                <span className="text-3xl font-bold">{room.lastMissionVoteResult.votes.filter(v => v === 'success').length}</span>
                <span className="text-xs uppercase tracking-widest opacity-60">Sucessos</span>
              </div>
              <div className="flex flex-col items-center p-6 bg-red-600/20 rounded-2xl border-2 border-red-600/50 w-32">
                <span className="text-4xl mb-2">💣</span>
                <span className="text-3xl font-bold">{room.lastMissionVoteResult.votes.filter(v => v === 'fail').length}</span>
                <span className="text-xs uppercase tracking-widest opacity-60">Falhas</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Relembrando os votos da equipe:</p>
              <div className="flex flex-wrap justify-center gap-1 max-w-xs mx-auto">
                {room.players.map(p => (
                  <div key={p.id} className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1 ${
                    room.lastTeamVoteResult?.votes[p.id] === 'approve' 
                      ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                      : 'bg-red-500/10 border-red-500/30 text-red-500'
                  }`}>
                    {formatName(p)}: {room.lastTeamVoteResult?.votes[p.id] === 'approve' ? 'SIM' : 'NÃO'}
                  </div>
                ))}
              </div>
            </div>

            {isHost && (
              <Button onClick={() => socket.emit('continue-game', { roomCode: room.code })}>Continuar</Button>
            )}
          </div>
        )}

        {room.phase === 'assassination' && (
          <div className="space-y-6 text-center">
            <h3 className="text-2xl font-['Cinzel'] text-red-500">Fase de Assassinato</h3>
            
            {me?.role && ROLES[me.role].team === 'evil' ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
                <p className="text-red-400 font-bold flex items-center justify-center gap-2 uppercase tracking-widest">
                  <Users size={18} /> Reunião do Mal
                </p>
                <p className="text-sm text-gray-300">
                  Discutam quem pode ser o Merlin! O Assassino tem a palavra final e deve realizar o golpe.
                </p>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
                <p className="text-red-400 font-bold flex items-center justify-center gap-2 uppercase tracking-widest">
                  <Info size={18} /> AVISO AO BEM
                </p>
                <p className="text-sm text-gray-300">
                  Fiquem em silêncio! Não revelem seus personagens. O Mal está tentando descobrir quem é Merlin.
                </p>
              </div>
            )}

            <p className="text-gray-300">O Bem venceu 3 missões! O Assassino deve tentar matar Merlin.</p>
            
            {me?.role === 'assassin' ? (
              <div className="space-y-4">
                <p className="font-bold">Quem é Merlin?</p>
                <div className="grid grid-cols-2 gap-2">
                  {room.players.filter(p => p.role && ROLES[p.role].team === 'good').map(p => (
                    <div key={p.id}>
                      <Button variant="outline" onClick={() => socket.emit('assassinate', { roomCode: room.code, targetPlayerId: p.id })} className="text-sm">
                        {formatName(p)}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 animate-pulse text-red-400 italic">Assassino em ação...</div>
            )}
          </div>
        )}

        {room.phase === 'game-over' && (
          <div className="space-y-8 text-center">
            <div className="space-y-2">
              <h3 className={`text-5xl font-['Cinzel'] ${room.winner === 'good' ? 'text-blue-500' : 'text-red-500'}`}>
                {room.winner === 'good' ? 'BEM VENCE!' : 'MAL VENCE!'}
              </h3>
              <p className="text-gray-400 italic">{room.gameOverReason}</p>
              {room.assassinationTargetId && (
                <div className="mt-4 p-4 bg-black/20 rounded-2xl border border-white/10 inline-block">
                  <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Alvo do Assassino</p>
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
                      ? 'Acertou o Merlin!' 
                      : 'Errou! Não era o Merlin.'}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-sm uppercase tracking-widest text-gray-500 font-bold">Revelação Final</h4>
              <div className="grid grid-cols-1 gap-2">
                {room.players.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                    <span className="font-bold">{formatName(p)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{p.role && ROLES[p.role].name}</span>
                      <span>{p.role && ROLES[p.role].icon}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {isHost && (
                <Button onClick={() => socket.emit('reset-game', { roomCode: room.code })}>
                  Jogar Novamente
                </Button>
              )}
              <Button variant="secondary" onClick={() => window.location.href = '/'}>
                Sair da Sala
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Footer Player Info */}
      {me?.role && room.phase !== 'game-over' && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
          <div className="bg-[#1b263b] border border-[#ffd700]/30 rounded-xl p-3 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ROLES[me.role].icon}</span>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-500">Seu Personagem</p>
                <p className="font-bold text-[#ffd700]">{ROLES[me.role].name}</p>
              </div>
            </div>
            <Badge team={ROLES[me.role].team}>{ROLES[me.role].team === 'good' ? 'BEM' : 'MAL'}</Badge>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// --- App ---

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin);
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);

  if (!socket) return null;

  return (
    <SocketContext.Provider value={socket}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:code" element={<Room />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Router>
    </SocketContext.Provider>
  );
}
