# Sanitização de Estado por Jogador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que `room-updated` vaze papéis de outros jogadores, votos individuais de missão/equipe em andamento e o baralho de lealdade oculto — cada cliente recebe payload sanitizado para si.

**Architecture:** O servidor ganha `serializeRoomFor(room, viewerId)` que produz visão por jogador (papel próprio + conhecimento derivado do papel, contadores de votos em vez dos mapas, deck oculto removido) e `broadcastRoom(room)` que emite individualmente para cada socket em vez de `io.to(roomCode)`. O cliente para de computar conhecimento a partir de `players[].role` e passa a renderizar o campo `knowledge` calculado no servidor. No `game-over` os papéis são revelados a todos (reveal final).

**Tech Stack:** Node + socket.io (server.ts), React (src/App.tsx), Vitest + socket.io-client (tests/).

**Invariantes de segurança (o que NUNCA pode aparecer no payload de um viewer que não seja game-over):**
1. `players[].role` de outro jogador.
2. Mapa `missionVotes` (quem votou o quê na missão) — só contagem.
3. Mapa `teamVotes` durante `team-voting` — só contagem. (Após resultado, `lastTeamVoteResult.votes` é público por regra do jogo — mantém.)
4. `loyaltyDeck` (cartas ainda não reveladas). `loyaltyDeckVisible` é a visão pública — mantém.

**O que É público e não muda:** `lastTeamVoteResult`, `lastMissionVoteResult` (votos embaralhados), `loyaltyDeckVisible`, `lancelotLoyalty` (derivável das cartas reveladas), `matchHistory` (pós-jogo), `attemptedMissions`, fases, líder, missões.

**Contrato novo do payload (campos adicionados/alterados):**

```ts
// Campos removidos do payload: teamVotes, missionVotes, loyaltyDeck
// players[].role: presente só para o próprio viewer, ou para todos em game-over
// players[].socketId: substituído por marcador '' | 'online' (cliente só usa truthiness)
// Campos novos:
teamVotesCount: number;
missionVotesCount: number;
hasVotedTeam: boolean;      // específico do viewer
hasVotedMission: boolean;   // específico do viewer
knowledge: KnowledgeItem[]; // específico do viewer
// KnowledgeItem = { playerId: string; hint: 'evil' | 'maybe-merlin' | 'lancelot'; team?: 'good' | 'evil' }
```

**File Structure:**
- Modify: `tests/harness.ts` — visão de sala por cliente (cada cliente guarda seu próprio payload).
- Create: `tests/security.test.ts` — testes dos invariantes acima.
- Modify: `server.ts` — `computeKnowledge`, `serializeRoomFor`, `broadcastRoom`; troca de todos os emits.
- Modify: `tests/game.test.ts` — asserts que liam `teamVotes`/`missionVotes`/roles do broadcast.
- Modify: `src/App.tsx` — tipo `Room`, `KnowledgeSection`, contadores de voto, lista de alvos do assassino.

---

### Task 1: Harness com visão por cliente

Hoje o harness guarda um único `h.room` (qualquer listener sobrescreve). Com payloads diferentes por jogador isso quebra. Refatorar ANTES de mudar o servidor — payloads ainda idênticos, suite continua verde.

**Files:**
- Modify: `tests/harness.ts`

- [ ] **Step 1: Adicionar `room` por cliente e trocar helpers de papel**

Em `TestClient`, adicionar campo `room`:

```ts
export interface TestClient {
  name: string;
  playerId: string;
  socket: Socket;
  lastError: string | null;
  ladyResults: any[];
  room: any; // última visão da sala recebida POR ESTE cliente
}
```

No loop de criação de clientes em `Harness.create`, trocar o listener:

```ts
const client: TestClient = {
  name: `P${i + 1}`,
  playerId: `t-${runId}-${i}`,
  socket,
  lastError: null,
  ladyResults: [],
  room: null,
};
socket.on('room-updated', (r: any) => {
  client.room = r;
  h.room = h.clients[0] === client ? r : h.room;
});
```

E trocar a inicialização: `h.room` vira getter da visão do host. Substituir a propriedade `room: any = null` da classe por:

```ts
get room() { return this.clients[0]?.room ?? null; }
```

(Remover as atribuições `h.room = ...` — o listener acima fica só `client.room = r;`.)

- [ ] **Step 2: Reescrever helpers que dependiam de papéis no broadcast**

Substituir `playersByTeam`, `roleOf` e `withRole` por versões que usam a visão própria de cada cliente (cada um vê o próprio papel):

```ts
/** Papel do cliente segundo a visão DELE próprio. */
roleOf(client: TestClient): string {
  return client.room.players.find((p: any) => p.id === client.playerId).role;
}

playersByTeam(team: 'good' | 'evil'): TestClient[] {
  return this.clients.filter(c => (team === 'evil') === EVIL_ROLES.has(this.roleOf(c)));
}

withRole(role: string): TestClient {
  const c = this.clients.find(c => this.roleOf(c) === role);
  if (!c) throw new Error(`nenhum jogador com papel ${role}`);
  return c;
}
```

- [ ] **Step 3: Rodar a suite — deve continuar verde**

Run: `npx vitest run`
Expected: `PASS (24) FAIL (0)` — servidor ainda manda payload idêntico para todos; visão do host cobre os asserts atuais.

Nota: os testes `bem vence 3 missões...`, `assassino acerta Merlin` e `reset e reconexão` leem `h.room.players.find(p => p.role === ...)`. Vão continuar passando NESTA task (nada mudou no servidor), mas serão migrados na Task 3 para `h.withRole(...)`/visões próprias.

- [ ] **Step 4: Commit**

```bash
git add tests/harness.ts
git commit -m "test: harness guarda visão da sala por cliente"
```

---

### Task 2: Testes de segurança (falhando)

**Files:**
- Create: `tests/security.test.ts`

- [ ] **Step 1: Escrever os testes dos 4 invariantes**

```ts
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
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/security.test.ts`
Expected: FAIL — hoje `p.role` vaza, `missionVotes`/`teamVotes`/`loyaltyDeck` presentes, `knowledge`/contadores não existem.

- [ ] **Step 3: Commit**

```bash
git add tests/security.test.ts
git commit -m "test: invariantes de sanitização do estado (falhando)"
```

---

### Task 3: Servidor — serialização por jogador

**Files:**
- Modify: `server.ts` (funções novas perto de `processMissionResult`; troca de todos os `io.to(roomCode).emit("room-updated", room)`)
- Modify: `tests/game.test.ts` (asserts que liam os mapas de votos e papéis do broadcast)

- [ ] **Step 1: Adicionar `computeKnowledge` e `serializeRoomFor` em server.ts**

Inserir antes de `function processMissionResult`:

```ts
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
  for (const p of room.players) {
    if (p.socketId) {
      io.to(p.socketId).emit('room-updated', serializeRoomFor(room, p.id));
    }
  }
}
```

- [ ] **Step 2: Substituir todos os emits de room-updated**

Buscar `io.to(roomCode).emit("room-updated", room)` (aparece em ~20 handlers) e trocar cada um por:

```ts
broadcastRoom(room);
```

Casos individuais (emitem para um socket só):
- Em `get-room-info`: trocar `socket.emit("room-updated", room)` por:

```ts
socket.emit("room-updated", serializeRoomFor(room, player ? playerId : null));
```

(`player` é a variável já existente no handler — viewer que ainda não entrou recebe visão sem papel próprio.)

Atenção ao `leave-room` e ao `disconnect`: ambos usam `io.to(roomCode).emit(...)` — trocar por `broadcastRoom(room)` também.

- [ ] **Step 3: Atualizar asserts antigos em tests/game.test.ts**

Trocas pontuais (o resto da suite não lê os campos removidos):
- `expect(Object.keys(h.room.teamVotes)).toHaveLength(0)` → `expect(h.room.teamVotesCount).toBe(0)`
- `expect(Object.keys(h.room.missionVotes)).toHaveLength(0)` → `expect(h.room.missionVotesCount).toBe(0)` (aparece nos testes "jogador fora do time não vota na missão", "jogador do bem não consegue jogar falha" e no teste da Lady)
- Teste `distribui papéis corretos`: trocar leitura do broadcast por visão própria:

```ts
const roles = h.clients.map(c => h.roleOf(c)).sort();
expect(roles).toEqual(['assassin', 'merlin', 'minion', 'servant', 'servant']);
```

- Testes que fazem `h.room.players.find((p: any) => p.role === 'merlin')` (assassinato) → usar `h.withRole('merlin').playerId` / `h.withRole('servant').playerId` como `targetPlayerId`.
- Teste `reset-game volta ao lobby limpo`: `p.role === undefined` continua válido (após reset ninguém tem papel em nenhuma visão) — sem mudança.

- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run`
Expected: security.test.ts PASS; game.test.ts PASS (24). Total FAIL (0).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add server.ts tests/game.test.ts
git commit -m "fix(security): estado da sala sanitizado por jogador"
```

---

### Task 4: Cliente — consumir o payload sanitizado

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Atualizar o tipo `Room` do cliente**

Na interface `Room` (src/App.tsx, ~linha 146): remover `teamVotes`, `missionVotes`, `loyaltyDeck`; adicionar:

```ts
teamVotesCount: number;
missionVotesCount: number;
hasVotedTeam: boolean;
hasVotedMission: boolean;
knowledge: { playerId: string; hint: 'evil' | 'maybe-merlin' | 'lancelot'; team?: 'good' | 'evil' }[];
```

- [ ] **Step 2: Trocar usos dos mapas de votos no GameView**

Fase `team-voting` (~linha 2294):
- `room.teamVotes[playerId || '']` → `room.hasVotedTeam`
- `Object.keys(room.teamVotes).length` → `room.teamVotesCount` (mensagem de progresso e o indicador do host, 2 ocorrências)

Fase `mission-voting` (~linha 2332):
- `room.missionVotes[playerId || '']` → `room.hasVotedMission`
- `Object.keys(room.missionVotes).length` → `room.missionVotesCount` (3 ocorrências: progresso do votante, progresso do espectador, indicador do host)

- [ ] **Step 3: Reescrever `KnowledgeSection` para usar `room.knowledge`**

Substituir o corpo inteiro do componente (src/App.tsx ~linhas 1906–2009) por:

```tsx
const KnowledgeSection = ({ room, me }: { room: Room; me: Player }) => {
  const { t } = useTranslation();
  if (!room.knowledge || room.knowledge.length === 0) return null;

  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name ?? '?';
  const iconFor = (hint: string) =>
    hint === 'lancelot' ? '⚔️' : hint === 'maybe-merlin' ? '🧙‍♂️' : me.role === 'merlin' ? '💀' : '🗡️';

  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
      <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{t('app.game.acquiredKnowledge')}</h3>
      <div className="grid grid-cols-1 gap-2">
        {room.knowledge.map((k, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-black/20 rounded-lg border border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-xl">{iconFor(k.hint)}</span>
              <p className="text-xs font-bold text-white">{nameOf(k.playerId)}</p>
            </div>
            <div className="flex gap-1 items-center">
              {k.hint === 'maybe-merlin' ? (
                <Badge variant="purple">{t('app.game.merlinMaybe')}</Badge>
              ) : (
                <>
                  {k.hint === 'lancelot' && <span className="text-[10px] text-gray-400 font-bold mr-1">{t('app.game.lancelotLabel')}</span>}
                  <Badge team={k.team}>{k.team === 'good' ? t('app.game.good') : t('app.game.evil')}</Badge>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Lista de alvos do assassino**

Fase `assassination` (~linha 2548): o filtro `p.role && ROLES[p.role].team === 'good'` não funciona mais (papéis dos outros não vêm). Trocar por todos exceto o próprio assassino (regra oficial permite mirar qualquer um; o servidor decide o resultado):

```tsx
{room.players.filter(p => p.id !== playerId).map(p => (
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: sem erros. Se sobrar referência a `room.teamVotes`/`room.missionVotes`/`room.loyaltyDeck`, o tsc aponta — corrigir com os padrões dos Steps 2–3.

Run: `npx vite build`
Expected: build ok.

- [ ] **Step 6: Suite completa**

Run: `npx vitest run`
Expected: FAIL (0).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "fix(security): cliente consome payload sanitizado (knowledge do servidor)"
```

---

### Task 5: Verificação de runtime

**Files:** nenhum (verificação).

- [ ] **Step 1: Subir dev server e smoke test no browser**

Subir `avalon-dev` (launch.json já existe). Abrir `http://localhost:3000/avalon/`, criar sala com um nome, confirmar:
- Home carrega sem erro de console (ignorar Wake Lock NotAllowedError do browser embutido).
- Sala criada, código visível, sem erro.

- [ ] **Step 2: Verificar payload no websocket via DevTools do próprio teste**

Confirmação real do invariante já está nos testes de segurança; no browser basta checar console limpo e lobby funcional.

- [ ] **Step 3: Commit final se algo foi ajustado**

```bash
git status
# se houver ajustes: git add -A && git commit -m "fix: ajustes pós-smoke-test da sanitização"
```

---

## Self-Review

- **Cobertura**: 4 invariantes → testes na Task 2; knowledge (Merlin/mal/Percival/Lancelot-var3) → `computeKnowledge` Task 3 + teste do Merlin; cliente sem fonte de papéis → Task 4 Steps 3–4; reveal no game-over → teste + `revealRoles`.
- **Consistência de nomes**: `serializeRoomFor`, `broadcastRoom`, `computeKnowledge`, `teamVotesCount`, `missionVotesCount`, `hasVotedTeam`, `hasVotedMission`, `knowledge` — idênticos em server, testes e cliente.
- **Riscos conhecidos**: (a) espectador em `get-room-info` deixa de receber updates ao vivo (recebe snapshot) — aceitável, formulário de entrada é estático; (b) teste "5 rejeições" usa `h.room.matchHistory` — campo público, permanece; (c) `formatName`/indicador offline dependem de `socketId` truthiness — preservado com marcador `'online'`.
