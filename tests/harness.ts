/**
 * Harness de integração: sobe o servidor socket.io real em porta efêmera
 * e simula múltiplos jogadores conectados.
 */
import { io as ioClient, Socket } from 'socket.io-client';
import { httpServer } from '../server.ts';
import type { AddressInfo } from 'net';

let serverStarted = false;
let baseUrl = '';

export async function ensureServer(): Promise<string> {
  if (!serverStarted) {
    await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    serverStarted = true;
  }
  return baseUrl;
}

export async function closeServer() {
  if (serverStarted) {
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
    serverStarted = false;
  }
}

export interface TestClient {
  name: string;
  playerId: string;
  socket: Socket;
  lastError: string | null;
  ladyResults: any[];
}

const EVIL_ROLES = new Set(['assassin', 'minion', 'morgana', 'mordred', 'oberon', 'lancelot_evil']);

export class Harness {
  clients: TestClient[] = [];
  room: any = null;
  code = '';

  static async create(playerCount: number): Promise<Harness> {
    const url = await ensureServer();
    const h = new Harness();
    const runId = Math.random().toString(36).slice(2, 8);

    for (let i = 0; i < playerCount; i++) {
      const socket = ioClient(url, { path: '/avalon/socket.io', transports: ['websocket'] });
      const client: TestClient = {
        name: `P${i + 1}`,
        playerId: `t-${runId}-${i}`,
        socket,
        lastError: null,
        ladyResults: [],
      };
      socket.on('room-updated', (r: any) => { h.room = r; });
      socket.on('error', (e: any) => { client.lastError = e?.message ?? String(e); });
      socket.on('lady-result', (r: any) => { client.ladyResults.push(r); });
      h.clients.push(client);
      await new Promise<void>(resolve => socket.on('connect', () => resolve()));
    }

    const host = h.clients[0];
    host.socket.emit('create-room', { playerName: host.name, playerId: host.playerId });
    await h.waitFor(() => h.room !== null);
    h.code = h.room.code;

    for (const c of h.clients.slice(1)) {
      c.socket.emit('join-room', { roomCode: h.code, playerName: c.name, playerId: c.playerId });
      await h.waitFor(() => h.room.players.some((p: any) => p.id === c.playerId));
    }
    return h;
  }

  get host() { return this.clients[0]; }

  byId(id: string): TestClient {
    const c = this.clients.find(c => c.playerId === id);
    if (!c) throw new Error(`cliente ${id} não encontrado`);
    return c;
  }

  leader(): TestClient {
    return this.byId(this.room.players[this.room.currentLeaderIndex].id);
  }

  playersByTeam(team: 'good' | 'evil'): TestClient[] {
    return this.room.players
      .filter((p: any) => (team === 'evil') === EVIL_ROLES.has(p.role))
      .map((p: any) => this.byId(p.id));
  }

  roleOf(client: TestClient): string {
    return this.room.players.find((p: any) => p.id === client.playerId).role;
  }

  withRole(role: string): TestClient {
    const p = this.room.players.find((p: any) => p.role === role);
    if (!p) throw new Error(`nenhum jogador com papel ${role}`);
    return this.byId(p.id);
  }

  async waitFor(cond: () => boolean, label = 'condição', timeout = 5000) {
    const start = Date.now();
    while (!cond()) {
      if (Date.now() - start > timeout) {
        throw new Error(`timeout esperando ${label} (phase=${this.room?.phase})`);
      }
      await new Promise(r => setTimeout(r, 25));
    }
  }

  async waitPhase(phase: string, timeout = 5000) {
    await this.waitFor(() => this.room?.phase === phase, `phase=${phase}`, timeout);
  }

  /** lobby → team-proposal (start, reveal, narração) */
  async startGame(options: Partial<{
    selectedRoles: string[];
    lancelotConfig: any;
    ladyOfLakeEnabled: boolean;
    excaliburEnabled: boolean;
    targetingEnabled: boolean;
  }> = {}) {
    this.host.socket.emit('start-game', {
      roomCode: this.code,
      selectedRoles: [],
      lancelotConfig: null,
      ladyOfLakeEnabled: false,
      excaliburEnabled: false,
      targetingEnabled: false,
      ...options,
    });
    await this.waitPhase('character-reveal');
    this.clients.forEach(c => c.socket.emit('confirm-character', { roomCode: this.code }));
    await this.waitPhase('narration');
    this.host.socket.emit('narration-ended', { roomCode: this.code });
    await this.waitPhase('team-proposal');
  }

  /** Propõe time e aprova por unanimidade; para em mission-voting. */
  async proposeAndApprove(teamIds: string[]) {
    this.leader().socket.emit('propose-team', { roomCode: this.code, teamPlayerIds: teamIds });
    await this.waitPhase('team-voting');
    this.clients.forEach(c => c.socket.emit('vote-team', { roomCode: this.code, vote: 'approve' }));
    await this.waitPhase('team-result');
    this.host.socket.emit('continue-game', { roomCode: this.code });
    await this.waitPhase('mission-voting');
  }

  /** Monta time do tamanho da missão atual com `evilCount` malvados incluídos. */
  currentTeam(evilCount: number): string[] {
    const size = this.room.missions[this.room.currentMissionIndex].size;
    const evil = this.playersByTeam('evil').slice(0, evilCount);
    const good = this.playersByTeam('good');
    const team = [...evil, ...good].slice(0, size);
    if (team.length !== size) throw new Error('jogadores insuficientes para o time');
    return team.map(c => c.playerId);
  }

  /** Joga a missão atual do início ao fim. failVotes = quantos do time jogam falha (precisam ser evil). */
  async playMission({ failVotes = 0 } = {}) {
    const team = this.currentTeam(failVotes);
    await this.proposeAndApprove(team);

    let fails = failVotes;
    for (const id of team) {
      const c = this.byId(id);
      const isEvil = EVIL_ROLES.has(this.roleOf(c));
      const vote = isEvil && fails > 0 ? (fails--, 'fail') : 'success';
      c.socket.emit('vote-mission', { roomCode: this.code, vote });
    }
    await this.waitPhase('mission-result');
    this.host.socket.emit('continue-game', { roomCode: this.code });
    await this.waitFor(() => this.room.phase !== 'mission-result', 'saída de mission-result');
  }

  async destroy() {
    this.clients.forEach(c => c.socket.disconnect());
    this.clients = [];
  }
}
