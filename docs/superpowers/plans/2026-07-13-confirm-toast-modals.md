# Confirm Modal + Toast System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 10 `alert()`/`window.confirm()` calls with a themed toast (snackbar) for informational errors and a themed confirmation modal for yes/no decisions.

**Architecture:** Two new React Contexts (`ToastContext`, `ConfirmContext`) mounted once at the app root, each backed by a promise-based (confirm) or fire-and-forget (toast) hook. Presentational components (`Toast`, `ConfirmModal`) live in `src/components/ui/` and reuse the existing `Button` component and dark navy/gold theme (`Cinzel` font, `z-modal-elevated`).

**Tech Stack:** React 19, TypeScript, Tailwind v4 (CSS-first `@theme`), `motion/react` for enter/exit animation, `react-i18next` for strings. No component test framework exists in this project (only `vitest` server-integration tests in `tests/`) — verification is `tsc --noEmit` plus a manual browser pass, per the approved design doc.

**Design doc:** `docs/superpowers/specs/2026-07-13-confirm-toast-modals-design.md`

---

## Task 1: i18n — generic confirm/cancel labels

**Files:**
- Modify: `src/i18n/locales/pt.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add `app.common` block to `pt.json`**

Open `src/i18n/locales/pt.json`. Find the line `"app": {` (the very first key inside the `app` object is `"subtitle"`). Insert a new `"common"` key as the first child of `"app"`:

```json
"app": {
    "common": {
      "cancel": "Cancelar",
      "confirm": "Confirmar"
    },
    "subtitle": "Resistência & Traição",
```

- [ ] **Step 2: Add `app.common` block to `en.json`**

Open `src/i18n/locales/en.json`. Same insertion point (first child of `"app"`, right before `"subtitle"`):

```json
"app": {
    "common": {
      "cancel": "Cancel",
      "confirm": "Confirm"
    },
    "subtitle": "Resistance & Betrayal",
```

(Check the exact existing English value of `"subtitle"` in the file before editing — copy it verbatim, don't guess. Only the new `"common"` block is new content.)

- [ ] **Step 3: Verify both files are valid JSON**

Run: `node -e "require('./src/i18n/locales/pt.json'); require('./src/i18n/locales/en.json'); console.log('OK')"`
Expected: `OK` (throws a `SyntaxError` if either file is malformed)

- [ ] **Step 4: Verify the new keys resolve**

Run: `node -e "const pt=require('./src/i18n/locales/pt.json'); const en=require('./src/i18n/locales/en.json'); console.log(pt.app.common.cancel, pt.app.common.confirm, en.app.common.cancel, en.app.common.confirm);"`
Expected: `Cancelar Confirmar Cancel Confirm`

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/pt.json src/i18n/locales/en.json
git commit -m "i18n: add generic confirm/cancel button labels"
```

---

## Task 2: Toast component + ToastContext

**Files:**
- Create: `src/components/ui/Toast.tsx`
- Create: `src/context/ToastContext.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the presentational `Toast` component**

Create `src/components/ui/Toast.tsx`:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

export const Toast = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    className="fixed bottom-4 left-4 right-4 z-modal-elevated flex justify-center pointer-events-none"
  >
    <div
      onClick={onDismiss}
      className="pointer-events-auto max-w-sm w-full bg-[#1b263b] border border-red-500/40 border-l-4 border-l-[#c0392b] rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 cursor-pointer"
    >
      <AlertTriangle size={18} className="text-[#c0392b] shrink-0" />
      <p className="text-sm text-white">{message}</p>
    </div>
  </motion.div>
);
```

- [ ] **Step 2: Create `ToastContext`**

Create `src/context/ToastContext.tsx`:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { Toast } from '../components/ui/Toast';

const TOAST_DURATION_MS = 3500;

interface ToastContextValue {
  error: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setMessage(null);
  }, []);

  // Slot único: nova chamada substitui a mensagem atual e reseta o timer —
  // todos os casos de uso hoje são erros de ação do próprio jogador, nunca
  // dois simultâneos, então não há necessidade de fila.
  const error = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(dismiss, TOAST_DURATION_MS);
  }, [dismiss]);

  const value = useMemo(() => ({ error }), [error]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {message && <Toast message={message} onDismiss={dismiss} />}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};
```

- [ ] **Step 3: Mount `ToastProvider` in `App.tsx`**

Read the current `src/App.tsx` first — it should look like this:

```tsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { SocketContext } from './context/SocketContext';
import { SettingsProvider } from './context/SettingsContext';
import { Home } from './components/lobby/Home';
import { Room } from './components/lobby/Room';

// --- App ---

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin, { path: '/avalon/socket.io' });
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);

  if (!socket) return null;

  return (
    <SocketContext.Provider value={socket}>
      <SettingsProvider>
        <Router basename="/avalon">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:code" element={<Room />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Router>
      </SettingsProvider>
    </SocketContext.Provider>
  );
}
```

Replace it with (adds the `ToastProvider` import, and puts it **outside** `SettingsProvider` — `SettingsContext` will need `useConfirm()` in Task 5, so both new providers must wrap it from the start rather than being nested inside it):

```tsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { SocketContext } from './context/SocketContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { Home } from './components/lobby/Home';
import { Room } from './components/lobby/Room';

// --- App ---

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin, { path: '/avalon/socket.io' });
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);

  if (!socket) return null;

  return (
    <SocketContext.Provider value={socket}>
      <ToastProvider>
        <SettingsProvider>
          <Router basename="/avalon">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/room/:code" element={<Room />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Router>
        </SettingsProvider>
      </ToastProvider>
    </SocketContext.Provider>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found` (the two new files compile; nothing consumes `useToast` yet so no usage errors)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Toast.tsx src/context/ToastContext.tsx src/App.tsx
git commit -m "feat: add Toast component and ToastContext"
```

---

## Task 3: Replace `alert()` calls with `toast.error()`

**Files:**
- Modify: `src/components/lobby/Home.tsx`
- Modify: `src/components/lobby/LobbyView.tsx`
- Modify: `src/components/lobby/Room.tsx`
- Modify: `src/components/game/GameView.tsx`

- [ ] **Step 1: `Home.tsx` — import `useToast` and replace 3 `alert()` calls**

Add the import after the existing `useSettings` import (line 13):

```tsx
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
```

Inside the `Home` component, right after `const { setShowSettings } = useSettings();` (line 24), add:

```tsx
  const toast = useToast();
```

Replace `handleCreate` and `handleJoin` (lines 26-34):

```tsx
  const handleCreate = () => {
    if (!name) return toast.error(t('app.enterNameAlert'));
    socket.emit('create-room', { playerName: name, playerId: getPersistentId() });
  };

  const handleJoin = () => {
    if (!name || !roomCode) return toast.error(t('app.fillNameAndCode'));
    socket.emit('join-room', { roomCode: roomCode.toUpperCase(), playerName: name, playerId: getPersistentId(), sessionToken: getSessionToken(roomCode.toUpperCase()) });
  };
```

Replace the `handleError` inside the `useEffect` (lines 45-46) and add `toast` to the dependency array (line 58):

```tsx
    const handleError = ({ code, message }: { code?: string; message: string }) =>
      toast.error(code ? t(`errors.${code}`, message) : message);
```

```tsx
  }, [socket, navigate, t, toast]);
```

- [ ] **Step 2: `LobbyView.tsx` — import `useToast` and replace `alert()`**

Add the import after the existing `useSettings` import (line 35):

```tsx
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
```

Inside the `LobbyView` component, right after `const { showSettings } = useSettings();` (line 44), add:

```tsx
  const toast = useToast();
```

Replace the guard in `handleStart` (line 109):

```tsx
    if (playerCount < 5) return toast.error(t('app.minPlayers'));
```

- [ ] **Step 3: `Room.tsx` — import `useToast` and replace `alert()` calls**

Add the import after the existing `useSettings` import (line 13):

```tsx
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
```

Inside the `Room` component, right after `const { settings, setShowSettings } = useSettings();` (line 31), add:

```tsx
  const toast = useToast();
```

Replace the `handleError` inside the `useEffect` (line 40):

```tsx
    const handleError = ({ code, message }: { code?: string; message: string }) => {
      toast.error(code ? t(`errors.${code}`, message) : message);
      setIsJoining(false);
      if (code === 'ROOM_NOT_FOUND') navigate('/');
    };
```

Add `toast` to the effect's dependency array (line 70):

```tsx
  }, [socket, navigate, code, t, toast]);
```

Replace the guard in `handleJoin` (line 73):

```tsx
    if (!playerName) return toast.error(t('app.enterNameAlert'));
```

(Task 5 will touch `handleLeave` in this same file — leave it as `window.confirm(...)` for now.)

- [ ] **Step 4: `GameView.tsx` — import `useToast` and replace 2 `alert()` calls**

Add the import after the existing `useSettings` import (line 25):

```tsx
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
```

Inside the `GameView` component, right after `const { showSettings } = useSettings();` (line 34), add:

```tsx
  const toast = useToast();
```

Replace the two guards in `handlePropose` (lines 90 and 92):

```tsx
  const handlePropose = () => {
    const missionIndex = room.targetingEnabled ? targetMissionIndex : room.currentMissionIndex;
    if (missionIndex === null) return toast.error(t('app.selectMission'));
    const missionSize = room.missions[missionIndex].size;
    if (selectedTeam.length !== missionSize) return toast.error(t('app.selectExactPlayers', { count: missionSize }));
    socket.emit('propose-team', { roomCode: room.code, teamPlayerIds: selectedTeam, targetMissionIndex: missionIndex });
  };
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 6: Confirm no `alert(` calls remain in these 4 files**

Run: `grep -n "alert(" src/components/lobby/Home.tsx src/components/lobby/LobbyView.tsx src/components/lobby/Room.tsx src/components/game/GameView.tsx`
Expected: no output (exit code 1 / "no matches")

- [ ] **Step 7: Commit**

```bash
git add src/components/lobby/Home.tsx src/components/lobby/LobbyView.tsx src/components/lobby/Room.tsx src/components/game/GameView.tsx
git commit -m "refactor: replace alert() with toast.error() across lobby and game views"
```

---

## Task 4: ConfirmModal component + ConfirmContext

**Files:**
- Create: `src/components/ui/ConfirmModal.tsx`
- Create: `src/context/ConfirmContext.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the presentational `ConfirmModal` component**

Create `src/components/ui/ConfirmModal.tsx`:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export const ConfirmModal = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-modal-elevated flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d1b2a]/95 border-2 border-[#ffd700] rounded-2xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(255,215,0,0.2)] text-center space-y-4"
      >
        <h3 className="text-lg font-['Cinzel'] font-bold text-[#ffd700]">{title}</h3>
        <p className="text-sm text-gray-300">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {cancelLabel ?? t('app.common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className="flex-1">
            {confirmLabel ?? t('app.common.confirm')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
```

- [ ] **Step 2: Create `ConfirmContext`**

Create `src/context/ConfirmContext.tsx`:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
  return context.confirm;
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [current, setCurrent] = useState<PendingConfirm | null>(null);
  // Fila simples: se um confirm já está visível, o próximo pedido aguarda em
  // vez de sobrepor o modal atual. Não há hoje um fluxo que dispare 2 confirms
  // seguidos, mas isso evita perder um pedido caso aconteça.
  const queueRef = useRef<PendingConfirm[]>([]);
  const showingRef = useRef(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const request: PendingConfirm = { ...options, resolve };
      if (showingRef.current) {
        queueRef.current.push(request);
      } else {
        showingRef.current = true;
        setCurrent(request);
      }
    });
  }, []);

  const resolveCurrent = (value: boolean) => {
    current?.resolve(value);
    const next = queueRef.current.shift() ?? null;
    showingRef.current = next !== null;
    setCurrent(next);
  };

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {current && (
          <ConfirmModal
            title={current.title}
            message={current.message}
            confirmLabel={current.confirmLabel}
            cancelLabel={current.cancelLabel}
            danger={current.danger}
            onConfirm={() => resolveCurrent(true)}
            onCancel={() => resolveCurrent(false)}
          />
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};
```

- [ ] **Step 3: Mount `ConfirmProvider` in `App.tsx`**

Modify `src/App.tsx` — add the import and insert `ConfirmProvider` between `ToastProvider` and `SettingsProvider`. It must stay **outside** `SettingsProvider` (same reason as `ToastProvider` in Task 2: `SettingsContext` will call `useConfirm()` in Task 5). Order relative to `ToastProvider` doesn't matter — they don't depend on each other.

```tsx
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { Home } from './components/lobby/Home';
```

```tsx
      <ToastProvider>
        <ConfirmProvider>
          <SettingsProvider>
            <Router basename="/avalon">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/room/:code" element={<Room />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Router>
          </SettingsProvider>
        </ConfirmProvider>
      </ToastProvider>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ConfirmModal.tsx src/context/ConfirmContext.tsx src/App.tsx
git commit -m "feat: add ConfirmModal component and ConfirmContext"
```

---

## Task 5: Replace `window.confirm()` calls

**Files:**
- Modify: `src/components/lobby/Room.tsx`
- Modify: `src/context/SettingsContext.tsx`

- [ ] **Step 1: `Room.tsx` — import `useConfirm` and make `handleLeave` async**

Add the import next to the `useToast` import added in Task 3:

```tsx
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
```

Inside the `Room` component, right after `const toast = useToast();` (added in Task 3), add:

```tsx
  const confirm = useConfirm();
```

Replace `handleLeave` (currently lines 127-133):

```tsx
  const handleLeave = async () => {
    if (settings.confirmOnLeave) {
      const confirmed = await confirm({
        title: t('app.leaveRoom'),
        message: t('app.confirmLeave'),
        confirmLabel: t('app.leaveRoom'),
        danger: true,
      });
      if (!confirmed) return;
    }
    socket.emit('leave-room', { roomCode: code?.toUpperCase(), playerId: getPersistentId() });
    navigate('/');
  };
```

- [ ] **Step 2: `SettingsContext.tsx` — import `useConfirm` and make `restoreDefaults` async**

Add the import after the existing `useWakeLock` import (line 11):

```tsx
import { useWakeLock } from '../hooks/useWakeLock';
import { useConfirm } from './ConfirmContext';
```

Inside `SettingsProvider`, right after the `const [showSettings, setShowSettings] = useState(false);` line (line 51), add:

```tsx
  const confirm = useConfirm();
```

Replace `restoreDefaults` (currently lines 78-84):

```tsx
  const restoreDefaults = async () => {
    const confirmed = await confirm({
      title: t('app.settings.restoreDefaults'),
      message: t('app.settings.restoreConfirm'),
      confirmLabel: t('app.settings.restoreDefaults'),
      danger: true,
    });
    if (confirmed) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem('avalonSettings', JSON.stringify(DEFAULT_SETTINGS));
      setShowSettings(false);
    }
  };
```

No `App.tsx` change needed here — `ConfirmProvider` already wraps `SettingsProvider` since Task 4 Step 3, so `ConfirmContext` is available.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 4: Confirm no `window.confirm(` or bare `alert(` calls remain anywhere in `src/`**

Run: `grep -rn "window.confirm(\|alert(" src/`
Expected: no output (exit code 1 / "no matches")

- [ ] **Step 5: Commit**

```bash
git add src/components/lobby/Room.tsx src/context/SettingsContext.tsx src/App.tsx
git commit -m "refactor: replace window.confirm() with async confirm() modal"
```

---

## Task 6: Regression check + manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the server integration test suite**

Run: `npx vitest run`
Expected: `PASS (57) FAIL (0)` — this feature touches no server code, so this is a pure regression check.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 3: Start the dev server**

Run: `npm run dev` (leave running)
Expected: `Server running on http://localhost:3000`

- [ ] **Step 4: Manually verify the toast (validation error)**

Open `http://localhost:3000/avalon/` in a browser. Click "Criar Nova Sala" / "Entrar na Sala" without typing a name.
Expected: a red-accented snackbar slides up from the bottom of the screen showing the validation message, then disappears on its own after ~3.5s. No native browser `alert()` dialog appears.

- [ ] **Step 5: Manually verify the confirm modal (leave room)**

Create a room, then click the leave-room icon (top-left of the game header, or the "Sair da Sala" flow from the lobby with "confirm on leave" enabled in Settings — check Settings first to ensure `confirmOnLeave` is on).
Expected: a centered modal appears with a dark backdrop, title, message, "Cancelar" and "Sair da Sala" buttons matching the game's gold/navy theme. Clicking the backdrop or pressing `Esc` dismisses it as if "Cancelar" was clicked (room is not left). Clicking "Sair da Sala" leaves the room. No native browser `confirm()` dialog appears.

- [ ] **Step 6: Manually verify the confirm modal (restore settings)**

Open Settings (gear icon), click "Restaurar Padrões".
Expected: same themed confirm modal appears; confirming resets settings to defaults and closes the Settings modal; cancelling leaves settings untouched.

- [ ] **Step 7: Stop the dev server**

Return to the terminal running `npm run dev` and stop it (Ctrl+C), or if it was started in the background, terminate that process.

No commit for this task — it's verification only. If any step reveals a bug, fix it as part of the relevant earlier task (amend that task's files) and re-run this task's checks before moving on.
