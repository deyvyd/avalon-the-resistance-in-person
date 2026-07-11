import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { Harness, closeServer, ensureServer } from './harness.ts';

let h: Harness;

afterEach(async () => { if (h) await h.destroy(); });
afterAll(async () => { await closeServer(); });

describe('sanitização de estado por jogador', () => {
  it('não vaza papéis de outros jogadores antes do game-over', async () => {
    h = await Harness.create(5);
    await h.startGame();
    for (const viewer of h.clients) {
      const view = viewer.room;
      for (const p of view.players) {
        if (p.id === viewer.playerId) {
          expect(p.role, 'próprio papel deve estar presente').toBeTruthy();
        } else {
          expect(p.role, `papel de ${p.name} vazou para ${viewer.name}`).toBeUndefined();
        }
      }
    }
  });

  it('não vaza mapa de votos de missão durante a votação', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const team = h.currentTeam(0);
    await h.proposeAndApprove(team);
    h.byId(team[0]).socket.emit('vote-mission', { roomCode: h.code, vote: 'success' });
    await h.waitFor(() => h.room.missionVotesCount === 1, 'contagem de voto de missão');
    for (const viewer of h.clients) {
      expect(viewer.room.missionVotes).toBeUndefined();
      expect(viewer.room.missionVotesCount).toBe(1);
    }
    const voter = h.byId(team[0]);
    const nonVoter = h.byId(team[1]);
    expect(voter.room.hasVotedMission).toBe(true);
    expect(nonVoter.room.hasVotedMission).toBe(false);
  });

  it('não vaza mapa de votos de equipe durante a votação', async () => {
    h = await Harness.create(5);
    await h.startGame();
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: h.currentTeam(0) });
    await h.waitPhase('team-voting');
    h.clients[0].socket.emit('vote-team', { roomCode: h.code, vote: 'approve' });
    await h.waitFor(() => h.room.teamVotesCount === 1, 'contagem de voto de equipe');
    for (const viewer of h.clients) {
      expect(viewer.room.teamVotes).toBeUndefined();
      expect(viewer.room.teamVotesCount).toBe(1);
    }
    expect(h.clients[0].room.hasVotedTeam).toBe(true);
    expect(h.clients[1].room.hasVotedTeam).toBe(false);
  });

  it('não vaza loyaltyDeck oculto (variante var1)', async () => {
    h = await Harness.create(5);
    await h.startGame({
      selectedRoles: ['lancelot_good', 'lancelot_evil'],
      lancelotConfig: { id: 'var1', variant: 'var1', deckSize: 5, deckRevealed: false, startsAt: 3, mandatory: false, recognition: false },
    });
    for (const viewer of h.clients) {
      expect(viewer.room.loyaltyDeck).toBeUndefined();
      expect(viewer.room.loyaltyDeckVisible.every((c: string) => c === 'hidden')).toBe(true);
    }
  });

  it('game-over revela papéis para todos', async () => {
    h = await Harness.create(5);
    await h.startGame();
    await h.playMission({ failVotes: 1 });
    await h.playMission({ failVotes: 1 });
    await h.playMission({ failVotes: 1 });
    expect(h.room.phase).toBe('game-over');
    for (const viewer of h.clients) {
      expect(viewer.room.players.every((p: any) => typeof p.role === 'string')).toBe(true);
    }
  });

  it('conhecimento derivado chega correto: merlin vê os malvados', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const merlin = h.withRole('merlin');
    const evilIds = h.playersByTeam('evil').map(c => c.playerId).sort();
    const seen = merlin.room.knowledge
      .filter((k: any) => k.hint === 'evil')
      .map((k: any) => k.playerId)
      .sort();
    expect(seen).toEqual(evilIds);
    // e um servo não sabe nada
    const servant = h.playersByTeam('good').find(c => h.roleOf(c) === 'servant')!;
    expect(servant.room.knowledge).toEqual([]);
  });
});

describe('sessionToken contra spoof de identidade', () => {
  it('get-room-info com playerId alheio e sem token serve visão de espectador e não sequestra o socket', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const a = h.clients[0];
    const b = h.clients[1];

    const seqBefore = b.roomSeq;
    b.socket.emit('get-room-info', { roomCode: h.code, playerId: a.playerId });
    await h.waitFor(() => b.roomSeq > seqBefore, 'resposta do get-room-info spoofado');

    // Visão de espectador: nenhum papel visível, nenhum conhecimento
    expect(b.room.players.every((p: any) => p.role === undefined)).toBe(true);
    expect(b.room.knowledge).toEqual([]);

    // Binding de A intacto: A continua recebendo broadcasts
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: h.currentTeam(0) });
    await h.waitFor(() => a.room.phase === 'team-voting', 'A recebe update após spoof');
  });

  it('get-room-info com token errado não entrega o papel do dono do id', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const a = h.clients[0];
    const b = h.clients[1];

    const seqBefore = b.roomSeq;
    b.socket.emit('get-room-info', { roomCode: h.code, playerId: a.playerId, sessionToken: 'token-falso' });
    await h.waitFor(() => b.roomSeq > seqBefore, 'resposta do get-room-info com token errado');
    expect(b.room.players.find((p: any) => p.id === a.playerId).role).toBeUndefined();
  });

  it('get-room-info com token correto entrega a própria visão (reconexão legítima)', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const a = h.clients[0];
    const seqBefore = a.roomSeq;
    a.socket.emit('get-room-info', { roomCode: h.code, playerId: a.playerId, sessionToken: a.sessionToken });
    await h.waitFor(() => a.roomSeq > seqBefore, 'resposta do get-room-info legítimo');
    expect(a.room.players.find((p: any) => p.id === a.playerId).role).toBeTruthy();
  });

  it('join-room com playerId alheio e token errado é rejeitado sem alterar a sala', async () => {
    h = await Harness.create(5);
    const a = h.clients[0];
    const b = h.clients[1];
    const countBefore = h.room.players.length;

    b.socket.emit('join-room', { roomCode: h.code, playerName: 'Impostor', playerId: a.playerId, sessionToken: 'token-falso' });
    await h.waitFor(() => b.lastError !== null, 'erro de reconexão spoofada');
    expect(b.lastError).toBe('Identidade inválida para reconexão');
    expect(h.room.players.length).toBe(countBefore);
    expect(h.room.players.find((p: any) => p.id === a.playerId).name).toBe(a.name);
  });

  it('join-room de reconexão com token correto funciona', async () => {
    h = await Harness.create(5);
    const a = h.clients[0];
    a.socket.emit('join-room', { roomCode: h.code, playerName: a.name, playerId: a.playerId, sessionToken: a.sessionToken });
    await h.waitFor(() => h.room.players.length === 5 && a.roomSeq > 0, 'reconexão legítima');
    expect(h.room.players.length).toBe(5);
  });

  it('leave-room com playerId alheio de socket sem identidade não remove ninguém', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const a = h.clients[0];
    const countBefore = h.room.players.length;

    // Socket "atacante" que nunca fez create-room/join-room nesta sala:
    // não tem mapeamento em socketToPlayer, logo não deve conseguir agir em nome de ninguém.
    const url = await ensureServer();
    const attacker = ioClient(url, { path: '/avalon/socket.io', transports: ['websocket'] });
    await new Promise<void>(resolve => attacker.on('connect', () => resolve()));

    attacker.emit('leave-room', { roomCode: h.code, playerId: a.playerId });
    // sem evento para aguardar (não deve haver broadcast); dá tempo do servidor processar
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(h.room.players.length).toBe(countBefore);
    expect(h.room.players.some((p: any) => p.id === a.playerId)).toBe(true);

    // A continua funcional: ainda recebe broadcasts subsequentes normalmente
    const seqBefore = a.roomSeq;
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: h.currentTeam(0) });
    await h.waitFor(() => a.roomSeq > seqBefore, 'A recebe update após tentativa de leave-room spoofada');
    expect(a.room.players.some((p: any) => p.id === a.playerId)).toBe(true);

    attacker.disconnect();
  });

  it('payloads da sala nunca contêm sessionToken', async () => {
    h = await Harness.create(5);
    await h.startGame();
    for (const c of h.clients) expect(c.sessionToken).toBeTruthy();
    for (const viewer of h.clients) {
      const json = JSON.stringify(viewer.room);
      expect(json).not.toContain('sessionToken');
      for (const c of h.clients) expect(json).not.toContain(c.sessionToken);
    }
  });
});
