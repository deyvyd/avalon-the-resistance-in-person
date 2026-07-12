# App.tsx Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 2705-line `src/App.tsx` into per-domain files (types, constants, context, ui, modals, lobby, game) with zero behavior/visual change, verified at every step by `tsc` + `vitest` (+ manual browser check for risk groups).

**Architecture:** Mechanical extraction, one dependency-ordered group per task, each group committed independently. Order: pure data (types/constants/utils) → context → ui primitives → modals → lobby → game views → App.tsx cleanup. Each later group only depends on earlier ones, so there are no circular imports.

**Tech Stack:** React 18, TypeScript, Vite, react-router-dom, socket.io-client, motion (framer-motion), react-i18next, lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-app-tsx-modularization-design.md`

---

## Ground rules for every task

- Never retype component bodies by hand — use the Read tool to pull the exact current line range from `src/App.tsx`, then Write the new file, then Edit `src/App.tsx` to delete that range and add the replacement import. This guarantees byte-for-byte identical logic.
- After moving a component, `tsc` will report any imports the new file is missing (icons, hooks, types) because they were previously satisfied by App.tsx's top-of-file imports. Add exactly the ones reported — no more, no less. The full source list of what's available is in Task 1, Step 1 below (copy of App.tsx's current import block) for reference.
- Run `npm run lint` (tsc) and `npm test` (vitest) after every task. Both must be green before committing.
- Current baseline line numbers (from `src/App.tsx` before this plan starts) are listed per task. If earlier tasks in this plan shift later line numbers, re-grep before editing — don't trust stale numbers once Task 1 is committed. Command to re-check: `grep -nE "^(const|function|interface|type) [A-Za-z]" src/App.tsx`.

---

### Task 1: `types.ts`, `constants.ts`, `lib/session.ts`, `hooks/useWakeLock.ts`

Pure data and utility functions with zero JSX and zero dependency on any other extracted piece. Safest possible first step.

**Files:**
- Create: `src/types.ts`
- Create: `src/constants.ts`
- Create: `src/lib/session.ts`
- Create: `src/hooks/useWakeLock.ts`
- Modify: `src/App.tsx`

**Current locations in `src/App.tsx` (baseline, before any edits):**
- `APP_VERSION` — line 65
- `AvalonSettings` interface — lines 69-78
- `DEFAULT_SETTINGS` — lines 79-88
- `getPersistentId` — lines 89-99
- `getSessionToken` / `setSessionToken` — lines 100-105
- `Player` interface — lines 106-113
- `Mission` interface — lines 114-121
- `GamePhase` type — lines 122-135
- `MatchRecord` interface — lines 136-147
- `TeamVoteResult` interface — lines 148-152
- `MissionVoteResult` interface — lines 153-157
- `Room` interface — lines 158-208
- `useWakeLock` hook — lines 231-263

- [ ] **Step 1: Read the exact current content**

Run:
```bash
sed -n '65,208p' src/App.tsx
```
and
```bash
sed -n '231,263p' src/App.tsx
```
Use the Read tool on `src/App.tsx` for these ranges to get exact text (whitespace-sensitive) before writing the new files.

- [ ] **Step 2: Create `src/types.ts`**

Content: the `AvalonSettings`, `Player`, `Mission`, `GamePhase`, `MatchRecord`, `TeamVoteResult`, `MissionVoteResult`, and `Room` type/interface declarations, copied verbatim from lines 69-208, each prefixed with `export`. `Room` references `Player` and `Mission` — keep declaration order as-is (Player/Mission before Room, matching current file order). If `Room` or any other interface references `Team` (from `./core/avalon`), add:
```ts
import type { Team } from './core/avalon';
```
at the top of `types.ts` (check the copied text for `Team` usage first).

- [ ] **Step 3: Create `src/constants.ts`**

```ts
import type { AvalonSettings } from './types';

export const APP_VERSION = '1.2.0';

export const DEFAULT_SETTINGS: AvalonSettings = {
  // ...copy the exact object literal from App.tsx lines 79-88 verbatim...
};
```
Copy the real object literal from the file — do not guess its fields.

- [ ] **Step 4: Create `src/lib/session.ts`**

```ts
// copy getPersistentId (lines 89-99) and getSessionToken/setSessionToken (lines 100-105) verbatim, each prefixed with `export`
```
Check the copied bodies for any use of `localStorage`/`sessionStorage`/`crypto` — those are browser globals, no import needed. If they reference anything else from App.tsx (unlikely), add the import.

- [ ] **Step 5: Create `src/hooks/useWakeLock.ts`**

```ts
import { useEffect, useRef } from 'react';
// copy useWakeLock verbatim from lines 231-263, prefixed with `export`, keeping only the React imports it actually uses (check the body for useState/useCallback etc. and adjust the import line accordingly)
```

- [ ] **Step 6: Update `src/App.tsx`**

Delete lines 65-208 (APP_VERSION through Room interface) and lines 231-263 (useWakeLock), replacing with imports:
```ts
import type { Player, Mission, GamePhase, MatchRecord, TeamVoteResult, MissionVoteResult, Room, AvalonSettings } from './types';
import { APP_VERSION, DEFAULT_SETTINGS } from './constants';
import { getPersistentId, getSessionToken, setSessionToken } from './lib/session';
import { useWakeLock } from './hooks/useWakeLock';
```
Place these imports near the top of the file, after the existing `import ... from './core/avalon'` block. Leave the `// --- Constants ---` / `// --- Types ---` comment markers removed since the content moved.

Only import the type names actually still referenced inside `App.tsx` after this and later tasks — for now import all of them, since later tasks (extracting components that use these types) haven't happened yet and App.tsx still contains code referencing `Room`, `Player`, etc.

- [ ] **Step 7: Typecheck**

Run: `npm run lint`
Expected: no errors. If errors mention missing imports in the new files (e.g. `Team` not found), add the specific missing import — do not add unrelated imports.

- [ ] **Step 8: Run tests**

Run: `npm test`
Expected: existing suite (`tests/game.test.ts`, `tests/security.test.ts`, `tests/rules.test.ts`) passes unchanged — this task doesn't touch `core/avalon.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/constants.ts src/lib/session.ts src/hooks/useWakeLock.ts src/App.tsx
git commit -m "refactor: extract types, constants, session helpers, useWakeLock from App.tsx"
```

---

### Task 2: `context/SocketContext.tsx`, `context/SettingsContext.tsx`

**Files:**
- Create: `src/context/SocketContext.tsx`
- Create: `src/context/SettingsContext.tsx`
- Modify: `src/App.tsx`

**Current locations (re-grep line numbers first — Task 1 shifted everything below line 208 upward by roughly 175 lines; use `grep -nE "^(const|interface) [A-Za-z]" src/App.tsx` to get exact current numbers before editing):**
- `SocketContext` + `useSocket` hook (originally lines 209-224)
- `SettingsContext` + `useSettings` hook (originally lines 211-230)
- `SettingsProvider` (originally lines 264-355)

- [ ] **Step 1: Re-grep current line numbers**

Run: `grep -nE "^const (SocketContext|SettingsContext|useSocket|useSettings|SettingsProvider)" src/App.tsx`
Use the reported numbers for the Read/Edit calls below (they will differ from the original baseline since Task 1 removed ~175 lines above this point).

- [ ] **Step 2: Read exact content**

Read the block from `SocketContext` declaration through the end of `useSocket`, and separately from `SettingsContext` through the end of `useSettings`, and separately the full `SettingsProvider` function body (ends where `SettingsModal` begins).

- [ ] **Step 3: Create `src/context/SocketContext.tsx`**

```tsx
import { createContext, useContext } from 'react';
import type { Socket } from 'socket.io-client';

export const SocketContext = createContext<Socket | null>(null);

export const useSocket = () => {
  // copy body verbatim
};
```

- [ ] **Step 4: Create `src/context/SettingsContext.tsx`**

```tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AvalonSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

export const SettingsContext = createContext<{
  // copy the exact context value type verbatim from App.tsx
}>(/* copy default value verbatim */);

export const useSettings = () => {
  // copy body verbatim
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  // copy body verbatim — check for useTranslation, i18n, or other hooks used inside and import them (react-i18next etc.)
};
```
Check the copied `SettingsProvider` body for any usage of `getPersistentId`/`getSessionToken`/`setSessionToken` (from Task 1's `../lib/session`) or `useWakeLock` (`../hooks/useWakeLock`) and import as needed.

- [ ] **Step 5: Update `src/App.tsx`**

Remove the `SocketContext`/`useSocket`, `SettingsContext`/`useSettings`, and `SettingsProvider` definitions. Add:
```tsx
import { SocketContext, useSocket } from './context/SocketContext';
import { SettingsContext, useSettings, SettingsProvider } from './context/SettingsContext';
```
Keep every remaining usage of `useSocket()`, `useSettings()`, `<SettingsProvider>`, `SocketContext.Provider` in App.tsx working off these imports.

- [ ] **Step 6: Typecheck** — `npm run lint`, fix reported missing imports only.

- [ ] **Step 7: Test** — `npm test`, expect unchanged pass.

- [ ] **Step 8: Manual smoke check (quick)**

Run `npm run dev`, open `http://localhost:3000/avalon`, confirm the page loads without a blank screen or console error (contexts wire up correctly). This is a 30-second check, not a full flow test — full flow tests happen after Task 6.

- [ ] **Step 9: Commit**

```bash
git add src/context/SocketContext.tsx src/context/SettingsContext.tsx src/App.tsx
git commit -m "refactor: extract SocketContext and SettingsContext from App.tsx"
```

---

### Task 3: `components/ui/` (Button, Card, Badge, GameTitle, Layout)

**Files:**
- Create: `src/components/ui/GameTitle.tsx`
- Create: `src/components/ui/Layout.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Badge.tsx`
- Modify: `src/App.tsx`

These five are leaf presentational components (originally `GameTitle` L585-591, `Layout` L592-608, `Button` L609-639, `Card` L640-645, `Badge` L646-656 in the baseline — re-grep for current numbers, same as Task 2).

- [ ] **Step 1: Re-grep current line numbers**

Run: `grep -nE "^const (GameTitle|Layout|Button|Card|Badge) " src/App.tsx`

- [ ] **Step 2: Read each component's exact body** (Read tool, one range per component, ending where the next `const` begins).

- [ ] **Step 3: Create `src/components/ui/GameTitle.tsx`**

```tsx
export const GameTitle = ({ small = false }: { small?: boolean }) => (
  // copy JSX verbatim
);
```

- [ ] **Step 4: Create `src/components/ui/Layout.tsx`**

```tsx
import { ReactNode } from 'react';
import { GameTitle } from './GameTitle';

export const Layout = ({ children, showTitle = true, onSettingsClick }: { children: ReactNode; showTitle?: boolean; onSettingsClick?: () => void }) => (
  // copy JSX verbatim — it renders <GameTitle />, check for a Settings icon usage and import from lucide-react if present
);
```

- [ ] **Step 5: Create `src/components/ui/Button.tsx`**

```tsx
// copy the Button component verbatim, prefixed with export. Check its prop type for `Team` import from '../../core/avalon' if referenced.
```

- [ ] **Step 6: Create `src/components/ui/Card.tsx`**

```tsx
import { ReactNode } from 'react';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  // copy JSX verbatim
);
```

- [ ] **Step 7: Create `src/components/ui/Badge.tsx`**

```tsx
import { ReactNode } from 'react';
import type { Team } from '../../core/avalon';

export const Badge = ({ children, team, variant }: { children: ReactNode; team?: Team; variant?: 'purple' }) => (
  // copy JSX verbatim
);
```

- [ ] **Step 8: Update `src/App.tsx`**

Remove the five definitions, add:
```tsx
import { GameTitle } from './components/ui/GameTitle';
import { Layout } from './components/ui/Layout';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
```

- [ ] **Step 9: Typecheck** — `npm run lint`.

- [ ] **Step 10: Test** — `npm test`.

- [ ] **Step 11: Commit**

```bash
git add src/components/ui src/App.tsx
git commit -m "refactor: extract ui primitives (Button, Card, Badge, GameTitle, Layout) from App.tsx"
```

---

### Task 4: `components/modals/` (SettingsModal, LancelotModal)

**Files:**
- Create: `src/components/modals/SettingsModal.tsx`
- Create: `src/components/modals/LancelotModal.tsx`
- Modify: `src/App.tsx`

Baseline: `SettingsModal` L356-584 (large — full settings UI), `LancelotModal` L930-1187.

- [ ] **Step 1: Re-grep current line numbers**

Run: `grep -nE "^const (SettingsModal|LancelotModal)" src/App.tsx`

- [ ] **Step 2: Read each component's exact body.**

- [ ] **Step 3: Create `src/components/modals/SettingsModal.tsx`**

```tsx
// copy verbatim, prefixed with export const SettingsModal = ({ ... }) => { ... }
```
Check the body for: `useSettings` (`../../context/SettingsContext`), `useTranslation` (`react-i18next`), any lucide-react icons (`Settings`, `X`, `Volume2`, `VolumeX`, etc. — check which are actually referenced), `Button`/`Card` from `../ui/*` if used, `APP_VERSION` from `../../constants`.

- [ ] **Step 4: Create `src/components/modals/LancelotModal.tsx`**

```tsx
// copy verbatim, prefixed with export const LancelotModal = ({ ... }) => { ... }
```
Check the body for: `Room`/`Player` types from `../../types`, `Team`/`ROLES`/etc. from `../../core/avalon` if referenced, `motion`/`AnimatePresence` from `motion/react`, `Button`/`Card`/`Badge` from `../ui/*`, lucide icons actually used.

- [ ] **Step 5: Update `src/App.tsx`**

Remove both definitions, add:
```tsx
import { SettingsModal } from './components/modals/SettingsModal';
import { LancelotModal } from './components/modals/LancelotModal';
```

- [ ] **Step 6: Typecheck** — `npm run lint`.

- [ ] **Step 7: Test** — `npm test`.

- [ ] **Step 8: Manual smoke check**

`npm run dev`, open the app, open Settings (gear icon) — confirm it opens, shows current settings, closes correctly. Lancelot modal only appears mid-game with Lancelot variant enabled — if reaching that state is quick, check it too; otherwise defer to the full-flow check after Task 6.

- [ ] **Step 9: Commit**

```bash
git add src/components/modals src/App.tsx
git commit -m "refactor: extract SettingsModal and LancelotModal from App.tsx"
```

---

### Task 5: `components/lobby/` (MatchHistoryView, Home, Room, LobbyView)

**Files:**
- Create: `src/components/lobby/MatchHistoryView.tsx`
- Create: `src/components/lobby/Home.tsx`
- Create: `src/components/lobby/Room.tsx`
- Create: `src/components/lobby/LobbyView.tsx`
- Modify: `src/App.tsx`

Baseline: `MatchHistoryView` L657-704, `Home` L705-811, `Room` L812-929, `LobbyView` L1188-1697 (the largest of the four).

`Room` is a route-level component (used with `useParams`/`useNavigate` from `react-router-dom`) that renders `LobbyView`/`GameView` depending on phase — check its body during extraction to confirm exactly what it imports/renders so the import list in the new file is correct (don't assume; read it).

- [ ] **Step 1: Re-grep current line numbers**

Run: `grep -nE "^const (MatchHistoryView|Home|Room|LobbyView)" src/App.tsx`

- [ ] **Step 2: Read each component's exact body.**

- [ ] **Step 3: Create `src/components/lobby/MatchHistoryView.tsx`**

```tsx
import type { MatchRecord } from '../../types';

export const MatchHistoryView = ({ history, onBack }: { history: MatchRecord[]; onBack: () => void }) => {
  // copy body verbatim
};
```

- [ ] **Step 4: Create `src/components/lobby/Home.tsx`**

```tsx
// copy verbatim, prefixed with export const Home = () => { ... }
```
Check for: `useNavigate` (`react-router-dom`), `useSocket`/`useSettings` (`../../context/*`), `getPersistentId`/session helpers (`../../lib/session`), `Layout`/`Button`/`Card` (`../ui/*`), `MatchHistoryView` (`./MatchHistoryView`), `APP_VERSION` (`../../constants`), lucide icons used.

- [ ] **Step 5: Create `src/components/lobby/Room.tsx`**

```tsx
// copy verbatim, prefixed with export const Room = () => { ... }
```
Check for: `useParams`/`useNavigate` (`react-router-dom`), `useSocket`/`useSettings` (`../../context/*`), `Room`/`Player` types (`../../types`), `LobbyView` (`./LobbyView`), `GameView` (`../game/GameView` — this import path won't exist until Task 6; for this task, temporarily import it from its still-in-App.tsx location is not possible since App.tsx isn't a module others import from for this — instead, sequence check below).

**Sequencing note:** `Room` renders `LobbyView` and (once the game starts) `GameView`. `GameView` isn't extracted until Task 6. To keep every task independently green:
- Extract `Room` in this task but do NOT yet change its `GameView` reference — leave `GameView` usage as a prop/import that still resolves to the version defined in `App.tsx` at this point in the plan is not possible once `Room` moves out of `App.tsx`.
- Instead: in this task, add a **temporary** import in `src/components/lobby/Room.tsx`: `import { GameView } from '../../App';` is not valid (App.tsx has no named export for it and this would create a cycle). Resolve this by reordering: **extract `GameView` and its dependents (Task 6) before finalizing `Room`'s import**, i.e. within this task, after creating `Room.tsx`, leave a `// TODO(Task 6): import GameView from '../game/GameView'` comment and keep `Room`'s JSX referencing `GameView` as a prop passed in from `App.tsx` instead of importing it directly — check the current code first: if `Room` already receives rendering of the game phase via a child prop rather than importing `GameView` itself, no special handling is needed. Read the actual `Room` body before assuming either way.

- [ ] **Step 6: Create `src/components/lobby/LobbyView.tsx`**

```tsx
// copy verbatim, prefixed with export const LobbyView = ({ room, isHost, onLeave }: { room: Room; isHost: boolean; onLeave: () => void }) => { ... }
```
Check for: `Room`/`Player` types (`../../types`), `useSocket`/`useSettings` (`../../context/*`), `Button`/`Card`/`Badge`/`Layout` (`../ui/*`), `QRCodeSVG` (`qrcode.react`), lucide icons used, `ROLES`/`Team`/etc. from `../../core/avalon` if referenced.

- [ ] **Step 7: Update `src/App.tsx`**

Remove the four definitions, add:
```tsx
import { MatchHistoryView } from './components/lobby/MatchHistoryView';
import { Home } from './components/lobby/Home';
import { Room } from './components/lobby/Room';
import { LobbyView } from './components/lobby/LobbyView';
```
Resolve the `GameView` reference inside `Room` per the sequencing note above based on what the actual code does.

- [ ] **Step 8: Typecheck** — `npm run lint`. If `Room` genuinely needs `GameView` and Task 6 hasn't run yet, this is the signal to do Task 5 and Task 6 back-to-back before committing Task 5 alone — commit both together as one task if the dependency is real (check actual code first; don't assume).

- [ ] **Step 9: Test** — `npm test`.

- [ ] **Step 10: Commit**

```bash
git add src/components/lobby src/App.tsx
git commit -m "refactor: extract Home, Room, LobbyView, MatchHistoryView from App.tsx"
```

---

### Task 6: `components/game/` (KnowledgeSection, CharacterRevealView, NarrationView, GameView) + move GameGuide/GameManual

**Files:**
- Create: `src/components/game/KnowledgeSection.tsx`
- Create: `src/components/game/CharacterRevealView.tsx`
- Create: `src/components/game/NarrationView.tsx`
- Create: `src/components/game/GameView.tsx`
- Move: `src/components/GameGuide.tsx` → `src/components/game/GameGuide.tsx`
- Move: `src/components/GameManual.tsx` → `src/components/game/GameManual.tsx`
- Modify: `src/App.tsx`

Baseline: `CharacterRevealView` L1698-1738, `NarrationView` L1739-1952, `KnowledgeSection` L1953-1987, `GameView` L1988-2678 (largest single component in the file).

- [ ] **Step 1: Re-grep current line numbers**

Run: `grep -nE "^const (CharacterRevealView|NarrationView|KnowledgeSection|GameView)" src/App.tsx`

- [ ] **Step 2: Move GameGuide.tsx and GameManual.tsx first (simplest sub-step)**

```bash
git mv src/components/GameGuide.tsx src/components/game/GameGuide.tsx
git mv src/components/GameManual.tsx src/components/game/GameManual.tsx
```
These files' own internal imports (e.g. of `../types` if any) may need a path fix — check their top-of-file imports; anything relative to `src/components/` (one level) now needs an extra `../` (two levels) since they moved one directory deeper.

- [ ] **Step 3: Read each remaining component's exact body.**

- [ ] **Step 4: Create `src/components/game/CharacterRevealView.tsx`**

```tsx
import type { Room, Player } from '../../types';

export const CharacterRevealView = ({ room, me }: { room: Room; me?: Player }) => {
  // copy body verbatim
};
```

- [ ] **Step 5: Create `src/components/game/NarrationView.tsx`**

```tsx
// copy verbatim, prefixed with export const NarrationView = ({ room, isHost }: { room: Room; isHost: boolean }) => { ... }
```
Check for: `Room` type (`../../types`), `generateNarrationSequence`/`shouldPauseAfter` (`../../core/avalon`), `useSocket` (`../../context/SocketContext`), audio-related icons (`Play`, `Pause`, `Volume2`, `VolumeX`, `SkipForward`, `SkipBack`) from `lucide-react`.

- [ ] **Step 6: Create `src/components/game/KnowledgeSection.tsx`**

```tsx
import type { Room, Player } from '../../types';

export const KnowledgeSection = ({ room, me }: { room: Room; me: Player }) => {
  // copy body verbatim
};
```

- [ ] **Step 7: Create `src/components/game/GameView.tsx`**

```tsx
// copy verbatim, prefixed with export const GameView = ({ room, me, isHost, onLeave }: { room: Room; me?: Player; isHost: boolean; onLeave: () => void }) => { ... }
```
This is the largest extraction (~690 lines). Check for: `Room`/`Player`/`Mission`/`GamePhase` types (`../../types`), `useSocket`/`useSettings` (`../../context/*`), `Layout`/`Button`/`Card`/`Badge` (`../ui/*`), `NarrationView`/`CharacterRevealView`/`KnowledgeSection` (`./NarrationView` etc.), `GameGuide`/`GameManual` (`./GameGuide`, `./GameManual` — these are `lazy()`-loaded; keep the `lazy(() => import(...))` wrapper, just update the path and move the `lazy(...)` declarations themselves into this file or keep them in `App.tsx` per Step 9 below — check current usage to decide, don't assume), all game-logic imports from `../../core/avalon` actually referenced (`ROLES`, `MISSION_SIZES`, `needsTwoFails`, `Team`, `TEAM_DISTRIBUTION`, `getRoleInfo`), and every lucide icon actually used in this component (likely the majority of the icon list — verify with `tsc`, don't guess).

- [ ] **Step 8: Update `src/App.tsx`**

Remove the four definitions. Add:
```tsx
import { CharacterRevealView } from './components/game/CharacterRevealView';
import { NarrationView } from './components/game/NarrationView';
import { KnowledgeSection } from './components/game/KnowledgeSection';
import { GameView } from './components/game/GameView';
```

- [ ] **Step 9: Relocate the `lazy()` GameGuide/GameManual imports**

The two `lazy(() => import('./components/GameGuide')...)` declarations (currently near the top of `App.tsx`) should move to wherever `GameGuide`/`GameManual` are actually rendered (inside `GameView`, based on the code). Move them into `src/components/game/GameView.tsx`:
```tsx
import { lazy, Suspense } from 'react';
const GameGuide = lazy(() => import('./GameGuide').then(m => ({ default: m.GameGuide })));
const GameManual = lazy(() => import('./GameManual').then(m => ({ default: m.GameManual })));
```
Remove the old declarations (and the now-unused `lazy` import, if nothing else in `App.tsx` needs it) from `App.tsx`. Check whether `<Suspense>` wrapping them was in `App.tsx` or already inside the component that's moving — move the `Suspense` boundary along with it if it was co-located with the render call, don't leave it behind.

- [ ] **Step 10: Resolve the Task 5 `Room` → `GameView` reference**

Now that `GameView` has a real path (`../game/GameView`), go back to `src/components/lobby/Room.tsx` (from Task 5) and replace the temporary handling with:
```tsx
import { GameView } from '../game/GameView';
```
Remove any placeholder comment left in Task 5.

- [ ] **Step 11: Typecheck** — `npm run lint`. This is the task most likely to surface missing-import errors given `GameView`'s size — resolve each one by adding the specific import `tsc` names, sourced from the master list in Task 1 Step 1 or `core/avalon`'s exports.

- [ ] **Step 12: Test** — `npm test`.

- [ ] **Step 13: Full manual smoke test**

`npm run dev`, open `http://localhost:3000/avalon`, and walk the full flow:
1. Create a room, confirm lobby renders (players list, room code/QR).
2. Start a game with enough players, confirm role reveal / narration view plays.
3. Reach the mission-proposal / voting screens, confirm `GameView` renders team selection, voting, mission results.
4. Open the in-game Guide and Manual (buttons that trigger `GameGuide`/`GameManual` lazy components), confirm both open without a blank panel or console error.
5. Trigger a Lancelot-variant game if quick to set up, confirm `LancelotModal` still opens mid-game.

Fix any regression found before proceeding — do not commit with a known-broken flow.

- [ ] **Step 14: Commit**

```bash
git add src/components/game src/components/lobby/Room.tsx src/App.tsx
git commit -m "refactor: extract GameView and game sub-views from App.tsx, move GameGuide/GameManual into components/game"
```

---

### Task 7: Final App.tsx cleanup

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Read the full current `src/App.tsx`** (should now only contain: license header, imports, the `App` default-export component with `<Router>`/`<Routes>`/`<Route>` wiring, and possibly a leftover `useSocket`-based socket-initialization effect if that lived at the top level rather than inside `SettingsProvider`/`Home`/`Room` — check).

- [ ] **Step 2: Remove now-unused imports**

Run: `npm run lint` — TypeScript with `noUnusedLocals` (check `tsconfig.json`; if not enabled, use `npx eslint src/App.tsx` if an eslint config exists, otherwise manually scan) will not always flag unused imports as build errors. Manually diff the top-of-file import block against what's actually referenced in the remaining `App()` function body and delete anything unused (e.g., `motion`/`AnimatePresence` if no longer used directly in `App.tsx`, individual lucide icons, `useState`/`useEffect`/`useRef` if unused, `Team`/`ROLES`/etc. from `core/avalon` if unused).

- [ ] **Step 3: Confirm final size**

Run: `wc -l src/App.tsx`
Expected: roughly 150-250 lines (providers + routing only), consistent with the spec's target. If it's still large, check for anything that should have moved in Tasks 1-6 but was missed.

- [ ] **Step 4: Typecheck** — `npm run lint`.

- [ ] **Step 5: Test** — `npm test`.

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: succeeds with no errors (this is the first task to run a full production build, catching any issue `tsc --noEmit` alone might miss, e.g. Vite-specific import resolution).

- [ ] **Step 7: Final full manual smoke test**

Repeat the Task 6 Step 13 flow once more against the production-equivalent state (or `npm run dev` is fine if `build` passed) to confirm the cleanup didn't remove something still in use.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: clean up unused imports in App.tsx after modularization"
```

---

## Self-review notes

- **Spec coverage:** All 7 groups from the spec (`docs/superpowers/specs/2026-07-12-app-tsx-modularization-design.md`) map 1:1 to Task 1 through Task 7. The spec's `types.ts`/`constants.ts` group additionally absorbed `getPersistentId`/`getSessionToken`/`setSessionToken` and `useWakeLock` (Task 1) — these weren't named in the spec's file tree but need a home; grouped with the other zero-JSX, zero-dependency pieces per the same "safest first" rationale the spec used, and called out explicitly here to avoid a silent gap.
- **Known open sequencing risk:** Task 5 (`Room`) and Task 6 (`GameView`) have a real ordering dependency (`Room` renders `GameView`) that the spec didn't resolve at the design level. Task 5 includes an explicit instruction to check the actual code and, if the dependency is real, fold Task 5 and Task 6 into one combined commit rather than leaving `Room` in a broken intermediate state.
- **Out of scope confirmed:** no task changes component behavior, props, or visuals; no task touches responsive breakpoints (tracked separately).
