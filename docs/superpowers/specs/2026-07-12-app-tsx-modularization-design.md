# App.tsx Modularization — Design

## Problem

`src/App.tsx` is 2724 lines and defines ~18 top-level components (contexts,
providers, UI primitives, modals, lobby views, game views) in a single file.
Flagged in code review as P2: not a visual bug, but it makes maintaining
consistent design tokens/patterns harder as the app grows, and makes each
component harder to reason about in isolation.

## Goal

Full split: every top-level component/context currently defined in App.tsx
moves to its own file, organized by domain. App.tsx shrinks to providers +
routing only (~150-250 lines target). No behavior, prop, or visual changes —
pure mechanical extraction.

## Target structure

```
src/
  types.ts              # Room, Player, Mission, GamePhase, MatchRecord,
                         # TeamVoteResult, MissionVoteResult, AvalonSettings
  constants.ts           # APP_VERSION, DEFAULT_SETTINGS
  context/
    SocketContext.tsx    # SocketContext
    SettingsContext.tsx  # SettingsContext + SettingsProvider
  components/
    ui/
      Button.tsx
      Card.tsx
      Badge.tsx
      GameTitle.tsx
      Layout.tsx
    modals/
      SettingsModal.tsx
      LancelotModal.tsx
    lobby/
      Home.tsx
      Room.tsx
      LobbyView.tsx
      MatchHistoryView.tsx
    game/
      GameView.tsx
      NarrationView.tsx
      CharacterRevealView.tsx
      KnowledgeSection.tsx
      GameGuide.tsx       # moved from components/ (flat)
      GameManual.tsx      # moved from components/ (flat)
  App.tsx                 # providers + routes only
```

`core/avalon.ts` is left untouched — it already holds pure game-rules logic
(roles, shuffle, mission sizes) and stays separate from the App/socket-state
shapes moving into `types.ts`.

## Rationale for grouping

- **ui/**: pure presentational primitives, no dependency on game/socket state.
- **modals/**: overlay components (SettingsModal, LancelotModal), each
  self-contained, only depend on types/context/ui.
- **lobby/**: pre-game flow (create/join room, lobby screen, match history).
- **game/**: in-game views. GameGuide/GameManual already exist as separate
  files under `components/` (flat) — moved into `game/` for consistency since
  they're in-game reference material, same domain as GameView.

## Extraction order (one commit per group)

1. `types.ts` + `constants.ts` — pure data, zero JSX, no component
   dependencies. Safest first step; unlocks everything else.
2. `context/` — SocketContext, SettingsContext, SettingsProvider. Depends on
   types.ts/constants.ts only.
3. `components/ui/` — Button, Card, Badge, GameTitle, Layout. Leaf components,
   no dependency on context or other extracted components.
4. `components/modals/` — SettingsModal, LancelotModal. Depend on
   types/constants/context/ui.
5. `components/lobby/` — MatchHistoryView, Home, Room, LobbyView. Depend on
   types/constants/context/ui/modals.
6. `components/game/` — KnowledgeSection, CharacterRevealView, NarrationView,
   GameView, plus moving GameGuide.tsx and GameManual.tsx from flat
   `components/` into `components/game/`.
7. Final App.tsx cleanup — remove dead imports/definitions left behind,
   confirm final line count, update any relative imports broken by the
   GameGuide/GameManual move (they're lazy-imported from App.tsx).

Each group is extracted verbatim: same JSX, same logic, same prop signatures.
Only changes are import paths and adding a named export per file. No renames,
no behavior changes.

## Import safety

- No circular imports: types.ts and constants.ts have zero component
  dependencies. context/ depends only on types/constants. ui/ depends only on
  types (for prop types) — no context dependency. modals/, lobby/, game/ each
  depend downward only (types, constants, context, ui, and earlier-extracted
  siblings within their own group where already established in the current
  file, e.g. LobbyView using MatchHistoryView).
- GameGuide/GameManual stay lazy-loaded (`lazy(() => import(...))`) exactly as
  they are today; only the import path changes to point at
  `./components/game/GameGuide` etc.

## Verification per group

- `npm run lint` (`tsc --noEmit`) must pass after every group — catches
  broken imports/type errors immediately.
- `npm test` (vitest — currently covers `core/avalon.ts` game rules only)
  must stay green. Not expected to be affected by this refactor, but cheap
  to confirm nothing else broke.
- Manual browser smoke test after groups 4-6 (modals/lobby/game — where a
  broken import could silently change render output): create room → lobby →
  start game → open Settings modal → open Lancelot modal (if game
  configured with Lancelot) → open Game Guide / Game Manual. Confirm each
  screen renders identically to pre-refactor.
- Groups 1-3 (types/constants/context/ui) are low visual risk: a passing
  `tsc` + `vitest` run is sufficient; no mandatory browser pass, though a
  quick reload is cheap insurance.

## Rollback

Each group is committed independently. If group N introduces a regression,
`git revert` that specific commit without touching prior groups' work.

## Out of scope

- No behavior or visual changes — pure code movement.
- No new abstractions, no prop renames, no dead-code removal beyond what's
  naturally left behind by the move (e.g., now-unused imports in App.tsx).
- Responsive breakpoint gaps (`lg:`/`xl:`, tracked separately as its own
  item) are not addressed here.
