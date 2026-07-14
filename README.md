# Avalon: The Resistance — In-Person

Web app to run in-person Avalon sessions. Handles role assignment, automated audio narration, QR code room joining, and an integrated rules guide.

**Live:**
- 🇧🇷 [jogos.deyvyd.com/avalon](https://jogos.deyvyd.com/avalon) — Portuguese
- 🇺🇸 [games.deyvyd.com/avalon](https://games.deyvyd.com/avalon) — English

<div align="center">
  <img src="public/screenshot.png" alt="Avalon App" />
</div>

Language detected automatically from subdomain (`games.*` → EN, otherwise → PT).

## Stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS 4 (CSS-first `@theme`, no `tailwind.config.js`)
- Express + Socket.io (real-time WebSocket room sync; rooms live in server memory only)
- react-router-dom (client routing, `/avalon` basename)
- react-i18next + i18next (i18n, language auto-detected from subdomain)
- motion (`motion/react`) for UI animation
- vite-plugin-pwa (installable PWA) + qrcode.react (room join QR code)
- Vitest (server-side integration tests)
- Render (hosting)

## Run locally

**Prerequisites:** Node.js ≥ 20

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server (Express + Vite HMR via `tsx server.ts`) |
| `npm run build` | Production build (Vite → `dist/`) |
| `npm run start` | Start production server (requires build) |
| `npm run preview` | Preview a production build with Vite's static server |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |
| `npm test` | Run the Vitest server-integration suite |
| `npm run clean` | Remove `dist/` |

## Testing

`tests/` holds server-side integration tests (game rules, security/validation, full match harness) run against the Socket.io server directly — there is no component/UI test framework in this project. CI (`.github/workflows/ci.yml`) runs `lint` → `test` → `build` on every push to `main` and on pull requests.

## Deploy (Render)

Build command: `npm install; npm run build`  
Start command: `npm run start`

Required environment variables:
- `NODE_ENV=production`
- `PORT=3000` (optional, defaults to 3000)
- `CORS_ORIGIN` (optional) — comma-separated list of extra allowed origins for Socket.io; by default only same-origin clients can connect

> **Note:** rooms live in server memory only. A server restart or redeploy drops all active rooms and matches — avoid deploying while games are running.

Both domains (`jogos.deyvyd.com` and `games.deyvyd.com`) point via CNAME to the same Render service. Language detection is client-side via `window.location.hostname`.

## Structure

```
server.ts                      # Express + Socket.io server: rooms, game state, all socket events
src/
  main.tsx                     # Entry point (StrictMode root)
  App.tsx                      # Routes, Socket.io client, context providers
  index.css                    # Tailwind v4 @theme (fonts, z-index scale)
  constants.ts                 # DEFAULT_SETTINGS and other shared constants
  types.ts                     # Shared TypeScript types (rooms, players, roles, settings)
  core/
    avalon.ts                  # Role logic, team/mission rules, narration script assignment
  context/
    SocketContext.tsx          # Socket.io client instance
    SettingsContext.tsx        # Audio/UI settings, persisted to localStorage
    ToastContext.tsx           # Toast (snackbar) provider — replaces alert()
    ConfirmContext.tsx         # Promise-based confirm modal provider — replaces window.confirm()
  hooks/
    useWakeLock.ts             # Keeps screen awake during narration/game
  lib/
    session.ts                 # Persistent player id + room session tokens
  components/
    lobby/
      Home.tsx                 # Landing page: create/join room
      Room.tsx                 # Room shell: join flow, leave flow, routes to lobby/game
      LobbyView.tsx             # Pre-game lobby: player list, QR code, start game
      MatchHistoryView.tsx     # Past matches summary
    game/
      GameView.tsx             # Main in-game screen: teams, votes, missions
      CharacterRevealView.tsx  # Private role reveal screen
      NarrationView.tsx        # Automated audio narration playback
      GameGuide.tsx            # Quick rules reference
      GameManual.tsx           # Full game manual
      KnowledgeSection.tsx     # "What each role knows" reference
    modals/
      SettingsModal.tsx        # Settings panel (audio, interface, language, restore defaults)
      LancelotModal.tsx        # Lancelot variant role-swap modal
    ui/
      Button.tsx, Card.tsx, Badge.tsx, Layout.tsx, GameTitle.tsx
      Toast.tsx                # Presentational toast (used by ToastContext)
      ConfirmModal.tsx         # Presentational confirm dialog (used by ConfirmContext)
  i18n/
    index.ts                   # i18next setup + subdomain language detector
    locales/
      pt.json                  # Portuguese strings
      en.json                  # English strings
  assets/audios/                # Narration voice lines + soundtrack (mp3)
tests/
  game.test.ts                 # Game-rules integration tests
  security.test.ts             # Input validation / abuse-case tests
  rules.test.ts                # Role/rules edge cases
  harness.ts                   # Shared test harness (socket client helpers)
docs/
  superpowers/
    plans/                     # Implementation plans (superpowers workflow)
    specs/                     # Design specs backing those plans
public/                        # Static assets (favicon, manifest, screenshot)
```
