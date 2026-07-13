# Substituir `alert()`/`window.confirm()` por modais e toasts

## Contexto

O jogo usa dialogs nativos do browser em 10 pontos: 2 `window.confirm()`
(sair da sala, restaurar configurações) e 8 `alert()` (erros de servidor e
validação de formulário). São feios, bloqueiam a thread, e destoam do resto
da UI (tema dark navy/dourado, `Cinzel`, `motion/react`).

## Decisões (via brainstorm com mockups visuais)

- **Confirmações** (`window.confirm`) → modal central (não bottom sheet),
  seguindo o padrão visual já usado em `LancelotModal`/`GameGuide`.
- **Avisos/erros** (`alert`) → toast (snackbar) no rodapé, não modal — são
  informativos, não pedem decisão, não devem bloquear o fluxo.
- **Arquitetura**: Context + hook global, promise-based para o confirm
  (`await confirm(...)` — quase 1:1 com `window.confirm`), função direta
  para o toast (`toast.error(...)`).
- **Toast**: slot único, sem fila — novo toast substitui o anterior e
  reseta o timer (~3.5s). Todos os casos atuais são erros disparados por
  ação do próprio jogador; nunca há 2 simultâneos no fluxo real.

## Arquitetura

Dois providers novos, no mesmo padrão de `SettingsContext`/`SocketContext`,
montados em [App.tsx](../../../src/App.tsx) (ordem entre si não importa,
sem dependência mútua):

- **`ConfirmContext`** (`src/context/ConfirmContext.tsx`)
  - Hook `useConfirm()` retorna `confirm(options): Promise<boolean>`.
  - `options: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }`.
  - Provider guarda o request pendente em state; `<ConfirmModal>` só
    renderiza quando há um. Chamadas concorrentes enfileiram (fila
    simples — se já há um pendente, novas chamadas aguardam a resolução
    da anterior antes de abrir).
  - Fechar via backdrop/Esc resolve a Promise como `false`.

- **`ToastContext`** (`src/context/ToastContext.tsx`)
  - Hook `useToast()` retorna `{ error: (message: string) => void }`
    (só `error` por enquanto — é o único tipo usado hoje; `info`/`success`
    ficam de fora até haver caso de uso real, YAGNI).
  - Slot único: nova chamada substitui a mensagem atual e reseta o timer.

## Componentes visuais novos

- **`src/components/ui/ConfirmModal.tsx`**
  - `fixed inset-0 z-modal-elevated flex items-center justify-center bg-black/75 backdrop-blur-sm`
    (usa `z-modal-elevated` de [index.css](../../../src/index.css) — fica
    acima de outros modais, ex. abrir enquanto `SettingsModal` já está aberto).
  - Card: `bg-[#0d1b2a]/95 border-2 border-[#ffd700] rounded-2xl`, mesmo
    tratamento de `LancelotModal`.
  - `motion.div` fade + scale (`initial={{opacity:0,scale:0.95,y:20}}`),
    igual ao padrão existente.
  - Título em `Cinzel`, mensagem em cinza, dois botões (`Button` de
    `ui/Button.tsx`): `variant="secondary"` para cancelar,
    `variant="danger"` (se `danger: true`) ou `variant="primary"` para
    confirmar.

- **`src/components/ui/Toast.tsx`**
  - Fixo no rodapé (`fixed bottom-4 left-4 right-4` ou centralizado com
    `max-w-sm mx-auto`), `z-modal-elevated` também (deve aparecer sobre
    modais abertos, já que os toasts atuais nascem de validação dentro de
    formulários que podem estar num modal).
  - `bg-[#1b263b] border border-red-500/40 border-l-4 border-l-[#c0392b] rounded-xl`,
    ícone de aviso, texto branco pequeno.
  - `motion.div` slide-up + fade, auto-dismiss via `setTimeout` (~3.5s),
    limpo/reiniciado a cada nova chamada.

## Troca nos call-sites

| Arquivo | Contexto | Antes | Depois |
|---|---|---|---|
| [Room.tsx:40](../../../src/components/lobby/Room.tsx) | erro servidor (get-room-info/join) | `alert(...)` | `toast.error(...)` |
| [Room.tsx:73](../../../src/components/lobby/Room.tsx) | nome vazio ao entrar | `alert(...)` | `toast.error(...)` |
| [Room.tsx:129](../../../src/components/lobby/Room.tsx) | sair da sala | `window.confirm(...)` | `if (!(await confirm({ title: t('app.leaveRoom'), message: t('app.confirmLeave'), confirmLabel: t('app.leaveRoom'), danger: true }))) return;` |
| [LobbyView.tsx:109](../../../src/components/lobby/LobbyView.tsx) | menos de 5 jogadores | `alert(...)` | `toast.error(...)` |
| [Home.tsx:27](../../../src/components/lobby/Home.tsx) | nome vazio (criar sala) | `alert(...)` | `toast.error(...)` |
| [Home.tsx:32](../../../src/components/lobby/Home.tsx) | nome/código vazio (entrar) | `alert(...)` | `toast.error(...)` |
| [Home.tsx:46](../../../src/components/lobby/Home.tsx) | erro servidor | `alert(...)` | `toast.error(...)` |
| [SettingsContext.tsx:79](../../../src/context/SettingsContext.tsx) | restaurar config | `window.confirm(...)` | `restoreDefaults` vira `async`; `if (!(await confirm({ title: t('app.settings.restoreDefaults'), message: t('app.settings.restoreConfirm'), confirmLabel: t('app.settings.restoreDefaults'), danger: true }))) return;` |
| [GameView.tsx:90](../../../src/components/game/GameView.tsx) | selecionar missão-alvo | `alert(...)` | `toast.error(...)` |
| [GameView.tsx:92](../../../src/components/game/GameView.tsx) | qtd de jogadores errada | `alert(...)` | `toast.error(...)` |

Todas as strings de mensagem (`t(...)`) já existem e não mudam — só o
mecanismo de exibição.

## i18n — chaves novas

Namespace `app.common` (novo) em `pt.json`/`en.json`:

```json
"common": {
  "cancel": "Cancelar",   // en: "Cancel"
  "confirm": "Confirmar"  // en: "Confirm"
}
```

Usadas como default de `cancelLabel`/`confirmLabel` quando a chamada não
passa um label específico. Os dois usos concretos (sair da sala, restaurar
config) passam `confirmLabel` explícito reaproveitando chaves já
existentes (`app.leaveRoom`, `app.settings.restoreDefaults`).

## Erros / edge cases

- `useConfirm()`/`useToast()` chamados fora do provider → lançam erro
  (mesmo padrão de `useSettings`/`useSocket`).
- Modal fechado sem escolher (backdrop/Esc) → Promise resolve `false`
  (equivalente ao `window.confirm` retornar `false`/cancelar).
- `restoreDefaults` em `SettingsContext` passa a ser `async`; o
  `onClick={onRestore}` em `SettingsModal` já funciona sem alteração
  (React aceita handler async, só não espera o retorno).

## Testes

Sem testes de componente no projeto hoje (só integração de servidor via
socket.io em `tests/`). Verificação manual no browser após implementar:
fluxo de sair da sala (confirmar e cancelar), restaurar configurações
(confirmar e cancelar), e pelo menos 1 toast de validação (nome vazio).

## Fora de escopo

- Toasts de sucesso/info (`toast.success`, `toast.info`) — sem caso de uso
  hoje, adicionar quando surgir necessidade real.
- Fila de múltiplos toasts simultâneos — não há fluxo que dispare 2 ao
  mesmo tempo.
