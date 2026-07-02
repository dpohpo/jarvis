# Reuse Inventory — Phase 2 Output

Locked list of jars to keep in `packages/app/src/` going into Phase 3+ rewrite.
Anything NOT in this list, do not import from new code — it does not exist.

## Stable files (5)

### `client.ts` — Jarvis protocol client
Public methods consumed by the new UI in Phase 14:
- `new JarvisClient(state, callbacks)` — see callback interface below
- `c.start()` / `c.stop()`
- `c.submitCommand(text)` — send a message; on phone, if no current agent
  selected this creates a new agent (GPT-style)
- `c.startVoice()` / `c.endVoice()` / `c.sendVoiceChunk(b64)` — 3-call voice
  sequence; phone owns the recorder (see voice.ts)
- `c.respondPermission(reqId, allow)` — answer a perm request from the daemon
- `c.stopTask()` — cancel the busy task
- `c.requestTaskList()` — pull current task state
- Module-level `pairWithDaemon(pairInfo, label)` → `Promise<PhoneState>`

Plus (added in feature/paseo-* branches, port when daemon protocol updated):
- `c.switchWorkspace(name)` / `c.setWorkspaceConfig(...)`
- `c.requestAgentHistory(id, n)` / `c.agentRename(id, name)`
- `c.agentStop(id)` / `c.deleteAgent(id)`
- `c.requestAgentList()`

Callback interface (passed in constructor):
- `onLink(boolean)` — connection state
- `onTaskEvent(TaskEvent)` — `started|output|progress|tool_use|done|error`
- `onPermRequest(PermRequest)` — interactive approval
- `onAsrFinal(text|null)` — speech-to-text result
- `onTtsReady(chunks, mime, durationMs, expectReply)` — TTS audio
- `onTaskState(Task[])` — current task list

### `voice.ts` — Recorder (Silero VAD + RMS fallback) + TTS playback
- `startCapture({ onChunk(b64), vad: boolean, onAutoEnd() })` → `Promise<boolean>`
  - `vad=true`: stop on silence (uses sherpa-vad module if available)
  - `vad=false`: caller-managed stop
- `stopCapture()` — flush the stream
- `playTtsWav(chunks: string[])` — playback queue, returns when finished

### `wakeword.ts` — STUB (see Phase 14 plan)
Public surface preserved as no-op:
- `isWakeReady() / isListening()`
- `initWake(accessKey, onWake)` / `startListening()` / `pauseListening()` / `destroyWake()`

**Phase 14 action**: port `feature/paseo-pixel-perfect:packages/app/src/wakeword.ts`
(SherpaWake module version) + copy `packages/app/modules/sherpa-wake/` +
`packages/app/modules/sherpa-vad/` from that branch. The sherpa version needs
no AccessKey, runs offline, and bundles the model under
`android/app/src/main/assets/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01/`.

### `store.ts` — PhoneState persistence (SecureStore)
- `loadState(): Promise<PhoneState | null>`
- `saveState(s: PhoneState): Promise<void>`
- `clearState(): Promise<void>`
- `PhoneState` shape: `{ host, port, deviceId, relayUrl, key, seq... }` —
  see client.ts for the source of truth

### `crypto-init.ts` — Crypto bootstrap
- `ensureCrypto()` — call exactly once before instantiating `JarvisClient`
  (sets up `react-native-quick-crypto` shim)

## App.tsx (570 lines) — Jarvis MVP business logic reference

Phase 4 will rewrite App.tsx to ~100 lines (entry only). This 570-line file
is the canonical reference for the legacy business behavior; preserve all
of these behaviors through the rewrite:

### State (kept as stores in Phase 6)
| State | Type | Purpose |
|---|---|---|
| `booted` | boolean | crypto-init done |
| `state` | PhoneState \| null | pairing info; null = not paired |
| `scanning` | boolean | QR scanner active |
| `manualPair` | boolean | manual JSON input mode |
| `manualJson` | string | manual JSON content |
| `pairing` | boolean | pairWithDaemon in flight |
| `linkUp` | boolean | daemon reachable |
| `input` | string | composer text |
| `lines` | LogLine[] | console stream (capped to last 300) |
| `perm` | PermRequest \| null | approval modal payload |
| `recording` | boolean | voice capture active |
| `convMode` | boolean | auto-listen loop on (after TTS, start listening again) |
| `busy` | boolean | task in flight |
| `camPerm` | CameraPermission | from `useCameraPermissions` |

### Refs
- `client` — `JarvisClient | null`
- `scanned` — guard against duplicate `onBarcodeScanned` events
- `pressStart` — mic hold timing
- `recMode` — `"hold" | "tap" | "auto" | null`
- `convModeRef` — mirror of `convMode` for use inside callbacks
- `autoListenTimer` — chained-TTS listener

### Effects
1. **boot** — `ensureCrypto()` then `loadState()`, then `setBooted(true)`.
2. **connect** — when `state` changes: instantiate `JarvisClient`, wire all
   6 callbacks (`onLink`, `onTaskEvent`, `onPermRequest`, `onAsrFinal`,
   `onTtsReady`, `onTaskState`), call `c.start()`, return cleanup `c.stop()`.

### Handlers (move to hooks in Phase 14)
- `onScan(data)` — JSON.parse QR → `pairWithDaemon(info, label)` → `saveState + setState`
- `submit()` — trim → `pushLine("local", text)` → `client.submitCommand(text)` → clear input
- `beginRecording(vad: boolean)` — Android RECORD_AUDIO perm → `client.startVoice()` → `startCapture(...)`
- `finishRecording()` — `stopCapture()` → `client.endVoice()`
- `autoListen()` — `beginRecording(true)` after TTS playback (only if `convMode`)
- `onMicPressIn / onMicPressOut` — hold/tap/auto state machine:
  - pressIn → start in `hold` mode
  - pressOut < 350ms later → switch to `tap` mode (recording continues until next tap)
  - pressOut ≥ 350ms → `hold` finish (send)
  - 2nd tap in `tap` mode → finish
  - tap during `auto` mode → finish immediately

### Render (3 screens)
- `!booted` → ActivityIndicator
- `!state` → PairingScreen:
  - QR scanner (`expo-camera` `CameraView` `barcodeTypes: ["qr"]`)
  - Cancel button
  - Manual JSON input toggle
- else → ConsoleScreen:
  - Header: status dot + daemonDeviceId + 对话/任务/解绑(long press)
  - FlatList of LogLines (monospace, color-coded)
  - Recording banner (when recording)
  - Busy banner (when busy, with stop button)
  - Input row: mic + text input + send
  - PermRequest Modal (deny/approve)

### Status icons / colors (preserve)
- `done` → `#7FD1AE` (绿)
- `running` → ⏵
- `waiting_approval` → 🔐
- `error` → `#E0635C` (红)
- local (user) → `#8FB6E8` (蓝)
- tool_use / progress → `#5B6770` (灰)
- default (assistant) → `#C9D4DC`

## Phase 14 wiring map (new UI → legacy behavior)
| New UI | Calls / Replaces |
|---|---|
| LoginScreen `Pair new server` | `pairWithDaemon` + QR scan block from legacy `!state` |
| Composer send | `submit()` |
| Composer mic (3 modes) | `onMicPressIn/Out` + `beginRecording / finishRecording` |
| SessionPicker | add `client.requestAgentHistory` (port from feature branch) |
| LeftSidebar project menu Rename/Delete | port `agentRename / deleteAgent` |
| PermissionModal | mount globally, bind to `perm` state |
| Wakeword auto-listen | port `wakeword.ts` sherpa version + `autoListen()` chain |

## What was deleted from main during Phase 2 (none)
main was already clean — no Port Agent pollution to remove. The 570-line
App.tsx is the original MVP and is fully kept as the reference for Phase 4
rewrite. Phase 4 will shrink it to ~100 lines.

## Phase 2 acceptance
- [x] src/ contains 5 stable files only
- [x] No paseo-shell.tsx, theme.ts, types.ts (none existed on main)
- [x] No babel.config.js unistyles plugin (none existed on main)
- [x] No unistyles.config.ts (none existed on main)
- [x] No DIAGNOSTIC_MODE / PASEO_MODE (main never had them)
- [x] `pnpm --filter @jarvis/app typecheck` → 0 errors
- [x] App.tsx kept at 570 lines (legacy business reference)
- [x] REUSE.md written (this file)
