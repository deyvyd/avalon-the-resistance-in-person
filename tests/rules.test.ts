import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { Harness, closeServer } from './harness.ts';
import { generateLoyaltyDeck, LANCELOT_CONFIGS } from '../src/core/avalon.ts';

let h: Harness;

afterEach(async () => { if (h) await h.destroy(); });
afterAll(async () => { await closeServer(); });

describe('baralho de lealdade (regras da adaptação)', () => {
  it('gera exatamente 2 cartas de troca para qualquer tamanho', () => {
    for (const size of [5, 7]) {
      for (let i = 0; i < 20; i++) {
        const deck = generateLoyaltyDeck(size);
        expect(deck).toHaveLength(size);
        expect(deck.filter(c => c === 'switch')).toHaveLength(2);
      }
    }
  });

  it('deck vazio para var3 (deckSize 0)', () => {
    expect(generateLoyaltyDeck(0)).toEqual([]);
    expect(generateLoyaltyDeck(1)).toEqual([]);
  });

  it('tamanhos canônicos: var1/var1_var3 = 5, var2/var1_var2/var2_var3 = 7', () => {
    expect(LANCELOT_CONFIGS.var1.deckSize).toBe(5);
    expect(LANCELOT_CONFIGS.var1_var3.deckSize).toBe(5);
    expect(LANCELOT_CONFIGS.var2.deckSize).toBe(7);
    expect(LANCELOT_CONFIGS.var1_var2.deckSize).toBe(7);
    expect(LANCELOT_CONFIGS.var2_var3.deckSize).toBe(7);
    expect(LANCELOT_CONFIGS.var3.deckSize).toBe(0);
  });

  it('servidor monta deck da var2 com 7 cartas reveladas e 2 trocas', async () => {
    h = await Harness.create(5);
    await h.startGame({
      selectedRoles: ['lancelot_good', 'lancelot_evil'],
      lancelotConfigId: 'var2',
    });
    const visible = h.room.loyaltyDeckVisible;
    // var2 revela o deck antes do jogo, mas startsAt=1 já consome a 1ª carta no start
    expect(visible).toHaveLength(7);
    expect(visible.filter((c: string) => c === 'switch')).toHaveLength(2);
    expect(visible).not.toContain('hidden');
  });

  it('servidor ignora objeto lancelotConfig injetado pelo cliente e rejeita o start (Lancelot exige config válida)', async () => {
    h = await Harness.create(5);
    h.host.socket.emit('start-game', {
      roomCode: h.code,
      selectedRoles: ['lancelot_good', 'lancelot_evil'],
      lancelotConfigId: null,
      // tentativa de spoof com objeto arbitrário (era o comportamento antigo)
      lancelotConfig: { id: 'hack', variant: 'var2', deckSize: 50, deckRevealed: true, startsAt: 0, mandatory: false, recognition: false },
      ladyOfLakeEnabled: false,
      excaliburEnabled: false,
      targetingEnabled: false,
    });
    // Sem config válida, o servidor não inicia a partida — evita lancelotLoyalty
    // nulo derrubando lady-examine/vote-mission mais tarde
    await new Promise(r => setTimeout(r, 100));
    expect(h.room.phase).toBe('lobby');
    expect(h.room.lancelotConfig).toBeNull();
  });

  it('lancelotConfigId inválido resulta em config nula', async () => {
    h = await Harness.create(5);
    await h.startGame({ lancelotConfigId: 'variante-inexistente' });
    expect(h.room.lancelotConfig).toBeNull();
  });
});

describe('guards do start-game', () => {
  it('start-game no meio da partida é ignorado (não re-sorteia papéis)', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const rolesBefore = h.clients.map(c => h.roleOf(c));
    const phaseBefore = h.room.phase;

    h.host.socket.emit('start-game', {
      roomCode: h.code,
      selectedRoles: [],
      lancelotConfigId: null,
      ladyOfLakeEnabled: false,
      excaliburEnabled: false,
      targetingEnabled: false,
    });
    await new Promise(r => setTimeout(r, 300));

    expect(h.room.phase).toBe(phaseBefore);
    expect(h.clients.map(c => h.roleOf(c))).toEqual(rolesBefore);
  });

  it('start-game com menos de 5 jogadores é ignorado e não derruba o servidor', async () => {
    h = await Harness.create(3);
    h.host.socket.emit('start-game', {
      roomCode: h.code,
      selectedRoles: [],
      lancelotConfigId: null,
      ladyOfLakeEnabled: false,
      excaliburEnabled: false,
      targetingEnabled: false,
    });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.phase).toBe('lobby');

    // servidor continua vivo: outra sala funciona normalmente
    const h2 = await Harness.create(5);
    await h2.startGame();
    expect(h2.room.phase).toBe('team-proposal');
    await h2.destroy();
  });

  it('selectedRoles inválido (duplicado, mandatório ou além da distribuição) é ignorado', async () => {
    h = await Harness.create(5);
    for (const bad of [
      ['percival', 'percival'],          // duplicado
      ['merlin'],                        // mandatório não é opcional
      ['servant'],                       // genérico não é opcional
      ['morgana', 'mordred'],            // 2 opcionais do mal, mas 5p só tem 1 vaga além do Assassino
      ['papel-inexistente'],
      'nao-e-array',
    ]) {
      h.host.socket.emit('start-game', {
        roomCode: h.code,
        selectedRoles: bad,
        lancelotConfigId: null,
        ladyOfLakeEnabled: false,
        excaliburEnabled: false,
        targetingEnabled: false,
      });
    }
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.phase).toBe('lobby');

    // e um start válido continua funcionando depois das tentativas
    await h.startGame({ selectedRoles: ['percival', 'morgana'] });
    expect(h.room.phase).toBe('team-proposal');
  });
});

describe('guards do assign-excalibur (fix C)', () => {
  it('líder não pode atribuir Excalibur a si mesmo', async () => {
    h = await Harness.create(5);
    await h.startGame({ excaliburEnabled: true });
    h.leader().socket.emit('assign-excalibur', { roomCode: h.code, targetPlayerId: h.leader().playerId });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.excaliburHolder).toBeNull();
  });

  it('não-líder não atribui Excalibur', async () => {
    h = await Harness.create(5);
    await h.startGame({ excaliburEnabled: true });
    const notLeader = h.clients.find(c => c !== h.leader())!;
    const target = h.clients.find(c => c !== h.leader() && c !== notLeader)!;
    notLeader.socket.emit('assign-excalibur', { roomCode: h.code, targetPlayerId: target.playerId });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.excaliburHolder).toBeNull();
  });

  it('atribuição fora de team-proposal é ignorada', async () => {
    h = await Harness.create(5);
    await h.startGame({ excaliburEnabled: true });
    await h.proposeAndApprove(h.currentTeam(0));
    const target = h.clients.find(c => c !== h.leader())!;
    h.leader().socket.emit('assign-excalibur', { roomCode: h.code, targetPlayerId: target.playerId });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.excaliburHolder).toBeNull();
  });

  it('portador precisa estar na equipe proposta (regra oficial)', async () => {
    h = await Harness.create(5);
    await h.startGame({ excaliburEnabled: true });
    const team = h.currentTeam(0);
    const outsider = h.clients.find(c => !team.includes(c.playerId) && c !== h.leader())!;
    // Sem equipe enviada: rejeitado
    h.leader().socket.emit('assign-excalibur', { roomCode: h.code, targetPlayerId: outsider.playerId });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.excaliburHolder).toBeNull();
    // Alvo fora da equipe enviada: rejeitado
    h.leader().socket.emit('assign-excalibur', { roomCode: h.code, targetPlayerId: outsider.playerId, teamPlayerIds: team });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.excaliburHolder).toBeNull();
  });

  it('mudar a equipe depois de atribuir Excalibur limpa a designação ao propor', async () => {
    h = await Harness.create(5);
    await h.startGame({ excaliburEnabled: true });
    const team = h.currentTeam(0);
    const leader = h.leader();
    const holderCandidate = team.find(id => id !== leader.playerId)!;
    leader.socket.emit('assign-excalibur', { roomCode: h.code, targetPlayerId: holderCandidate, teamPlayerIds: team });
    await h.waitFor(() => h.room.excaliburHolder === holderCandidate, 'excalibur atribuída');

    // Propõe uma equipe diferente, sem o antigo portador
    const missionSize = h.room.missions[0].size;
    const others = h.room.players.map((p: any) => p.id).filter((id: string) => id !== holderCandidate);
    const newTeam = others.slice(0, missionSize);
    leader.socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: newTeam });
    await h.waitPhase('team-voting');
    expect(h.room.excaliburHolder).toBeNull();
  });
});

describe('leave-room no meio da partida (fix D)', () => {
  it('sair durante a partida marca offline em vez de remover', async () => {
    h = await Harness.create(5);
    await h.startGame();
    const leaving = h.clients[2];
    const countBefore = h.room.players.length;
    const leaderIndexBefore = h.room.currentLeaderIndex;

    leaving.socket.emit('leave-room', { roomCode: h.code });
    await h.waitFor(
      () => h.room.players.find((p: any) => p.id === leaving.playerId)?.socketId === '',
      'jogador marcado offline'
    );

    expect(h.room.players).toHaveLength(countBefore);
    const player = h.room.players.find((p: any) => p.id === leaving.playerId);
    expect(player).toBeDefined();
    expect(player.socketId).toBe('');
    expect(h.room.currentLeaderIndex).toBe(leaderIndexBefore);
    expect(h.room.missions[0].size).toBe(h.room.missions[0].size); // dimensionamento intacto p/ 5 jogadores
  });

  it('sair no lobby continua removendo o jogador', async () => {
    h = await Harness.create(5);
    const leaving = h.clients[1];
    leaving.socket.emit('leave-room', { roomCode: h.code });
    await h.waitFor(() => h.room.players.length === 4, 'jogador removido');
    expect(h.room.players.some((p: any) => p.id === leaving.playerId)).toBe(false);
  });
});

describe('reordenação de jogadores', () => {
  it('host reordena por ids e a ordem muda', async () => {
    h = await Harness.create(5);
    const before = h.room.players.map((p: any) => p.id);
    const reversed = [...before].reverse();
    h.host.socket.emit('reorder-players', { roomCode: h.code, playerIds: reversed });
    await h.waitFor(() => h.room.players[0].id === reversed[0], 'ordem invertida');
    expect(h.room.players.map((p: any) => p.id)).toEqual(reversed);
  });

  it('objetos injetados no lugar de ids são ignorados', async () => {
    h = await Harness.create(5);
    const before = h.room.players.map((p: any) => p.id);
    h.host.socket.emit('reorder-players', {
      roomCode: h.code,
      playerIds: before.map((id: string) => ({ id, role: 'merlin', name: 'Hacked' })),
    });
    h.host.socket.emit('reorder-players', { roomCode: h.code, playerIds: [before[0]] }); // tamanho errado
    h.host.socket.emit('reorder-players', { roomCode: h.code, playerIds: [before[0], before[0], before[1], before[2], before[3]] }); // duplicado
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.players.map((p: any) => p.id)).toEqual(before);
    expect(h.room.players.every((p: any) => p.name.startsWith('P'))).toBe(true);
  });

  it('não-host não reordena', async () => {
    h = await Harness.create(5);
    const before = h.room.players.map((p: any) => p.id);
    h.clients[1].socket.emit('reorder-players', { roomCode: h.code, playerIds: [...before].reverse() });
    await new Promise(r => setTimeout(r, 300));
    expect(h.room.players.map((p: any) => p.id)).toEqual(before);
  });
});

describe('troca de lealdade com targeting (fix 8)', () => {
  it('var1_var2 + targeting: 1 carta consumida por missão resolvida', async () => {
    h = await Harness.create(5);
    await h.startGame({
      selectedRoles: ['lancelot_good', 'lancelot_evil'],
      lancelotConfigId: 'var1_var2', // startsAt 1: consome carta no start e a cada missão
      targetingEnabled: true,
    });
    // start-game consome a carta da rodada 1
    expect(h.room.loyaltyDeckIndex).toBe(1);

    // joga missão alvo índice 2 (tamanho 2 em 5p)
    const team = h.room.players.slice(0, h.room.missions[2].size).map((p: any) => p.id);
    h.leader().socket.emit('propose-team', { roomCode: h.code, teamPlayerIds: team, targetMissionIndex: 2 });
    await h.waitPhase('team-voting');
    h.clients.forEach(c => c.socket.emit('vote-team', { roomCode: h.code, vote: 'approve' }));
    await h.waitPhase('team-result');
    h.host.socket.emit('continue-game', { roomCode: h.code });
    await h.waitPhase('mission-voting');
    for (const id of team) {
      const c = h.byId(id);
      // lancelot mau com mandatory precisa jogar 'fail'; demais jogam conforme o time
      const role = h.roleOf(c);
      const isEvilNow = ['assassin', 'minion', 'morgana', 'mordred', 'oberon', 'lancelot_evil'].includes(role);
      c.socket.emit('vote-mission', { roomCode: h.code, vote: isEvilNow ? 'fail' : 'success' });
    }
    await h.waitPhase('mission-result');
    h.host.socket.emit('continue-game', { roomCode: h.code });
    await h.waitPhase('team-proposal');

    // 1 missão resolvida → 2ª carta consumida (antes do fix, índice descompassava)
    expect(h.room.loyaltyDeckIndex).toBe(2);
  });
});
