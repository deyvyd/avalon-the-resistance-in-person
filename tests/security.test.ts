import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { Harness, closeServer } from './harness.ts';

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
