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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = 3000;

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
  createdAt: Date;
}

const rooms = new Map<string, Room>();
const socketToPlayer = new Map<string, { roomCode: string, playerId: string }>();

// Cleanup old rooms
setInterval(() => {
  const now = new Date();
  for (const [code, room] of rooms.entries()) {
    if (now.getTime() - room.createdAt.getTime() > 4 * 60 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 60 * 60 * 1000);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", ({ playerName, playerId }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room: Room = {
      code: roomCode,
      hostId: playerId,
      players: [{ id: playerId, socketId: socket.id, name: playerName, isConfirmed: false }],
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
    };
    rooms.set(roomCode, room);
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);
    socket.emit("room-created", { roomCode, playerId });
    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("get-room-info", ({ roomCode, playerId }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("error", { message: "Sala não encontrada" });
      return;
    }
    
    // Update socket ID if player is already in the room
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.socketId = socket.id;
      socketToPlayer.set(socket.id, { roomCode, playerId });
      socket.join(roomCode);
    }
    
    socket.emit("room-updated", room);
  });

  socket.on("join-room", ({ roomCode, playerName, playerId }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("error", { message: "Sala não encontrada" });
      return;
    }

    const existingPlayer = room.players.find(p => p.id === playerId);
    if (existingPlayer) {
      console.log(`Player ${playerId} rejoining room ${roomCode}. Previous name: ${existingPlayer.name}, New name: ${playerName}`);
      existingPlayer.socketId = socket.id;
      existingPlayer.name = playerName; // Update name if changed
      socketToPlayer.set(socket.id, { roomCode, playerId });
      socket.join(roomCode);
      socket.emit("joined-room", { roomCode, playerId });
      io.to(roomCode).emit("room-updated", room);
      return;
    }

    console.log(`New player ${playerId} (${playerName}) joining room ${roomCode}`);

    if (room.players.length >= 10) {
      socket.emit("error", { message: "Sala cheia" });
      return;
    }
    if (room.phase !== 'lobby') {
      socket.emit("error", { message: "Jogo já iniciado" });
      return;
    }

    room.players.push({ id: playerId, socketId: socket.id, name: playerName, isConfirmed: false });
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);
    socket.emit("joined-room", { roomCode, playerId });
    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("reorder-players", ({ roomCode, players }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId || room.phase !== 'lobby') return;
    room.players = players;
    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("set-first-leader", ({ roomCode, playerId: targetPlayerId }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId || room.phase !== 'lobby') return;
    room.firstLeaderId = targetPlayerId;
    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("start-game", ({ roomCode, selectedRoles }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId) return;

    room.selectedRoles = selectedRoles;
    room.phase = 'character-reveal';
    
    // Assign roles logic
    const playerIds = room.players.map(p => p.id);
    const assignments = assignRoles(playerIds, selectedRoles);
    room.players.forEach(p => {
      p.role = assignments[p.id];
    });

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

    io.to(roomCode).emit("room-updated", room);
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

    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("confirm-character", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || !playerId) return;
    const player = room.players.find(p => p.id === playerId);
    if (player) player.isConfirmed = true;

    if (room.players.every(p => p.isConfirmed)) {
      room.phase = 'narration';
    }
    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("start-narration", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId) return;
    io.to(roomCode).emit("narration-started");
  });

  socket.on("narration-ended", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || playerId !== room.hostId) return;
    room.phase = 'team-proposal';
    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("propose-team", ({ roomCode, teamPlayerIds }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.proposedTeam = teamPlayerIds;
    room.phase = 'team-voting';
    room.teamVotes = {};
    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("vote-team", ({ roomCode, vote }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || !playerId) return;
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

    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("reveal-team-vote", ({ roomCode }) => {
    // Deprecated but kept for compatibility if needed
    const room = rooms.get(roomCode);
    if (!room || socket.id !== room.hostId) return;
    
    if (Object.keys(room.teamVotes).length < room.players.length) return;

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

    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("vote-mission", ({ roomCode, vote }) => {
    const room = rooms.get(roomCode);
    const { playerId } = socketToPlayer.get(socket.id) || {};
    if (!room || !playerId) return;
    room.missionVotes[playerId] = vote;
    
    // Automatic reveal if all in team voted
    if (Object.keys(room.missionVotes).length === room.proposedTeam.length) {
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
      mission.votes = [...votes].sort(() => Math.random() - 0.5);

      room.lastMissionVoteResult = {
        votes: mission.votes,
        passed
      };
      room.phase = 'mission-result';
    }

    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("reveal-mission", ({ roomCode }) => {
    // Deprecated but kept for compatibility
    const room = rooms.get(roomCode);
    if (!room || socket.id !== room.hostId) return;

    if (Object.keys(room.missionVotes).length < room.proposedTeam.length) return;

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
    mission.votes = [...votes].sort(() => Math.random() - 0.5);

    room.lastMissionVoteResult = {
      votes: mission.votes,
      passed
    };
    room.phase = 'mission-result';

    io.to(roomCode).emit("room-updated", room);
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
        } else {
          room.phase = 'team-proposal';
          room.proposedTeam = []; // Reset proposed team
          room.currentLeaderIndex = (room.currentLeaderIndex + 1) % room.players.length;
        }
      }
    } else if (room.phase === 'mission-result') {
      const successCount = room.missions.filter(m => m.status === 'success').length;
      const failCount = room.missions.filter(m => m.status === 'fail').length;

      if (failCount >= 3) {
        room.phase = 'game-over';
        room.winner = 'evil';
        room.gameOverReason = '3 missões falharam';
      } else if (successCount >= 3) {
        room.phase = 'assassination';
      } else {
        room.phase = 'team-proposal';
        room.proposedTeam = []; // Reset proposed team
        room.currentMissionIndex++;
        room.currentLeaderIndex = (room.currentLeaderIndex + 1) % room.players.length;
      }
    }

    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("assassinate", ({ roomCode, targetPlayerId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
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
    io.to(roomCode).emit("room-updated", room);
  });

  socket.on("leave-room", ({ roomCode, playerId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);
    socket.leave(roomCode);
    socketToPlayer.delete(socket.id);

    if (room.players.length === 0) {
      rooms.delete(roomCode);
    } else {
      if (room.hostId === playerId) {
        room.hostId = room.players[0].id;
      }
      io.to(roomCode).emit("room-updated", room);
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
        io.to(roomCode).emit("room-updated", room);
      } else {
        // In lobby, remove the player entirely
        room.players = room.players.filter(p => p.id !== playerId);
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          if (room.hostId === playerId) {
            room.hostId = room.players[0].id;
          }
          io.to(roomCode).emit("room-updated", room);
        }
      }
    } else {
      // Player still has other sockets open, just update the active socketId if it was this one
      const player = room.players.find(p => p.id === playerId);
      if (player && player.socketId === socket.id) {
        player.socketId = otherSocketsForPlayer[0][0]; // Switch to another active socket
        io.to(roomCode).emit("room-updated", room);
      }
    }
    
    socketToPlayer.delete(socket.id);
  });
});

// Avalon game logic helper (duplicate for server context)
const TEAM_DISTRIBUTION: Record<number, { good: number; evil: number }> = {
  5: { good: 3, evil: 2 },
  6: { good: 4, evil: 2 },
  7: { good: 4, evil: 3 },
  8: { good: 5, evil: 3 },
  9: { good: 6, evil: 3 },
  10: { good: 6, evil: 4 },
};

const MISSION_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

const ROLES: Record<string, { team: 'good' | 'evil' }> = {
  merlin: { team: 'good' },
  assassin: { team: 'evil' },
  servant: { team: 'good' },
  minion: { team: 'evil' },
  percival: { team: 'good' },
  morgana: { team: 'evil' },
  mordred: { team: 'evil' },
  oberon: { team: 'evil' },
};

function needsTwoFails(missionIndex: number, playerCount: number): boolean {
  return missionIndex === 3 && playerCount >= 7;
}

function assignRoles(playerIds: string[], selectedOptionalRoles: string[]): Record<string, string> {
  const playerCount = playerIds.length;
  const distribution = TEAM_DISTRIBUTION[playerCount];
  if (!distribution) throw new Error('Número de jogadores inválido');

  const rolesToAssign: string[] = [];
  rolesToAssign.push('merlin');
  rolesToAssign.push('assassin');
  selectedOptionalRoles.forEach(roleId => rolesToAssign.push(roleId));

  const currentGood = rolesToAssign.filter(r => ROLES[r].team === 'good').length;
  const currentEvil = rolesToAssign.filter(r => ROLES[r].team === 'evil').length;

  for (let i = 0; i < distribution.good - currentGood; i++) rolesToAssign.push('servant');
  for (let i = 0; i < distribution.evil - currentEvil; i++) rolesToAssign.push('minion');

  const shuffledRoles = [...rolesToAssign].sort(() => Math.random() - 0.5);
  const assignments: Record<string, string> = {};
  playerIds.forEach((id, index) => {
    assignments[id] = shuffledRoles[index];
  });
  return assignments;
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
