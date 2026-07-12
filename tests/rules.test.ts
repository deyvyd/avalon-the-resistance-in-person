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

  it('servidor ignora objeto lancelotConfig injetado pelo cliente', async () => {
    h = await Harness.create(5);
    await h.startGame({
      selectedRoles: ['lancelot_good', 'lancelot_evil'],
      lancelotConfigId: null,
      // tentativa de spoof com objeto arbitrário (era o comportamento antigo)
      lancelotConfig: { id: 'hack', variant: 'var2', deckSize: 50, deckRevealed: true, startsAt: 0, mandatory: false, recognition: false },
    });
    expect(h.room.lancelotConfig).toBeNull();
    expect(h.room.loyaltyDeckVisible).toHaveLength(0);
  });

  it('lancelotConfigId inválido resulta em config nula', async () => {
    h = await Harness.create(5);
    await h.startGame({ lancelotConfigId: 'variante-inexistente' });
    expect(h.room.lancelotConfig).toBeNull();
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
