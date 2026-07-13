/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import {
  LANCELOT_CONFIGS, generateLoyaltyDeck, shuffle,
  TEAM_DISTRIBUTION, MISSION_SIZES, ROLES, needsTwoFails, assignRoles,
} from "./src/core/avalon.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  // Cliente é servido pelo mesmo servidor (same-origin); origens extras só via env
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false,
    methods: ["GET", "POST"],
  },
  path: '/avalon/socket.io',
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);

interface Player {
  id: string; // Persistent ID
  sessionToken: string; // Secret per-player token — NEVER serialized to clients other than the owner
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

interface LancelotConfig {
  id: string;
  variant: 'var1' | 'var2' | 'var3' | 'var1_var2' | 'var1_var3' | 'var2_var3' | null;
  deckSize: number;
  deckRevealed: boolean;
  startsAt: number;
  mandatory: boolean;
  recognition: boolean;
}

interface MatchRecord {
  id: string;
  timestamp: string;
  playerCount: number;
  players: { name: string; role: string; team: 'good' | 'evil' }[];
  options: {
    lancelot: string;
    ladyOfLake: boolean;
    excalibur: boolean;
    targeting: boolean;
  };
  missions: {
    status: 'pending' | 'success' | 'fail';
    fails: number;
  }[];
  winner: 'good' | 'evil';
  reason: string;
  duration: number;
}

type GamePhase =
  | 'lobby'
  | 'character-reveal'
  | 'narration'
  | 'team-proposal'
  | 'team-voting'
  | 'team-result'
  | 'mission-voting'
  | 'excalibur-usage'
  | 'mission-result'
  | 'lady-of-the-lake'
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
  createdAt: Date;
  lastActivityAt: Date;
  // New fields
  lancelotConfig: LancelotConfig | null;
  loyaltyDeck: ('none' | 'switch')[];
  loyaltyDeckIndex: number;
  loyaltyDeckVisible: ('none' | 'switch' | 'hidden')[];
  lancelotLoyalty: {
    lancelotGoodTeam: 'good' | 'evil';
    lancelotEvilTeam: 'good' | 'evil';
    swapOccurred: boolean;
  } | null;
  ladyOfLakeEnabled: boolean;
  ladyOfLakeHolder: string | null;
  ladyOfLakeUsed: string[];
  ladyOfLakePhase: boolean;
  excaliburEnabled: boolean;
  excaliburHolder: string | null;
  excaliburUsed: boolean;
  excaliburTarget: string | null;
  excaliburReveal: 'success' | 'fail' | null;
  targetingEnabled: boolean;
  attemptedMissions: number[];
  matchHistory: MatchRecord[];
  currentMatchStartedAt: Date | null;
}

const rooms = new Map<string, Room>();
const socketToPlayer = new Map<string, { roomCode: string, playerId: string }>();

// Erros com código estável para o cliente traduzir; message é fallback em PT
const ERROR_MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: "Sala não encontrada",
  ROOM_FULL: "Sala cheia",
  GAME_ALREADY_STARTED: "Jogo já iniciado",
  INVALID_IDENTITY: "Identidade inválida para reconexão",
  LANCELOT_GOOD_MUST_SUCCEED: "Lancelot do Bem deve jogar Sucesso nesta variante.",
  LANCELOT_EVIL_MUST_FAIL: "Lancelot do Mal deve jogar Falha nesta variante.",
  GOOD_MUST_SUCCEED: "Servos Leais de Arthur devem jogar Sucesso.",
};

function emitError(socket: { emit: (ev: string, payload: any) => void }, code: keyof typeof ERROR_MESSAGES) {
  socket.emit("error", { code, message: ERROR_MESSAGES[code] });
}

// Remove salas sem atividade há 4h (não por idade — partidas longas sobrevivem)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivityAt.getTime() > 4 * 60 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 60 * 60 * 1000);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", ({ playerName, playerId }) => {
    let roomCode: string;
    do {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (rooms.has(roomCode)); // colisão sobrescreveria sala ativa
    const sessionToken = crypto.randomUUID();
    const room: Room = {
      code: roomCode,
      hostId: playerId,
      players: [{ id: playerId, sessionToken, socketId: socket.id, name: playerName, isConfirmed: false }],
      phase: 'lobby',
      selectedRoles: [],
      missions: [],
      currentMissionIndex: 0,
      currentLeaderIndex: 0,
      rejectionCount: 0,
      proposedTeam: [],
      teamVotes: {},
      missionVotes: {},
      createdAt: new Date(),
      lastActivityAt: new Date(),
      lancelotConfig: null,
      loyaltyDeck: [],
      loyaltyDeckIndex: 0,
      loyaltyDeckVisible: [],
      lancelotLoyalty: null,
      ladyOfLakeEnabled: false,
      ladyOfLakeHolder: null,
      ladyOfLakeUsed: [],
      ladyOfLakePhase: false,
      excaliburEnabled: false,
      excaliburHolder: null,
      excaliburUsed: false,
      excaliburTarget: null,
      excaliburReveal: null,
      targetingEnabled: false,
      attemptedMissions: [],
      matchHistory: [],
      currentMatchStartedAt: null,
    };
    rooms.set(roomCode, room);
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);
    socket.emit("room-created", { roomCode, playerId, sessionToken });
    broadcastRoom(room);
  });

  socket.on("get-room-info", ({ roomCode, playerId, sessionToken }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND");
      return;
    }

    // Só trata o solicitante como o jogador se o token de sessão conferir
    const player = room.players.find(p => p.id === playerId);
    const authenticated = !!player && !!sessionToken && player.sessionToken === sessionToken;
    if (player && authenticated) {
      player.socketId = socket.id;
      socketToPlayer.set(socket.id, { roomCode, playerId });
      socket.join(roomCode);
    }

    socket.emit("room-updated", serializeRoomFor(room, authenticated ? playerId : null));
  });

  socket.on("join-room", ({ roomCode, playerName, playerId, sessionToken }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND");
      return;
    }

    const existingPlayer = room.players.find(p => p.id === playerId);
    if (existingPlayer) {
      // Reconexão exige token de sessão válido — impede spoof de identidade via playerId público
      if (!sessionToken || existingPlayer.sessionToken !== sessionToken) {
        emitError(socket, "INVALID_IDENTITY");
        return;
      }
      console.log(`Player ${playerId} rejoining room ${roomCode}. Previous name: ${existingPlayer.name}, New name: ${playerName}`);
      existingPlayer.socketId = socket.id;
      existingPlayer.name = playerName; // Update name if changed
      socketToPlayer.set(socket.id, { roomCode, playerId });
      socket.join(roomCode);
      socket.emit("joined-room", { roomCode, playerId, sessionToken: existingPlayer.sessionToken });
      broadcastRoom(room);
      return;
    }

    console.log(`New player ${playerId} (${playerName}) joining room ${roomCode}`);

    if (room.players.length >= 10) {
      emitError(socket, "ROOM_FULL");
      return;
    }
    if (room.phase !== 'lobby') {
      emitError(socket, "GAME_ALREADY_STARTED");
      return;
    }

    const newSessionToken = crypto.randomUUID();
    room.players.push({ id: playerId, sessionToken: newSessionToken, socketId: socket.id, name: playerName, isConfirmed: false });
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);
    socket.emit("joined-room", { roomCode, playerId, sessionToken: newSessionToken });
    broadcastRoom(room);
  });

  socket.on("reorder-players", ({ roomCode, playerIds }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId || room.phase !== 'lobby') return;

    // Aceita apenas uma permutação dos ids atuais — nunca objetos vindos do cliente
    if (!Array.isArray(playerIds) || playerIds.length !== room.players.length) return;
    if (new Set(playerIds).size !== playerIds.length) return;
    if (!playerIds.every((id: string) => room.players.some(p => p.id === id))) return;

    room.players = playerIds.map((id: string) => room.players.find(p => p.id === id)!);
    broadcastRoom(room);
  });

  socket.on("set-first-leader", ({ roomCode, playerId: targetPlayerId }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId || room.phase !== 'lobby') return;
    room.firstLeaderId = targetPlayerId;
    broadcastRoom(room);
  });

  socket.on("start-game", ({ roomCode, selectedRoles, lancelotConfigId, ladyOfLakeEnabled, excaliburEnabled, targetingEnabled }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId) return;
    // Só do lobby (re-emissão mid-game corromperia a partida) e com contagem
    // válida — assignRoles/MISSION_SIZES lançam fora de 5-10 e derrubariam o processo
    if (room.phase !== 'lobby') return;
    if (room.players.length < 5 || room.players.length > 10) return;

    // Só papéis opcionais, sem duplicatas, cabendo na distribuição do time
    // (senão assignRoles estoura e deixa jogador sem papel)
    const OPTIONAL_ROLES = new Set(['percival', 'morgana', 'mordred', 'oberon', 'lancelot_good', 'lancelot_evil']);
    if (!Array.isArray(selectedRoles) || !selectedRoles.every((r: string) => OPTIONAL_ROLES.has(r))) return;
    if (new Set(selectedRoles).size !== selectedRoles.length) return;
    const dist = TEAM_DISTRIBUTION[room.players.length];
    const optGood = selectedRoles.filter((r: string) => ROLES[r].team === 'good').length;
    const optEvil = selectedRoles.filter((r: string) => ROLES[r].team === 'evil').length;
    if (optGood > dist.good - 1 || optEvil > dist.evil - 1) return; // -1: Merlin/Assassino

    // Config do Lancelot resolvida no servidor — cliente envia só o id da variante
    const lancelotConfig: LancelotConfig | null =
      typeof lancelotConfigId === 'string' && LANCELOT_CONFIGS[lancelotConfigId]
        ? { id: lancelotConfigId, ...LANCELOT_CONFIGS[lancelotConfigId] }
        : null;

    room.selectedRoles = selectedRoles;
    room.lancelotConfig = lancelotConfig;
    room.ladyOfLakeEnabled = ladyOfLakeEnabled;
    room.excaliburEnabled = excaliburEnabled;
    room.targetingEnabled = targetingEnabled;
    room.phase = 'character-reveal';
    room.currentMatchStartedAt = new Date();
    
    // Assign roles logic
    const playerIds = room.players.map(p => p.id);
    const assignments = assignRoles(playerIds, selectedRoles);
    room.players.forEach(p => {
      p.role = assignments[p.id];
    });

    // Lancelot setup
    if (lancelotConfig) {
      room.loyaltyDeck = generateLoyaltyDeck(lancelotConfig.deckSize);
      room.loyaltyDeckIndex = 0;
      room.loyaltyDeckVisible = lancelotConfig.deckRevealed 
        ? [...room.loyaltyDeck] 
        : Array(lancelotConfig.deckSize).fill('hidden');
      room.lancelotLoyalty = {
        lancelotGoodTeam: 'good',
        lancelotEvilTeam: 'evil',
        swapOccurred: false
      };
      
      // Initial loyalty swap check - should happen as soon as game starts
      handleLoyaltySwap(room, 0);
    }

    // Lady of the Lake setup
    if (ladyOfLakeEnabled) {
      const firstLeaderIndex = room.firstLeaderId 
        ? room.players.findIndex(p => p.id === room.firstLeaderId)
        : Math.floor(Math.random() * room.players.length);
      
      const leaderIndex = firstLeaderIndex !== -1 ? firstLeaderIndex : 0;
      const holderIndex = (leaderIndex + room.players.length - 1) % room.players.length;
      room.ladyOfLakeHolder = room.players[holderIndex].id;
      room.ladyOfLakeUsed = [room.ladyOfLakeHolder];
    }

    // Initialize missions
    const playerCount = room.players.length;
    const missionSizes = MISSION_SIZES[playerCount];
    room.missions = missionSizes.map((size, index) => ({
      index,
      size,
      status: 'pending',
      votes: [],
      team: [],
    }));

    if (room.firstLeaderId) {
      const leaderIndex = room.players.findIndex(p => p.id === room.firstLeaderId);
      room.currentLeaderIndex = leaderIndex !== -1 ? leaderIndex : Math.floor(Math.random() * playerCount);
    } else {
      room.currentLeaderIndex = Math.floor(Math.random() * playerCount);
    }

    broadcastRoom(room);
  });

  socket.on("reset-game", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId) return;

    room.phase = 'lobby';
    room.players.forEach(p => {
      p.role = undefined;
      p.isConfirmed = false;
    });
    room.selectedRoles = [];
    room.missions = [];
    room.currentMissionIndex = 0;
    room.currentLeaderIndex = 0;
    room.rejectionCount = 0;
    room.proposedTeam = [];
    room.teamVotes = {};
    room.missionVotes = {};
    room.lastTeamVoteResult = undefined;
    room.lastMissionVoteResult = undefined;
    room.assassinationTargetId = undefined;
    room.firstLeaderId = undefined;
    room.winner = undefined;
    room.gameOverReason = undefined;
    room.lancelotConfig = null;
    room.loyaltyDeck = [];
    room.loyaltyDeckIndex = 0;
    room.loyaltyDeckVisible = [];
    room.lancelotLoyalty = null;
    room.ladyOfLakeEnabled = false;
    room.ladyOfLakeHolder = null;
    room.ladyOfLakeUsed = [];
    room.ladyOfLakePhase = false;
    room.excaliburEnabled = false;
    room.excaliburHolder = null;
    room.excaliburUsed = false;
    room.excaliburTarget = null;
    room.excaliburReveal = null;
    room.targetingEnabled = false;
    room.attemptedMissions = [];
    room.currentMatchStartedAt = null;

    broadcastRoom(room);
  });

  socket.on("confirm-character", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || !playerId || room.phase !== 'character-reveal') return;
    const player = room.players.find(p => p.id === playerId);
    if (player) player.isConfirmed = true;

    if (room.players.every(p => p.isConfirmed)) {
      room.phase = 'narration';
    }
    broadcastRoom(room);
  });

  socket.on("narration-ended", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId) return;
    room.phase = 'team-proposal';
    broadcastRoom(room);
  });

  socket.on("propose-team", ({ roomCode, teamPlayerIds, targetMissionIndex }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || room.phase !== 'team-proposal') return;
    if (playerId !== room.players[room.currentLeaderIndex]?.id) return;

    if (!Array.isArray(teamPlayerIds)) return;
    const uniqueIds = new Set(teamPlayerIds);
    if (uniqueIds.size !== teamPlayerIds.length) return;
    if (!teamPlayerIds.every((id: string) => room.players.some(p => p.id === id))) return;

    let missionIndex = room.currentMissionIndex;
    if (room.targetingEnabled && targetMissionIndex !== undefined) {
      if (room.attemptedMissions.includes(targetMissionIndex)) return;
      if (targetMissionIndex === 4 && room.attemptedMissions.length < 2) return;
      missionIndex = targetMissionIndex;
    }

    if (teamPlayerIds.length !== room.missions[missionIndex]?.size) return;

    room.currentMissionIndex = missionIndex;
    room.proposedTeam = teamPlayerIds;
    room.phase = 'team-voting';
    room.teamVotes = {};
    // Regra oficial: portador da Excalibur deve ser membro da equipe da missão —
    // se o líder mudou a equipe depois de designar, a designação cai
    if (room.excaliburHolder && !teamPlayerIds.includes(room.excaliburHolder)) {
      room.excaliburHolder = null;
    }
    broadcastRoom(room);
  });

  socket.on("assign-excalibur", ({ roomCode, targetPlayerId, teamPlayerIds }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || room.phase !== 'team-proposal' || !room.excaliburEnabled) return;
    if (playerId !== room.players[room.currentLeaderIndex]?.id) return;
    // Líder não pode manter a Excalibur consigo
    if (targetPlayerId === playerId) return;
    if (!room.players.some(p => p.id === targetPlayerId)) return;
    // Regra oficial: portador deve ser membro da equipe que o líder está montando
    if (!Array.isArray(teamPlayerIds) || !teamPlayerIds.includes(targetPlayerId)) return;

    room.excaliburHolder = targetPlayerId;
    broadcastRoom(room);
  });

  socket.on("vote-team", ({ roomCode, vote }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || !playerId || room.phase !== 'team-voting') return;
    if (vote !== 'approve' && vote !== 'reject') return;
    if (!room.players.some(p => p.id === playerId)) return;
    room.teamVotes[playerId] = vote;
    
    // Automatic reveal if all voted
    if (Object.keys(room.teamVotes).length === room.players.length) {
      const votes = Object.values(room.teamVotes);
      const approves = votes.filter(v => v === 'approve').length;
      const rejects = votes.length - approves;
      const passed = approves > rejects;

      room.lastTeamVoteResult = {
        votes: { ...room.teamVotes },
        passed
      };
      room.phase = 'team-result';
      
      if (!passed) {
        room.rejectionCount++;
      } else {
        room.rejectionCount = 0;
      }
    }

    broadcastRoom(room);
  });

  socket.on("vote-mission", ({ roomCode, vote }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || !playerId || room.phase !== 'mission-voting') return;
    if (vote !== 'success' && vote !== 'fail') return;
    if (!room.proposedTeam.includes(playerId)) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    const isLancelot = player.role === 'lancelot_good' || player.role === 'lancelot_evil';
    const currentTeam = (player.role && room.lancelotLoyalty && isLancelot)
      ? (player.role === 'lancelot_good' ? room.lancelotLoyalty.lancelotGoodTeam : room.lancelotLoyalty.lancelotEvilTeam)
      : (player.role ? ROLES[player.role].team : 'good');

    // Lancelot mandatory check
    if (isLancelot && room.lancelotConfig?.mandatory) {
      if (currentTeam === 'good' && vote === 'fail') {
        emitError(socket, "LANCELOT_GOOD_MUST_SUCCEED");
        return;
      }
      if (currentTeam === 'evil' && vote === 'success') {
        emitError(socket, "LANCELOT_EVIL_MUST_FAIL");
        return;
      }
    }

    // Normal Good check
    if (!isLancelot && currentTeam === 'good' && vote === 'fail') {
      emitError(socket, "GOOD_MUST_SUCCEED");
      return;
    }

    room.missionVotes[playerId] = vote;
    
    // Automatic reveal if all in team voted
    if (Object.keys(room.missionVotes).length === room.proposedTeam.length) {
      if (room.excaliburEnabled && room.excaliburHolder && !room.excaliburUsed) {
        room.phase = 'excalibur-usage';
      } else {
        processMissionResult(room);
      }
    }

    broadcastRoom(room);
  });

  socket.on("use-excalibur", ({ roomCode, targetPlayerId }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    // Checagem de fase: sem ela o holder podia resolver a missão com votos parciais
    if (!room || room.phase !== 'excalibur-usage') return;
    if (playerId !== room.excaliburHolder || room.excaliburUsed) return;
    // Regra: Excalibur não inverte o próprio voto
    if (targetPlayerId === playerId) return;

    const originalVote = room.missionVotes[targetPlayerId];
    if (!originalVote) return;

    room.excaliburUsed = true;
    room.excaliburTarget = targetPlayerId;
    room.excaliburReveal = originalVote;
    
    // Swap the vote
    room.missionVotes[targetPlayerId] = originalVote === 'success' ? 'fail' : 'success';

    processMissionResult(room);
    broadcastRoom(room);
  });

  socket.on("skip-excalibur", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || room.phase !== 'excalibur-usage') return;
    if (playerId !== room.excaliburHolder || room.excaliburUsed) return;

    room.excaliburUsed = true;
    processMissionResult(room);
    broadcastRoom(room);
  });

  socket.on("lady-examine", ({ roomCode, targetPlayerId }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.ladyOfLakeHolder || !room.ladyOfLakePhase) return;

    if (room.ladyOfLakeUsed.includes(targetPlayerId)) return;

    const targetPlayer = room.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer?.role || !ROLES[targetPlayer.role]) return;

    let loyalty: 'good' | 'evil' = ROLES[targetPlayer.role].team;
    
    // Lancelot loyalty check
    if (targetPlayer.role === 'lancelot_good') loyalty = room.lancelotLoyalty!.lancelotGoodTeam;
    if (targetPlayer.role === 'lancelot_evil') loyalty = room.lancelotLoyalty!.lancelotEvilTeam;

    socket.emit("lady-result", { holderPlayerId: playerId, targetPlayerId, loyalty });
    
    room.ladyOfLakeHolder = targetPlayerId;
    room.ladyOfLakeUsed.push(targetPlayerId);
    room.ladyOfLakePhase = false;

    advanceToNextMission(room);

    broadcastRoom(room);
  });

  socket.on("continue-game", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId) return;

    if (room.phase === 'team-result') {
      if (room.lastTeamVoteResult?.passed) {
        room.phase = 'mission-voting';
        room.missionVotes = {};
        room.missions[room.currentMissionIndex].team = room.proposedTeam;
      } else {
        if (room.rejectionCount >= 5) {
          room.phase = 'game-over';
          room.winner = 'evil';
          room.gameOverReason = '5 equipes rejeitadas consecutivamente';
          saveMatchHistory(room);
        } else {
          room.phase = 'team-proposal';
          room.proposedTeam = []; // Reset proposed team
          room.excaliburHolder = null; // novo líder faz nova atribuição
          room.currentLeaderIndex = (room.currentLeaderIndex + 1) % room.players.length;
        }
      }
    } else if (room.phase === 'mission-result') {
      if (checkGameOver(room)) {
        broadcastRoom(room);
        return;
      }

      // Lady of the Lake check
      const completedMissions = room.missions.filter(m => m.status !== 'pending').length;
      if (room.ladyOfLakeEnabled && [2, 3, 4].includes(completedMissions)) {
        room.ladyOfLakePhase = true;
        room.phase = 'lady-of-the-lake';
      } else {
        advanceToNextMission(room);
      }
    } else if (room.phase === 'character-reveal') {
      room.phase = 'team-proposal';
      room.proposedTeam = [];
      room.missionVotes = {};
      room.teamVotes = {};
      room.rejectionCount = 0;
      
      // No need to call handleLoyaltySwap(room, 0) here as it's now called in start-game
    }

    broadcastRoom(room);
  });

  socket.on("assassinate", ({ roomCode, targetPlayerId }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || room.phase !== 'assassination') return;
    const shooter = room.players.find(p => p.id === playerId);
    if (shooter?.role !== 'assassin') return;
    if (!room.players.some(p => p.id === targetPlayerId)) return;
    room.assassinationTargetId = targetPlayerId;
    const targetPlayer = room.players.find(p => p.id === targetPlayerId);
    if (targetPlayer?.role === 'merlin') {
      room.winner = 'evil';
      room.gameOverReason = 'Merlin foi assassinado!';
    } else {
      room.winner = 'good';
      room.gameOverReason = 'Merlin sobreviveu!';
    }
    room.phase = 'game-over';
    saveMatchHistory(room);
    broadcastRoom(room);
  });

  socket.on("leave-room", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || !playerId) return;

    socket.leave(roomCode);
    socketToPlayer.delete(socket.id);

    // Partida em andamento: remover quebraria índices de líder e tamanhos de
    // missão já fixados para N jogadores — trata como desconexão (fica offline)
    if (room.phase !== 'lobby') {
      const player = room.players.find(p => p.id === playerId);
      if (player) player.socketId = "";
      broadcastRoom(room);
      return;
    }

    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) {
      rooms.delete(roomCode);
    } else {
      if (room.hostId === playerId) {
        room.hostId = room.players[0].id;
      }
      broadcastRoom(room);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    const info = socketToPlayer.get(socket.id);
    if (!info) return;

    const { roomCode, playerId } = info;
    const room = rooms.get(roomCode);
    if (!room) {
      socketToPlayer.delete(socket.id);
      return;
    }

    // Check if the player has other active sockets in this room
    const otherSocketsForPlayer = Array.from(socketToPlayer.entries())
      .filter(([sid, data]) => sid !== socket.id && data.playerId === playerId && data.roomCode === roomCode);

    if (otherSocketsForPlayer.length === 0) {
      // This was the last socket for this player
      if (room.phase !== 'lobby') {
        const player = room.players.find(p => p.id === playerId);
        if (player) player.socketId = ""; // Show as offline
        broadcastRoom(room);
      } else {
        // In lobby, remove the player entirely
        room.players = room.players.filter(p => p.id !== playerId);
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          if (room.hostId === playerId) {
            room.hostId = room.players[0].id;
          }
          broadcastRoom(room);
        }
      }
    } else {
      // Player still has other sockets open, just update the active socketId if it was this one
      const player = room.players.find(p => p.id === playerId);
      if (player && player.socketId === socket.id) {
        player.socketId = otherSocketsForPlayer[0][0]; // Switch to another active socket
        broadcastRoom(room);
      }
    }
    
    socketToPlayer.delete(socket.id);
  });
});

interface KnowledgeItem {
  playerId: string;
  hint: 'evil' | 'maybe-merlin' | 'lancelot';
  team?: 'good' | 'evil';
}

// Espelha as regras de conhecimento do jogo (antes computadas no cliente em KnowledgeSection)
function computeKnowledge(room: Room, viewer: Player): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];
  const role = viewer.role;
  if (!role || !ROLES[role]) return items;

  // Lancelots com var3 (recognition): reconhecem-se
  if (room.lancelotConfig?.variant?.includes('var3') && (role === 'lancelot_good' || role === 'lancelot_evil')) {
    const other = room.players.find(p => p.id !== viewer.id && (p.role === 'lancelot_good' || p.role === 'lancelot_evil'));
    if (other) items.push({ playerId: other.id, hint: 'lancelot', team: ROLES[other.role!].team });
  }

  // Malvados (exceto Oberon e Lancelot Mau) veem os outros malvados (exceto Oberon)
  if (ROLES[role].team === 'evil' && role !== 'oberon' && role !== 'lancelot_evil') {
    room.players
      .filter(p => p.id !== viewer.id && p.role && ROLES[p.role].team === 'evil' && p.role !== 'oberon')
      .forEach(p => items.push({ playerId: p.id, hint: 'evil', team: 'evil' }));
  }

  // Merlin vê todos os malvados exceto Mordred
  if (role === 'merlin') {
    room.players
      .filter(p => p.id !== viewer.id && p.role && ROLES[p.role].team === 'evil' && p.role !== 'mordred')
      .forEach(p => items.push({ playerId: p.id, hint: 'evil', team: 'evil' }));
  }

  // Percival vê Merlin e Morgana sem distinguir
  if (role === 'percival') {
    room.players
      .filter(p => p.role === 'merlin' || p.role === 'morgana')
      .forEach(p => items.push({ playerId: p.id, hint: 'maybe-merlin' }));
  }

  return items;
}

function serializeRoomFor(room: Room, viewerId: string | null) {
  const revealRoles = room.phase === 'game-over';
  const viewer = viewerId ? room.players.find(p => p.id === viewerId) : undefined;
  const view: any = {
    ...room,
    players: room.players.map(p => ({
      id: p.id,
      socketId: p.socketId ? 'online' : '', // cliente só usa truthiness (indicador offline)
      name: p.name,
      isConfirmed: p.isConfirmed,
      role: revealRoles || p.id === viewerId ? p.role : undefined,
    })),
    // Mascara cartas de lealdade ainda não reveladas (defesa em profundidade)
    loyaltyDeckVisible: room.loyaltyDeckVisible.map((c, i) =>
      room.lancelotConfig?.deckRevealed || i < room.loyaltyDeckIndex ? c : 'hidden'),
    teamVotesCount: Object.keys(room.teamVotes).length,
    missionVotesCount: Object.keys(room.missionVotes).length,
    hasVotedTeam: viewerId ? room.teamVotes[viewerId] !== undefined : false,
    hasVotedMission: viewerId ? room.missionVotes[viewerId] !== undefined : false,
    knowledge: viewer ? computeKnowledge(room, viewer) : [],
  };
  delete view.teamVotes;
  delete view.missionVotes;
  delete view.loyaltyDeck;
  return view;
}

function broadcastRoom(room: Room) {
  room.lastActivityAt = new Date(); // todo avanço de estado passa por aqui
  for (const p of room.players) {
    if (p.socketId) {
      io.to(p.socketId).emit('room-updated', serializeRoomFor(room, p.id));
    }
  }
}

function processMissionResult(room: Room) {
  const votes = Object.values(room.missionVotes);
  const fails = votes.filter(v => v === 'fail').length;
  const mission = room.missions[room.currentMissionIndex];
  
  const playerCount = room.players.length;
  const failsNeeded = needsTwoFails(room.currentMissionIndex, playerCount) ? 2 : 1;
  const passed = fails < failsNeeded;

  if (passed) {
    mission.status = 'success';
  } else {
    mission.status = 'fail';
  }
  mission.votes = shuffle(votes);

  room.lastMissionVoteResult = {
    votes: mission.votes,
    passed
  };
  room.phase = 'mission-result';
  
  if (room.targetingEnabled) {
    room.attemptedMissions.push(room.currentMissionIndex);
  }
}

function advanceToNextMission(room: Room) {
  const completedMissions = room.missions.filter(m => m.status !== 'pending').length;

  room.phase = 'team-proposal';
  room.proposedTeam = [];
  room.missionVotes = {};
  room.teamVotes = {};
  room.rejectionCount = 0;

  if (!room.targetingEnabled) {
    room.currentMissionIndex++;
  }
  room.currentLeaderIndex = (room.currentLeaderIndex + 1) % room.players.length;

  // Excalibur reset
  room.excaliburHolder = null;
  room.excaliburUsed = false;
  room.excaliburTarget = null;
  room.excaliburReveal = null;

  // Loyalty swap check — rodadas decorridas = missões resolvidas (vale com e sem targeting)
  if (room.lancelotConfig) {
    handleLoyaltySwap(room, completedMissions);
  }
}

function handleLoyaltySwap(room: Room, roundIndex: number) {
  if (!room.lancelotConfig) return;
  const config = room.lancelotConfig;

  // Check if we should reveal a card for this round
  if (roundIndex + 1 >= config.startsAt) {
    const deckIdx = roundIndex + 1 - config.startsAt;
    
    // Prevent duplicate swaps for the same round index
    if (room.loyaltyDeckIndex >= deckIdx + 1) return;

    if (deckIdx < room.loyaltyDeck.length) {
      const card = room.loyaltyDeck[deckIdx];
      
      // Reveal the card
      room.loyaltyDeckVisible[deckIdx] = card;
      
      // Update swapOccurred for UI feedback
      room.lancelotLoyalty!.swapOccurred = (card === 'switch');
      
      if (card === 'switch') {
        // Swap loyalty
        const temp = room.lancelotLoyalty!.lancelotGoodTeam;
        room.lancelotLoyalty!.lancelotGoodTeam = room.lancelotLoyalty!.lancelotEvilTeam;
        room.lancelotLoyalty!.lancelotEvilTeam = temp;
      }
      
      room.loyaltyDeckIndex = deckIdx + 1;
    } else {
      room.lancelotLoyalty!.swapOccurred = false;
    }
  } else {
    room.lancelotLoyalty!.swapOccurred = false;
  }
}

function checkGameOver(room: Room) {
  const successes = room.missions.filter(m => m.status === 'success').length;
  const failures = room.missions.filter(m => m.status === 'fail').length;

  if (successes >= 3) {
    // Assassino é papel obrigatório — 3 sucessos sempre levam à fase de assassinato
    room.phase = 'assassination';
    return true;
  }

  if (failures >= 3) {
    room.phase = 'game-over';
    room.winner = 'evil';
    room.gameOverReason = 'Três missões falharam!';
    saveMatchHistory(room);
    return true;
  }
  return false;
}

function saveMatchHistory(room: Room) {
  const match: MatchRecord = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    playerCount: room.players.length,
    players: room.players.map(p => {
      let team: 'good' | 'evil' = p.role && ROLES[p.role] ? ROLES[p.role].team : 'good';
      if (p.role === 'lancelot_good' && room.lancelotLoyalty) team = room.lancelotLoyalty.lancelotGoodTeam;
      if (p.role === 'lancelot_evil' && room.lancelotLoyalty) team = room.lancelotLoyalty.lancelotEvilTeam;
      return {
        name: p.name,
        role: p.role ?? 'unknown',
        team
      };
    }),
    options: {
      lancelot: room.lancelotConfig ? room.lancelotConfig.id : 'none',
      ladyOfLake: room.ladyOfLakeEnabled,
      excalibur: room.excaliburEnabled,
      targeting: room.targetingEnabled
    },
    missions: room.missions.map(m => ({
      status: m.status,
      fails: m.votes.filter(v => v === 'fail').length
    })),
    winner: room.winner!,
    reason: room.gameOverReason!,
    duration: room.currentMatchStartedAt ? Math.floor((Date.now() - room.currentMatchStartedAt.getTime()) / 1000) : 0
  };
  room.matchHistory.unshift(match);
  if (room.matchHistory.length > 10) room.matchHistory.pop();
}

export { httpServer, io };

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use('/avalon', express.static(distPath));
    app.get('/avalon/*', (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.get('/', (req, res) => res.redirect(301, '/avalon/'));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}
