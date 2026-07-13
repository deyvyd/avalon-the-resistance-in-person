import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { Harness, closeServer } from './harness.ts';

let h: Harness;

afterEach(async () => {
  if (h) await h.destroy();
});

afterAll(async () => {
  await closeServer();
});

describe('fluxo básico', () => {
  it('cria sala e entra com 5 jogadores', async () => {
    h = await Harness.create(5);
    expect(h.room.players).toHaveLength(5);
    expect(h.room.phase).toBe('lobby');
    expect(h.room.hostId).toBe(h.host.playerId);
  });

  it('distribui papéis corretos para 5 jogadores (3 bem, 2 mal)', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const roles = h.clients.map(c => h.roleOf(c)).sort();
    expect(roles).toEqual(['assassin', 'merlin', 'minion', 'servant', 'servant']);
  });

  it('bem vence 3 missões → fase de assassinato → assassino erra → bem vence', async () => {
    h = await Harness.create(5);
    await h.startGame();
    await h.playMission();
    await h.playMission();
    await h.playMission();
    expect(h.room.phase).toBe('assassination');

    const assassin = h.withRole('assassin');
    const servant = h.withRole('servant');
    assassin.socket.emit('assassinate', { roomCode: h.code, targetPlayerId: servant.playerId });
    await h.waitPhase('game-over');
    expect(h.room.winner).toBe('good');
  });

  it('assassino acerta Merlin → mal vence', async () => {
    h = await Harness.create(5);
    await h.startGame();
    await h.playMission();
    await h.playMission();
    await h.playMission();
    const assassin = h.withRole('assassin');
    const merlin = h.withRole('merlin');
    assassin.socket.emit('assassinate', { roomCode: h.code, targetPlayerId: merlin.playerId });
    await h.waitPhase('game-over');
    expect(h.room.winner).toBe('evil');
  });

  it('3 missões falham → mal vence', async () => {
    h = await Harness.create(5);
    await h.startGame();
    await h.playMission({ failVotes: 1 });
    await h.playMission({ failVotes: 1 });
    await h.playMission({ failVotes: 1 });
    expect(h.room.phase).toBe('game-over');
    expect(h.room.winner).toBe('evil');
  });

  it('5 rejeições consecutivas → mal vence', async () => {
    h = await Harness.create(5);
    await h.startGame();
    for (let i = 0; i < 5; i++) {
      const team = h.currentTeam(0);
      h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: team });
      await h.waitPhase('team-voting');
      h.clients.forEach(c => c.socket.emit('vote-team', { roomCode: h.code, vote: 'reject' }));
      await h.waitPhase('team-result');
      expect(h.room.rejectionCount).toBe(i + 1);
      h.host.socket.emit('continue-game', { roomCode: h.code });
      await h.waitFor(() => h.room.phase !== 'team-result', 'saída de team-result');
    }
    expect(h.room.phase).toBe('game-over');
    expect(h.room.winner).toBe('evil');
    expect(h.room.matchHistory).toHaveLength(1);
  });

  it('aprovação zera contador de rejeições', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const team = h.currentTeam(0);
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: team });
    await h.waitPhase('team-voting');
    h.clients.forEach(c => c.socket.emit('vote-team', { roomCode: h.code, vote: 'reject' }));
    await h.waitPhase('team-result');
    expect(h.room.rejectionCount).toBe(1);
    h.host.socket.emit('continue-game', { roomCode: h.code });
    await h.waitPhase('team-proposal');

    await h.proposeAndApprove(h.currentTeam(0));
    expect(h.room.rejectionCount).toBe(0);
  });
});

describe('autorização e validação (fix 4)', () => {
  it('não-líder não consegue propor time', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const notLeader = h.clients.find(c => c !== h.leader())!;
    notLeader.socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: h.currentTeam(0) });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.phase).toBe('team-proposal');
    expect(h.room.proposedTeam).toHaveLength(0);
  });

  it('time com tamanho errado é rejeitado', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const ids = h.room.players.map((p: any) => p.id);
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: ids }); // 5 ≠ 2
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.phase).toBe('team-proposal');
  });

  it('time com ids duplicados é rejeitado', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const id = h.room.players[0].id;
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: [id, id] });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.phase).toBe('team-proposal');
  });

  it('voto de time fora da fase de votação é ignorado', async () => {
    h = await Harness.create(5);
    await h.startGame();
    h.clients[1].socket.emit('vote-team', { roomCode: h.code, vote: 'approve' });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.teamVotesCount).toBe(0);
  });

  it('re-voto após team-result não incrementa rejectionCount de novo', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const team = h.currentTeam(0);
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: team });
    await h.waitPhase('team-voting');
    h.clients.forEach(c => c.socket.emit('vote-team', { roomCode: h.code, vote: 'reject' }));
    await h.waitPhase('team-result');
    expect(h.room.rejectionCount).toBe(1);
    h.clients[0].socket.emit('vote-team', { roomCode: h.code, vote: 'reject' });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.rejectionCount).toBe(1);
  });

  it('jogador fora do time não vota na missão', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const team = h.currentTeam(1); // inclui 1 evil
    await h.proposeAndApprove(team);
    const outsider = h.clients.find(c => !team.includes(c.playerId))!;
    outsider.socket.emit('vote-mission', { roomCode: h.code, vote: 'fail' });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.missionVotesCount).toBe(0);
    expect(h.room.phase).toBe('mission-voting');
  });

  it('jogador do bem não consegue jogar falha', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const team = h.currentTeam(0); // só bem
    await h.proposeAndApprove(team);
    const good = h.byId(team[0]);
    good.socket.emit('vote-mission', { roomCode: h.code, vote: 'fail' });
    await h.waitFor(() => good.lastError !== null, 'erro do servidor');
    expect(h.room.missionVotesCount).toBe(0);
  });

  it('não-assassino não consegue assassinar', async () => {
    h = await Harness.create(5);
    await h.startGame();
    await h.playMission();
    await h.playMission();
    await h.playMission();
    expect(h.room.phase).toBe('assassination');
    const merlin = h.withRole('merlin');
    const minion = h.withRole('minion');
    merlin.socket.emit('assassinate', { roomCode: h.code, targetPlayerId: merlin.playerId });
    minion.socket.emit('assassinate', { roomCode: h.code, targetPlayerId: merlin.playerId });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.phase).toBe('assassination');
  });

  it('assassinato fora da fase é ignorado', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const assassin = h.withRole('assassin');
    const merlin = h.withRole('merlin');
    assassin.socket.emit('assassinate', { roomCode: h.code, targetPlayerId: merlin.playerId });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.phase).toBe('team-proposal');
  });
});

describe('Lady of the Lake (fix 2)', () => {
  it('após 2ª missão entra na fase da Lady e avança missão corretamente', async () => {
    h = await Harness.create(5);
    await h.startGame({ ladyOfLakeEnabled: true });
    await h.playMission();
    expect(h.room.currentMissionIndex).toBe(1);
    await h.playMission();
    expect(h.room.phase).toBe('lady-of-the-lake');

    const holder = h.byId(h.room.ladyOfLakeHolder);
    const target = h.room.players.find(
      (p: any) => p.id !== holder.playerId && !h.room.ladyOfLakeUsed.includes(p.id)
    );
    holder.socket.emit('lady-examine', { roomCode: h.code, targetPlayerId: target.id });
    await h.waitPhase('team-proposal');

    expect(h.room.currentMissionIndex).toBe(2);
    expect(h.room.missionVotesCount).toBe(0);
    expect(h.room.teamVotesCount).toBe(0);
    expect(h.room.proposedTeam).toHaveLength(0);
    expect(h.room.rejectionCount).toBe(0);
    expect(holder.ladyResults).toHaveLength(1);

    // 3ª missão grava no slot certo
    await h.playMission();
    expect(h.room.missions[2].status).toBe('success');
    expect(h.room.missions[1].status).toBe('success');
  });

  it('só o holder examina e alvo já usado é bloqueado', async () => {
    h = await Harness.create(5);
    await h.startGame({ ladyOfLakeEnabled: true });
    await h.playMission();
    await h.playMission();
    const holder = h.byId(h.room.ladyOfLakeHolder);
    const notHolder = h.clients.find(c => c !== holder)!;
    const target = h.room.players.find(
      (p: any) => p.id !== holder.playerId && !h.room.ladyOfLakeUsed.includes(p.id)
    );
    notHolder.socket.emit('lady-examine', { roomCode: h.code, targetPlayerId: target.id });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.phase).toBe('lady-of-the-lake');
  });
});

describe('Excalibur', () => {
  it('troca voto de sucesso para falha e missão falha', async () => {
    h = await Harness.create(5);
    await h.startGame({ excaliburEnabled: true });

    const team = h.currentTeam(0); // 2 jogadores do bem
    const leader = h.leader();
    const holderCandidate = team.find(id => id !== leader.playerId) ?? team[0];
    leader.socket.emit('assign-excalibur', { roomCode: h.code, targetPlayerId: holderCandidate, teamPlayerIds: team });
    await h.waitFor(() => h.room.excaliburHolder === holderCandidate, 'excalibur atribuída');

    await h.proposeAndApprove(team);
    team.forEach(id => h.byId(id).socket.emit('vote-mission', { roomCode: h.code, vote: 'success' }));
    await h.waitPhase('excalibur-usage');

    const holder = h.byId(h.room.excaliburHolder);
    const victim = team.find(id => id !== holder.playerId)!;
    holder.socket.emit('use-excalibur', { roomCode: h.code, targetPlayerId: victim });
    await h.waitPhase('mission-result');

    expect(h.room.missions[0].status).toBe('fail');
    expect(h.room.excaliburReveal).toBe('success'); // voto original revelado
    expect(h.room.excaliburTarget).toBe(victim);
  });

  it('pular Excalibur mantém resultado original', async () => {
    h = await Harness.create(5);
    await h.startGame({ excaliburEnabled: true });
    const team = h.currentTeam(0);
    const leader = h.leader();
    const holderCandidate = team.find(id => id !== leader.playerId) ?? team[0];
    leader.socket.emit('assign-excalibur', { roomCode: h.code, targetPlayerId: holderCandidate, teamPlayerIds: team });
    await h.waitFor(() => h.room.excaliburHolder === holderCandidate, 'excalibur atribuída');
    await h.proposeAndApprove(team);
    team.forEach(id => h.byId(id).socket.emit('vote-mission', { roomCode: h.code, vote: 'success' }));
    await h.waitPhase('excalibur-usage');
    h.byId(h.room.excaliburHolder).socket.emit('skip-excalibur', { roomCode: h.code });
    await h.waitPhase('mission-result');
    expect(h.room.missions[0].status).toBe('success');
  });
});

describe('missão-alvo (targeting)', () => {
  it('líder escolhe missão e ela é marcada como tentada', async () => {
    h = await Harness.create(5);
    await h.startGame({ targetingEnabled: true });
    const size2 = h.room.missions[2].size; // missão índice 2 (tamanho 2 em 5p)
    const team = h.room.players.slice(0, size2).map((p: any) => p.id);
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: team, targetMissionIndex: 2 });
    await h.waitPhase('team-voting');
    expect(h.room.currentMissionIndex).toBe(2);
    h.clients.forEach(c => c.socket.emit('vote-team', { roomCode: h.code, vote: 'approve' }));
    await h.waitPhase('team-result');
    h.host.socket.emit('continue-game', { roomCode: h.code });
    await h.waitPhase('mission-voting');
    team.forEach((id: string) => h.byId(id).socket.emit('vote-mission', { roomCode: h.code, vote: 'success' }));
    await h.waitPhase('mission-result');
    expect(h.room.attemptedMissions).toContain(2);
    expect(h.room.missions[2].status).toBe('success');
  });

  it('missão 5 bloqueada antes de 2 tentativas', async () => {
    h = await Harness.create(5);
    await h.startGame({ targetingEnabled: true });
    const size = h.room.missions[4].size;
    const team = h.room.players.slice(0, size).map((p: any) => p.id);
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: team, targetMissionIndex: 4 });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.phase).toBe('team-proposal');
  });
});

describe('reset e reconexão', () => {
  it('reset-game volta ao lobby limpo', async () => {
    h = await Harness.create(5);
    await h.startGame();
    await h.playMission({ failVotes: 1 });
    h.host.socket.emit('reset-game', { roomCode: h.code });
    await h.waitPhase('lobby');
    expect(h.room.players.every((p: any) => p.role === undefined && !p.isConfirmed)).toBe(true);
    expect(h.room.missions).toHaveLength(0);
    expect(h.room.rejectionCount).toBe(0);
  });

  it('host sai no lobby → host migra', async () => {
    h = await Harness.create(5);
    const oldHost = h.host;
    oldHost.socket.emit('leave-room', { roomCode: h.code, playerId: oldHost.playerId });
    await h.waitFor(() => h.room.players.length === 4, 'jogador removido');
    expect(h.room.hostId).toBe(h.clients[1].playerId);
  });
});
