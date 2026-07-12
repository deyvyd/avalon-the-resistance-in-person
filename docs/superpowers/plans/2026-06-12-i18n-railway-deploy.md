# i18n + Railway Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the same Railway deployment at jogos.deyvyd.com/avalon (PT) and games.deyvyd.com/avalon (EN), with react-i18next detecting language from subdomain at runtime.

**Architecture:** Single Railway service, one build, one server. Language is detected client-side from `window.location.hostname` (`jogos.*` → `pt`, `games.*` → `en`, default `pt`). All UI strings extracted to `src/i18n/locales/{pt,en}.json`. Vite base path set to `/avalon/`; Socket.io path set to `/avalon/socket.io`; BrowserRouter basename set to `/avalon`.

**Tech Stack:** react-i18next 15, i18next 24, Railway (nixpacks), Node 20, Express, Socket.io 4, Vite 6.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add react-i18next + i18next deps |
| `src/i18n/index.ts` | Create | i18next setup + subdomain lang detector |
| `src/i18n/locales/pt.json` | Create | All PT strings |
| `src/i18n/locales/en.json` | Create | All EN strings |
| `src/core/avalon.ts` | Modify | Export role i18n keys; remove hardcoded PT descriptions/names |
| `src/App.tsx` | Modify | Replace hardcoded PT strings with `t()` calls |
| `src/components/GameGuide.tsx` | Modify | Replace hardcoded PT strings with `t()` calls |
| `src/components/GameManual.tsx` | Modify | Replace hardcoded PT strings with `t()` calls |
| `src/main.tsx` | Modify | Wrap app with `I18nextProvider` |
| `vite.config.ts` | Modify | `base: '/avalon/'`, update PWA manifest fields |
| `server.ts` | Modify | Serve static from `/avalon`, Socket.io path `/avalon/socket.io` |
| `nixpacks.toml` | Create | Railway build + start commands |
| `railway.toml` | Create | Railway service config |

---

## Task 1: Add i18n dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd "C:\Users\Deyvy\Downloads\avalon-the-resistance-presencial"
npm install react-i18next@15 i18next@24
```

Expected: `package.json` now lists `react-i18next` and `i18next` under `dependencies`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-i18next and i18next"
```

---

## Task 2: Create i18n setup with subdomain language detector

**Files:**
- Create: `src/i18n/index.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pt from './locales/pt.json';
import en from './locales/en.json';

function detectLanguage(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host.startsWith('games.')) return 'en';
  return 'pt';
}

i18n
  .use(initReactI18next)
  .init({
    resources: { pt: { translation: pt }, en: { translation: en } },
    lng: detectLanguage(),
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
  });

export default i18n;
```

- [ ] **Step 2: Create placeholder locale files (filled in Task 3)**

Create `src/i18n/locales/pt.json`:
```json
{}
```

Create `src/i18n/locales/en.json`:
```json
{}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/
git commit -m "feat(i18n): add i18next setup with subdomain language detector"
```

---

## Task 3: Extract strings from `src/core/avalon.ts`

The file defines `ROLES` with hardcoded PT `name` and `description` fields, plus `generateNarrationSequence` that returns PT narration strings.

**Files:**
- Modify: `src/core/avalon.ts`
- Modify: `src/i18n/locales/pt.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Read current ROLES and narration strings**

Read the full `src/core/avalon.ts` to inventory all PT strings (role names, descriptions, narration steps).

- [ ] **Step 2: Add role keys to locale files**

Add to `src/i18n/locales/pt.json`:
```json
{
  "roles": {
    "merlin": {
      "name": "Merlin",
      "description": "Sabe quem são todos os servos do mal (exceto Mordred). Deve guiar o Bem sem revelar sua identidade."
    },
    "assassin": {
      "name": "Assassino",
      "description": "Tenta identificar e assassinar Merlin se o Bem vencer 3 missões."
    },
    "servant": {
      "name": "Servo de Arthur",
      "description": "Um servo leal de Arthur. Não tem poderes especiais."
    },
    "minion": {
      "name": "Minion de Mordred",
      "description": "Um servo do mal. Conhece os outros servos do mal."
    },
    "percival": {
      "name": "Percival",
      "description": "Vê quem pode ser Merlin (e Morgana). Ajuda a proteger Merlin."
    },
    "morgana": {
      "name": "Morgana",
      "description": "Aparece como 'possível Merlin' para Percival."
    },
    "mordred": {
      "name": "Mordred",
      "description": "Invisível para Merlin. O mal não revelado."
    },
    "oberon": {
      "name": "Oberon",
      "description": "Servo do mal que não conhece os outros servos do mal, e vice-versa."
    },
    "lancelot_good": {
      "name": "Lancelot (Bom)",
      "description": "Servo do Bem que pode ter sua lealdade trocada."
    },
    "lancelot_evil": {
      "name": "Lancelot (Mal)",
      "description": "Servo do Mal que pode ter sua lealdade trocada."
    }
  }
}
```

Add to `src/i18n/locales/en.json`:
```json
{
  "roles": {
    "merlin": {
      "name": "Merlin",
      "description": "Knows all servants of evil (except Mordred). Must guide the Good without revealing his identity."
    },
    "assassin": {
      "name": "Assassin",
      "description": "Tries to identify and assassinate Merlin if Good wins 3 missions."
    },
    "servant": {
      "name": "Loyal Servant of Arthur",
      "description": "A loyal servant of Arthur. Has no special powers."
    },
    "minion": {
      "name": "Minion of Mordred",
      "description": "A servant of evil. Knows the other servants of evil."
    },
    "percival": {
      "name": "Percival",
      "description": "Sees who could be Merlin (and Morgana). Helps protect Merlin."
    },
    "morgana": {
      "name": "Morgana",
      "description": "Appears as 'possible Merlin' to Percival."
    },
    "mordred": {
      "name": "Mordred",
      "description": "Invisible to Merlin. Evil unrevealed."
    },
    "oberon": {
      "name": "Oberon",
      "description": "Servant of evil who does not know the other servants of evil, and vice versa."
    },
    "lancelot_good": {
      "name": "Lancelot (Good)",
      "description": "Servant of Good who may have his loyalty switched."
    },
    "lancelot_evil": {
      "name": "Lancelot (Evil)",
      "description": "Servant of Evil who may have his loyalty switched."
    }
  }
}
```

- [ ] **Step 3: Update `src/core/avalon.ts` ROLES to use i18n keys instead of hardcoded strings**

Replace `name` and `description` fields in ROLES with i18n key references. Export a helper `getRoleInfo(roleId, t)` that returns localized `RoleInfo`:

```typescript
// In src/core/avalon.ts — add at top
import type { TFunction } from 'i18next';

export function getRoleInfo(roleId: string, t: TFunction): RoleInfo {
  const base = ROLES[roleId];
  return {
    ...base,
    name: t(`roles.${roleId}.name`),
    description: t(`roles.${roleId}.description`),
  };
}
```

Keep `ROLES` with English fallback names for server-side logic that doesn't need i18n (role assignment uses `id`, not `name`).

- [ ] **Step 4: Add narration strings to locale files**

Read `generateNarrationSequence` in `src/core/avalon.ts`. Extract all PT narration step strings into `pt.json` under `"narration"` key, translate them into `en.json`. The exact strings depend on what you find in the file — add every string returned by the function.

- [ ] **Step 5: Update `generateNarrationSequence` to accept `t` parameter**

```typescript
export function generateNarrationSequence(config: NarrationConfig, t: TFunction): NarrationStep[] {
  // replace all hardcoded PT strings with t('narration.stepN') calls
}
```

- [ ] **Step 6: Commit**

```bash
git add src/core/avalon.ts src/i18n/locales/
git commit -m "feat(i18n): extract role and narration strings to locale files"
```

---

## Task 4: Extract strings from `src/App.tsx`

App.tsx has 2740 lines. Work section by section (UI labels, button text, status messages, game phase descriptions).

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/i18n/locales/pt.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add `useTranslation` hook at top of App.tsx**

```typescript
import { useTranslation } from 'react-i18next';
```

Inside the root `App` component and any sub-component that uses strings:
```typescript
const { t } = useTranslation();
```

- [ ] **Step 2: Scan App.tsx for hardcoded PT strings and extract them**

Search for Portuguese text patterns: any JSX string literals, template literals, or ternary strings in PT. For each string found, add it to both locale files and replace with `t('key')`.

Group keys logically in the JSON:
```json
{
  "app": {
    "lobby": {
      "title": "Avalon: A Resistência",
      "waitingForPlayers": "Aguardando jogadores...",
      "startGame": "Iniciar Jogo",
      "copyLink": "Copiar link",
      "linkCopied": "Link copiado!",
      "players": "Jogadores",
      "createRoom": "Criar Sala",
      "joinRoom": "Entrar na Sala",
      "roomCode": "Código da Sala",
      "yourName": "Seu nome",
      "enterName": "Digite seu nome"
    },
    "game": {
      "mission": "Missão",
      "vote": "Votar",
      "approve": "Aprovar",
      "reject": "Rejeitar",
      "success": "Sucesso",
      "fail": "Falha",
      "teamSelection": "Seleção de Equipe",
      "missionVote": "Voto da Missão",
      "goodWins": "O Bem Venceu!",
      "evilWins": "O Mal Venceu!",
      "nextMission": "Próxima Missão",
      "round": "Rodada",
      "leader": "Líder",
      "confirm": "Confirmar",
      "cancel": "Cancelar"
    },
    "role": {
      "yourRole": "Seu Papel",
      "team": {
        "good": "Bem",
        "evil": "Mal"
      }
    },
    "errors": {
      "roomNotFound": "Sala não encontrada",
      "nameTaken": "Nome já em uso",
      "gameInProgress": "Jogo em andamento"
    }
  }
}
```

EN equivalents:
```json
{
  "app": {
    "lobby": {
      "title": "Avalon: The Resistance",
      "waitingForPlayers": "Waiting for players...",
      "startGame": "Start Game",
      "copyLink": "Copy link",
      "linkCopied": "Link copied!",
      "players": "Players",
      "createRoom": "Create Room",
      "joinRoom": "Join Room",
      "roomCode": "Room Code",
      "yourName": "Your name",
      "enterName": "Enter your name"
    },
    "game": {
      "mission": "Mission",
      "vote": "Vote",
      "approve": "Approve",
      "reject": "Reject",
      "success": "Success",
      "fail": "Fail",
      "teamSelection": "Team Selection",
      "missionVote": "Mission Vote",
      "goodWins": "Good Wins!",
      "evilWins": "Evil Wins!",
      "nextMission": "Next Mission",
      "round": "Round",
      "leader": "Leader",
      "confirm": "Confirm",
      "cancel": "Cancel"
    },
    "role": {
      "yourRole": "Your Role",
      "team": {
        "good": "Good",
        "evil": "Evil"
      }
    },
    "errors": {
      "roomNotFound": "Room not found",
      "nameTaken": "Name already taken",
      "gameInProgress": "Game in progress"
    }
  }
}
```

> **Note:** The above JSON is a starting skeleton. As you read App.tsx line by line, add every PT string you find. Do not skip strings. After the full pass, run `npm run lint` and verify there are no remaining PT string literals in JSX.

- [ ] **Step 3: Update all `getRoleInfo` call sites in App.tsx**

Anywhere App.tsx references `ROLES[roleId].name` or `ROLES[roleId].description`, replace with `getRoleInfo(roleId, t).name` / `.description`.

- [ ] **Step 4: Update `generateNarrationSequence` call sites**

Pass `t` as second argument wherever called in App.tsx.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/i18n/locales/
git commit -m "feat(i18n): replace hardcoded PT strings in App.tsx with t() calls"
```

---

## Task 5: Extract strings from GameGuide.tsx and GameManual.tsx

**Files:**
- Modify: `src/components/GameGuide.tsx`
- Modify: `src/components/GameManual.tsx`
- Modify: `src/i18n/locales/pt.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Read both component files in full**

- [ ] **Step 2: Add `useTranslation` and replace PT strings in GameGuide.tsx**

```typescript
import { useTranslation } from 'react-i18next';
// inside component:
const { t } = useTranslation();
```

Add all strings found under `"guide"` key in locale files. Translate to EN.

- [ ] **Step 3: Add `useTranslation` and replace PT strings in GameManual.tsx**

Same pattern — add under `"manual"` key in locale files.

- [ ] **Step 4: Commit**

```bash
git add src/components/ src/i18n/locales/
git commit -m "feat(i18n): replace PT strings in GameGuide and GameManual"
```

---

## Task 6: Update main.tsx, vite.config.ts, and server.ts for `/avalon` base path

**Files:**
- Modify: `src/main.tsx`
- Modify: `vite.config.ts`
- Modify: `server.ts`

- [ ] **Step 1: Update `src/main.tsx` to init i18n and set BrowserRouter basename**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n/index.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 2: In `src/App.tsx`, find the `<BrowserRouter>` (or `<Router>`) element and add `basename="/avalon"`**

```tsx
<Router basename="/avalon">
```

- [ ] **Step 3: Update `vite.config.ts`**

Add `base: '/avalon/'` and update PWA manifest for both languages. Since there's one build, use the PT manifest as default (Railway serves both domains from same build):

```typescript
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/avalon/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Avalon: The Resistance',
          short_name: 'Avalon',
          description: 'Presential board game digital companion',
          theme_color: '#ffd700',
          background_color: '#0d1b2a',
          display: 'standalone',
          start_url: '/avalon/',
          scope: '/avalon/',
          icons: [
            { src: 'https://picsum.photos/seed/avalon/192/192', sizes: '192x192', type: 'image/png' },
            { src: 'https://picsum.photos/seed/avalon/512/512', sizes: '512x512', type: 'image/png' }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
```

- [ ] **Step 4: Update `server.ts` to serve under `/avalon` path and set Socket.io path**

Find the `new Server(httpServer, {...})` call and add `path`:
```typescript
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/avalon/socket.io',
});
```

In the production static serving section, update to serve from `/avalon`:
```typescript
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use('/avalon', express.static(distPath));
  app.get('/avalon/*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  // Redirect root to /avalon
  app.get('/', (req, res) => res.redirect('/avalon/'));
}
```

- [ ] **Step 5: Update Socket.io client connection in `src/App.tsx`**

Find where `io(...)` is called (Socket.io client connect). Add path option:
```typescript
const socket = io(window.location.origin, {
  path: '/avalon/socket.io',
});
```

- [ ] **Step 6: Commit**

```bash
git add src/main.tsx src/App.tsx vite.config.ts server.ts
git commit -m "feat(deploy): set /avalon base path for vite, express, and socket.io"
```

---

## Task 7: Add Railway deployment config

**Files:**
- Create: `nixpacks.toml`
- Create: `railway.toml`

- [ ] **Step 1: Create `nixpacks.toml`**

```toml
[phases.build]
cmds = ["npm ci", "npm run build"]

[start]
cmd = "node --experimental-strip-types server.ts"
```

> Note: `server.ts` uses `import` from `.ts` files directly (e.g. `import ... from './src/core/avalon.ts'`). Node 22+ `--experimental-strip-types` handles this. If Railway uses Node 20, change to `npx tsx server.ts`.

- [ ] **Step 2: Create `railway.toml`**

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npx tsx server.ts"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[services.envs]]
name = "NODE_ENV"
value = "production"

[[services.envs]]
name = "PORT"
value = "3000"
```

- [ ] **Step 3: Update `server.ts` to use `process.env.PORT`**

```typescript
const PORT = parseInt(process.env.PORT ?? '3000', 10);
```

- [ ] **Step 4: Commit**

```bash
git add nixpacks.toml railway.toml server.ts
git commit -m "feat(deploy): add Railway config with nixpacks"
```

---

## Task 8: Deploy to Railway and configure domains

> This task is manual — do it in the Railway dashboard.

- [ ] **Step 1: Push branch to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Create Railway project**

1. Go to railway.app → New Project → Deploy from GitHub Repo
2. Select `avalon-the-resistance-presencial`
3. Set environment variables:
   - `GEMINI_API_KEY` = your key
   - `NODE_ENV` = `production`
   - `PORT` = `3000`

- [ ] **Step 3: Add custom domains in Railway**

In the service settings → Custom Domains:
- Add `jogos.deyvyd.com` → set DNS CNAME to Railway's domain
- Add `games.deyvyd.com` → set DNS CNAME to Railway's domain

Both domains point to same service — language is detected client-side from `window.location.hostname`.

- [ ] **Step 4: Add DNS records at your DNS provider**

```
CNAME  jogos.deyvyd.com  →  <railway-domain>.railway.app
CNAME  games.deyvyd.com  →  <railway-domain>.railway.app
```

Railway auto-provisions SSL for both domains.

- [ ] **Step 5: Verify**

Visit `https://jogos.deyvyd.com/avalon` — should show PT UI.
Visit `https://games.deyvyd.com/avalon` — should show EN UI.
Open browser console → check `i18next` initialized with correct language.

---

## Notes

- **Audio files** (`src/assets/audios/`) are PT narration recordings. No EN audio exists. For EN, the game will show text narration but play PT audio — acceptable for now. A future task would record EN narration.
- **Socket.io rooms** are language-agnostic (room IDs, game state). Players from both domains can join the same room — they'll see the UI in their own language.
- **QR codes** generated in-game point to `window.location.origin + '/avalon/room/' + roomId` — this will correctly generate PT or EN links depending on which domain the host is on.
