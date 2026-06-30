/**
 * Jarvis — phone remote for all your computer agents.
 *
 * UI 重做 (Paseo Dark) — single-file deep redesign following Paseo's real
 * design language: 5-layer surface system, teal-green accent, drawer nav,
 * bottom-sheet panels, message bubbles with lightweight markdown.
 *
 * Sections:
 *   §1  Theme tokens (Paseo Dark)
 *   §2  Types
 *   §3  Helpers (status / markdown-lite / formatters)
 *   §4  Hooks (wake / voice / auto-listen)
 *   §5  Pairing screen
 *   §6  Header
 *   §7  Stream (FlatList + bubbles)
 *   §8  Composer (mic + input + send)
 *   §9  Drawer (workspace + toggles + nav)
 *   §10 BottomSheet (memory/settings/history/tasks)
 *   §11 PermissionModal
 *   §12 Styles
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
// RN's KeyboardAvoidingView breaks under Android edge-to-edge (SDK 53+);
// keyboard-controller's drop-in works on both platforms.
import {
  KeyboardAvoidingView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import type {
  PermRequest,
  TaskEvent,
  TaskSummary,
  WorkspaceConfig,
  TmuxPaneInfo,
  EngineInfo,
  AgentInfo,
} from "@jarvis/protocol";
import { ensureCrypto } from "./src/crypto-init";
import { JarvisClient, pairWithDaemon, type PairInfo } from "./src/client";
import { clearState, loadState, saveState, type PhoneState } from "./src/store";
import { playTtsWav, startCapture, stopCapture } from "./src/voice";
import {
  destroyWake,
  initWake,
  pauseListening,
  startListening,
} from "./src/wakeword";

// ============================================================================
// §1  Theme tokens — Paseo design system (teal-green on near-black)
// ============================================================================
// Ported from getpaseo/paseo theme.ts (VERIFIED 2026-06-30 via 3 cross-check
// Explore agents). All tokens live in src/theme.ts so Phase 4 settings can
// switch between 6 paseo themes (dark/zinc/midnight/claude/ghostty/light)
// by swapping one reference. App.tsx reads only C.* / SP / FS / FW / BR / SH,
// same field names as before — zero style-rewrite needed.
//
// Paseo dark default: accent #20744A teal-green on surface0 #181B1A with 5
// surface layers. Field names kept stable so the ~800 lines of styles in §12
// inherit the new palette automatically.
import { DARK, SP as SP_TOK, RD, FS as FS_TOK, FW as FW_TOK, SH as SH_TOK } from "./src/theme";
import { PaseoShell } from "./src/paseo-shell";

const C = DARK;
const SP = SP_TOK;
const FS = FS_TOK;
const FW = FW_TOK;
const BR = RD; // paseo naming is RD; jarvis style code uses BR — alias keeps both working
const SH = SH_TOK;

const SCREEN_WIDTH = Dimensions.get("window").width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 360);

// ============================================================================
// §2  Types
// ============================================================================
type BubbleKind =
  | "user" // 用户输入/本地回显
  | "jarvis" // daemon 回复 (done/output)
  | "task" // 任务事件 (started/done)
  | "tool" // tool_use / progress
  | "error" // error
  | "system"; // 唤醒/状态切换等系统消息

interface Bubble {
  id: string;
  kind: BubbleKind;
  text: string;
  ts: number;
  /** Optional task metadata, used by task-bubble cards. */
  taskId?: string;
  taskTitle?: string;
  taskStatus?: TaskSummary["status"];
  workdir?: string;
}

type SheetKind = "memory" | "settings" | "history" | "tasks" | "agents" | null;

// ============================================================================
// §3  Helpers
// ============================================================================

function statusIcon(s: TaskSummary["status"]): string {
  if (s === "done") return "✓";
  if (s === "running") return "▶";
  if (s === "waiting_approval") return "🔒";
  if (s === "error") return "✕";
  return "⏸";
}

function taskStatusLabel(s: TaskSummary["status"]): string {
  return (
    {
      running: "执行中",
      waiting_approval: "待审",
      paused: "暂停",
      done: "完成",
      error: "失败",
    }[s] ?? s
  );
}

function taskStatusColor(s: TaskSummary["status"]): string {
  if (s === "done") return C.accentBright;
  if (s === "error") return C.destructive;
  if (s === "running") return C.accentBright;
  if (s === "waiting_approval") return C.warn;
  return C.fgSubtle;
}

function historyEvColor(ev: string): string {
  if (ev === "done") return C.accentBright;
  if (ev === "error") return C.destructive;
  if (ev === "tool_use" || ev === "progress") return C.fgSubtle;
  return C.fg;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Status pill for the header — color + short label.
function statusPill(linkUp: boolean, recording: boolean, busy: boolean, wakeOn: boolean): {
  label: string;
  color: string;
} {
  if (recording) return { label: "正在听", color: C.destructive };
  if (busy) return { label: "执行中", color: C.accentBright };
  if (wakeOn) return { label: "待命", color: C.accentBright };
  if (linkUp) return { label: "在线", color: C.accent };
  return { label: "离线", color: C.fgSubtle };
}

const SETTING_LABELS: Record<string, string> = {
  voiceReply: "语音回复任务结果",
  autoWake: "自动开启唤醒",
  conversationMode: "连续对话模式",
  defaultRemindMin: "默认提前提醒(分钟)",
  ttsVoice: "TTS 声音",
};

/**
 * Lightweight markdown renderer — handles **bold**, `inline code`,
 * ```fenced code``` blocks, and - bullet list items.
 * No external dependency; returns an array of React nodes.
 *
 * Why not react-native-markdown? Paseo's chat content is daemon output that
 * already uses inline code / bold for emphasis. A 60-line parser covers 95%
 * of cases without a heavyweight dependency tree.
 */
function renderMarkdownLite(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;
  let inFence = false;
  let fenceBuf: string[] = [];
  let listBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length === 0) return;
    nodes.push(
      <View key={`list-${key++}`} style={styles.mdList}>
        {listBuf.map((item, idx) => (
          <View key={`li-${key++}-${idx}`} style={styles.mdListItem}>
            <Text style={styles.mdBullet}>•</Text>
            <Text style={styles.mdListItemText}>{renderInline(item)}</Text>
          </View>
        ))}
      </View>,
    );
    listBuf = [];
  };

  const flushFence = () => {
    if (fenceBuf.length === 0) return;
    nodes.push(
      <View key={`code-${key++}`} style={styles.mdCodeBlock}>
        <Text style={styles.mdCodeText}>{fenceBuf.join("\n")}</Text>
      </View>,
    );
    fenceBuf = [];
  };

  for (const raw of lines) {
    const line = raw;
    // fenced code block
    if (line.trim().startsWith("```")) {
      if (inFence) {
        flushFence();
        inFence = false;
      } else {
        flushList();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceBuf.push(line);
      continue;
    }
    // bullet list item
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (bulletMatch) {
      listBuf.push(bulletMatch[1] ?? "");
      continue;
    }
    flushList();
    if (line.trim().length === 0) {
      nodes.push(<View key={`sp-${key++}`} style={{ height: SP[1] }} />);
      continue;
    }
    nodes.push(
      <Text key={`p-${key++}`} style={styles.mdParagraph}>
        {renderInline(line)}
      </Text>,
    );
  }
  flushList();
  flushFence();
  return nodes;
}

// Parse **bold** and `code` within a single line.
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  const push = (node: React.ReactNode) => out.push(<Text key={`in-${key++}`}>&nbsp;{node}</Text>);
  // quick hack: strip the leading &nbsp; we accidentally emit
  while (rest.length > 0) {
    // inline code first (shorter span)
    const codeMatch = rest.match(/^`([^`]+)`/);
    if (codeMatch) {
      out.push(
        <Text key={`c-${key++}`} style={styles.mdInlineCode}>
          {codeMatch[1]}
        </Text>,
      );
      rest = rest.slice(codeMatch[0].length);
      continue;
    }
    const boldMatch = rest.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      out.push(
        <Text key={`b-${key++}`} style={styles.mdBold}>
          {boldMatch[1]}
        </Text>,
      );
      rest = rest.slice(boldMatch[0].length);
      continue;
    }
    // take up to next marker
    const nextMarker = rest.search(/[`*]/);
    if (nextMarker === -1) {
      out.push(<Text key={`t-${key++}`}>{rest}</Text>);
      break;
    }
    if (nextMarker === 0) {
      // lone marker char, push as text and skip
      out.push(<Text key={`t-${key++}`}>{rest[0]}</Text>);
      rest = rest.slice(1);
      continue;
    }
    out.push(<Text key={`t-${key++}`}>{rest.slice(0, nextMarker)}</Text>);
    rest = rest.slice(nextMarker);
  }
  return out;
}

// ============================================================================
// §4  Hooks (logic-equivalent to previous inline functions)
// ============================================================================
// Kept inline in Main() for now because they share refs (recMode, convModeRef,
// wakeOnRef, handleWakeRef, autoListenTimer). Extracting them as separate hooks
// would require plumbing many refs through. The structure is documented here
// for readability — see Main() for the actual implementations:
//   - useWakeWord    → toggleWake + auto-enable effect
//   - useVoice       → beginRecording / finishRecording / autoListen
//   - useMicGestures → onMicPressIn / onMicPressOut

// ============================================================================
// Root
// ============================================================================
export default function App() {
  return (
    <KeyboardProvider>
      <Main />
    </KeyboardProvider>
  );
}

function Main() {
  // ---- boot / pairing state ----
  const [booted, setBooted] = useState(false);
  const [state, setState] = useState<PhoneState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualPair, setManualPair] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);

  // ---- console state ----
  const [linkUp, setLinkUp] = useState(false);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<Bubble[]>([]);
  const [perm, setPerm] = useState<PermRequest | null>(null);
  const [recording, setRecording] = useState(false);
  const [convMode, setConvMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wakeOn, setWakeOn] = useState(false);

  // ---- workspace / panels ----
  const [workspaceActive, setWorkspaceActive] = useState("");
  const [workspaceList, setWorkspaceList] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wsPickerOpen, setWsPickerOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  // Workspace config editor (Phase F): which workspace's config is being edited
  const [wsConfigTarget, setWsConfigTarget] = useState<string | null>(null);
  // Per-workspace config map + tmux pane discovery + engine availability
  const [wsConfigs, setWsConfigs] = useState<Record<string, WorkspaceConfig>>({});
  const [tmuxPanes, setTmuxPanes] = useState<TmuxPaneInfo[]>([]);
  const [engines, setEngines] = useState<EngineInfo[]>([]);

  // ---- data from daemon ----
  const [memoryItems, setMemoryItems] = useState<
    Array<{ key: string; value: string; category: string; updatedAt: number }>
  >([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [historyEntries, setHistoryEntries] = useState<
    Array<{ taskId: string; ev: string; data: string; ts: number }>
  >([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  // Phase G — agent registry (multi-session, resumable). Daemon pushes
  // agent.state whenever an agent is created/updated/deleted. The phone
  // uses this list to let the user pick which conversation to resume.
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  // null  → "自由模式"（submit 走 cmd.submit，不绑 agent）
  // string→ 选中的 agent.id，submit 走 agent.message（resume）
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  // Agent currently being renamed (Android only — iOS uses Alert.prompt).
  const [renameTarget, setRenameTarget] = useState<AgentInfo | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const client = useRef<JarvisClient | null>(null);
  const scanned = useRef(false);
  const pressStart = useRef(0);
  const recMode = useRef<"hold" | "tap" | "auto" | null>(null);
  const convModeRef = useRef(false);
  const wakeOnRef = useRef(false);
  const handleWakeRef = useRef<() => void>(() => {});
  const autoListenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const listRef = useRef<FlatList<Bubble>>(null);
  convModeRef.current = convMode;
  wakeOnRef.current = wakeOn;

  const pushLine = useCallback((kind: BubbleKind, text: string, extra?: Partial<Bubble>) => {
    setLines((prev) => [
      ...prev.slice(-300),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        text,
        ts: Date.now(),
        ...extra,
      },
    ]);
  }, []);

  // ---- boot: init crypto, load pairing ----
  useEffect(() => {
    void (async () => {
      await ensureCrypto();
      const s = await loadState();
      setState(s);
      setBooted(true);
    })();
  }, []);

  // ---- connect when paired ----
  useEffect(() => {
    if (!state) return;
    const c = new JarvisClient(state, {
      onLink: setLinkUp,
      onTaskEvent: (e) => {
        if (e.ev === "output" || e.ev === "done") {
          pushLine("jarvis", e.data, { taskId: e.taskId });
        } else if (e.ev === "error") {
          pushLine("error", e.data, { taskId: e.taskId });
        } else if (e.ev === "tool_use") {
          pushLine("tool", `⚙ ${e.data}`, { taskId: e.taskId });
        }
        // NOTE: `progress` events are intentionally NOT pushed to the chat
        // surface. They come from tmux capture-pane (the live TUI renderer)
        // and contain UI decoration — frame lines, status bar, menu prompts,
        // spinner frames — that pollutes the conversation with hundreds of
        // meaningless lines. The structured conversation lives in
        // ~/.claude/projects/<cwd>/<sid>.jsonl and is replayed via
        // onAgentHistory. To see the live TUI verbatim, attach to the tmux
        // session from the desktop app's "终端" button (Ghostty/iTerm2).
        if (e.ev === "started") setBusy(true);
        else if (e.ev === "done" || e.ev === "error") {
          if (!e.taskId.startsWith("chat-")) setBusy(false);
        }
      },
      onPermRequest: setPerm,
      onAsrFinal: (text) =>
        pushLine(text ? "user" : "system", text ? `🎤 ${text}` : "🎤 (没听清)"),
      onTtsReady: (chunks, _mime, durationMs, expectReply) => {
        void playTtsWav(chunks).catch((e) => pushLine("error", `播放失败: ${e}`));
        if (convModeRef.current && expectReply) {
          if (autoListenTimer.current) clearTimeout(autoListenTimer.current);
          autoListenTimer.current = setTimeout(() => {
            void autoListen();
          }, Math.max(durationMs, 500) + 500);
        }
      },
      onTaskState: (newTasks) => {
        setTasks(newTasks);
      },
      onWorkspaceState: (active, workspaces) => {
        setWorkspaceActive(active);
        setWorkspaceList(workspaces);
      },
      onMemoryState: (items) => setMemoryItems(items),
      onSettingsState: (s) => setSettings(s),
      onHistoryState: (entries) => setHistoryEntries(entries),
      onWorkspaceConfigs: (configs) => setWsConfigs(configs),
      onTmuxPanes: (panes) => setTmuxPanes(panes),
      onEngines: (engines) => setEngines(engines),
      onAgentState: (list) => setAgents(list),
      onAgentHistory: (_agentId, entries) => {
        // When user switches to a different conversation, we replay the
        // daemon-side history into the chat surface so they see context.
        // We clear current lines first so the surface feels like the
        // selected conversation, not a mix.
        setLines([]);
        for (const e of entries) {
          pushLine(e.role === "user" ? "user" : "jarvis", e.text);
        }
      },
    });
    client.current = c;
    c.start();
    return () => {
      c.stop();
      client.current = null;
    };
  }, [state, pushLine]);

  const onScan = useCallback(async (data: string) => {
    if (scanned.current) return;
    scanned.current = true;
    setScanning(false);
    setPairing(true);
    setPairError(null);
    try {
      const info = JSON.parse(data) as PairInfo;
      const s = await pairWithDaemon(info, `${Platform.OS}-phone`);
      await saveState(s);
      setState(s);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("[pair] failed:", err.message, err.stack);
      setPairError(`${err.message}\n\n${(err.stack ?? "").slice(0, 400)}`);
    } finally {
      setPairing(false);
      scanned.current = false;
    }
  }, []);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || !client.current) return;
    pushLine("user", text);
    if (selectedAgentId) {
      // Resume the currently-selected conversation.
      client.current.agentMessage(selectedAgentId, text);
    } else {
      // GPT-style: a submit with no conversation selected starts a NEW agent.
      // Generate the id locally so we can setSelectedAgentId immediately
      // (no waiting for the daemon's agent.state push round-trip).
      const newId = `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const title = text.slice(0, 40);
      client.current.createAgent(workspaceActive ?? "", "claude", text, {
        agentId: newId,
        title,
      });
      setSelectedAgentId(newId);
    }
    setInput("");
  }, [input, pushLine, selectedAgentId, workspaceActive]);

  // ---- voice recording helpers (logic-equivalent) ----
  const beginRecording = useCallback(async (vad: boolean) => {
    if (!client.current) return false;
    if (Platform.OS === "android") {
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!,
      );
      if (r !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
    client.current.startVoice();
    const ok = await startCapture({
      onChunk: (b64) => client.current?.sendVoiceChunk(b64),
      vad,
      onAutoEnd: () => {
        recMode.current = null;
        setRecording(false);
        client.current?.endVoice();
        if (wakeOnRef.current) void startListening();
      },
    });
    if (ok) setRecording(true);
    return ok;
  }, []);

  const finishRecording = useCallback(async () => {
    recMode.current = null;
    setRecording(false);
    await stopCapture();
    client.current?.endVoice();
    if (wakeOnRef.current) void startListening();
  }, []);

  const autoListen = useCallback(async () => {
    if (recMode.current !== null) return;
    recMode.current = "auto";
    const ok = await beginRecording(true);
    if (!ok) recMode.current = null;
  }, [beginRecording]);

  // ---- wake-word handler ----
  const handleWake = useCallback(() => {
    pushLine("system", "🤖 我在，请说…");
    if (wakeOnRef.current) void autoListen();
  }, [autoListen, pushLine]);
  handleWakeRef.current = handleWake;

  // ---- auto-enable wake-word once paired & link up ----
  useEffect(() => {
    if (!state || !linkUp) return;
    if (wakeOnRef.current) return;
    if (Platform.OS !== "android") return;
    void (async () => {
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!,
      );
      if (r !== PermissionsAndroid.RESULTS.GRANTED) {
        pushLine("error", "自动唤醒需要麦克风权限，点'唤醒'按钮重试");
        return;
      }
      const ok = await initWake(() => handleWakeRef.current());
      if (ok) {
        const started = await startListening();
        if (started) {
          setWakeOn(true);
          pushLine("system", "🔔 已自动开启唤醒 — 喊 \"Jarvis\" 或 \"Alexa\"");
        }
      }
    })();
  }, [state, linkUp, pushLine]);

  const toggleWake = useCallback(async () => {
    if (wakeOn) {
      await pauseListening();
      await destroyWake();
      setWakeOn(false);
      pushLine("system", "🔕 唤醒关闭");
      return;
    }
    if (Platform.OS === "android") {
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!,
      );
      if (r !== PermissionsAndroid.RESULTS.GRANTED) {
        pushLine("error", "需要麦克风权限才能监听唤醒词");
        return;
      }
    }
    pushLine("system", "⏳ 加载唤醒词模型…");
    const ok = await initWake(handleWake);
    if (!ok) {
      pushLine("error", "唤醒词模型加载失败 (看 logcat: SherpaWake tag)");
      return;
    }
    const started = await startListening();
    setWakeOn(started);
    if (started) pushLine("system", "🔔 唤醒开启 — 喊 \"Jarvis\"");
  }, [wakeOn, handleWake, pushLine]);

  // unmount cleanup: tear down KWS so AudioRecord doesn't leak
  useEffect(() => {
    return () => {
      if (wakeOnRef.current) void destroyWake();
    };
  }, []);

  // ---- mic gestures (hold / tap / tap-again-to-end) ----
  const onMicPressIn = useCallback(async () => {
    if (recording && recMode.current === "tap") {
      await finishRecording();
      return;
    }
    if (recording && recMode.current === "auto") {
      await finishRecording();
      return;
    }
    pressStart.current = Date.now();
    recMode.current = "hold";
    await beginRecording(false);
  }, [recording, beginRecording, finishRecording]);

  const onMicPressOut = useCallback(async () => {
    if (!recording && recMode.current === null) return;
    if (Date.now() - pressStart.current < 350) {
      recMode.current = "tap";
      return;
    }
    if (recMode.current === "hold") await finishRecording();
  }, [recording, finishRecording]);

  // ---- drawer open/close animation ----
  useEffect(() => {
    Animated.spring(drawerAnim, {
      toValue: drawerOpen ? 0 : -DRAWER_WIDTH,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [drawerOpen, drawerAnim]);

  // ---- unpair ----
  const unpair = useCallback(async () => {
    await clearState();
    setState(null);
    setLines([]);
    setDrawerOpen(false);
    setSheet(null);
    setWorkspaceActive("");
    setWorkspaceList([]);
    setMemoryItems([]);
    setSettings({});
    setHistoryEntries([]);
    setTasks([]);
    setAgents([]);
    setSelectedAgentId(null);
  }, []);

  // ---- open a sheet, requesting fresh data ----
  const openSheet = useCallback((kind: Exclude<SheetKind, null>) => {
    setDrawerOpen(false);
    setSheet(kind);
    if (kind === "memory") client.current?.requestMemoryList();
    if (kind === "settings") client.current?.requestSettings();
    if (kind === "history") client.current?.requestHistory();
    if (kind === "tasks") client.current?.requestTaskList();
    if (kind === "agents") client.current?.requestAgentList();
  }, []);

  // ---- early returns ----
  if (!booted) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator color={C.accentBright} size="large" />
      </View>
    );
  }

  // ---------- §5 pairing screen ----------
  if (!state) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="light" />
        {scanning && camPerm?.granted ? (
          <View style={styles.scannerBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={(r) => void onScan(r.data)}
            />
            <View style={styles.scanOverlay} pointerEvents="none">
              <View style={styles.scanFrame} />
            </View>
            <Pressable style={styles.cancelScan} onPress={() => setScanning(false)}>
              <Text style={styles.cancelScanText}>取消</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.pairContent} keyboardShouldPersistTaps="handled">
            <View style={styles.pairLogo}>
              <Text style={styles.pairLogoEmoji}>🤖</Text>
            </View>
            <Text style={styles.pairTitle}>Jarvis</Text>
            <Text style={styles.pairSubtitle}>
              在 Mac 上运行{"\n"}
              <Text style={styles.pairMono}>pnpm --filter @jarvis/daemon pair</Text>
              {"\n"}然后扫描二维码
            </Text>
            {pairing ? (
              <View style={styles.pairLoadingCard}>
                <ActivityIndicator color={C.accentBright} />
                <Text style={styles.pairLoadingText}>正在配对…</Text>
              </View>
            ) : manualPair ? (
              <View style={{ width: "100%", marginTop: SP[6] }}>
                <TextInput
                  style={styles.pairManualInput}
                  value={manualJson}
                  onChangeText={setManualJson}
                  placeholder='粘贴配对 JSON（{"relayUrl":...}）'
                  placeholderTextColor={C.fgSubtle}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.pairRow}>
                  <Pressable
                    style={[styles.btnGhost, styles.btnFlex]}
                    onPress={() => setManualPair(false)}
                  >
                    <Text style={styles.btnGhostText}>返回</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnPrimary, styles.btnFlex]}
                    onPress={() => void onScan(manualJson.trim())}
                  >
                    <Text style={styles.btnPrimaryText}>配对</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.pairActions}>
                <Pressable
                  style={styles.btnPrimary}
                  onPress={async () => {
                    if (!camPerm?.granted) {
                      const r = await requestCamPerm();
                      if (!r.granted) return;
                    }
                    scanned.current = false;
                    setScanning(true);
                  }}
                >
                  <Text style={styles.btnPrimaryText}>扫码配对</Text>
                </Pressable>
                <Pressable onPress={() => setManualPair(true)}>
                  <Text style={styles.pairManualLink}>手动输入配对信息</Text>
                </Pressable>
              </View>
            )}
            {pairError && (
              <View style={styles.pairErrorCard}>
                <Text style={styles.pairErrorTitle}>配对失败</Text>
                <Text style={styles.pairErrorDetail}>{pairError}</Text>
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => setPairError(null)}
                >
                  <Text style={styles.btnGhostText}>关闭</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  // ---------- §6-§11 console screen ----------
  const pill = statusPill(linkUp, recording, busy, wakeOn);

  // Paseo UI mode — wraps jarvis state in paseo-style shell.
  // Toggle PASEO_MODE=false to fall back to legacy single-file UI.
  const PASEO_MODE = true;
  if (PASEO_MODE) {
    return (
      <>
        <StatusBar style="light" />
        <PaseoShell
          lines={lines as any}
          busy={busy}
          workspaceActive={workspaceActive}
          workspaceList={workspaceList}
          onSwitchWorkspace={(name) => client.current?.switchWorkspace(name)}
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={(id) => {
            setSelectedAgentId(id);
            if (id) client.current?.requestAgentHistory(id, 50);
          }}
          onDeleteAgent={(id) => client.current?.deleteAgent(id)}
          onRenameAgent={(agent, t) => client.current?.agentRename(agent.id, t)}
          onStopAgent={(id) => client.current?.agentStop(id)}
          input={input}
          onChangeInput={setInput}
          onSubmit={() => submit()}
          recording={recording}
          onToggleRecording={() => {
            if (recording) void finishRecording();
            else void beginRecording(false);
          }}
          hostName="Poincare Mac"
          linkUp={linkUp}
          onOpenSettings={() => setSheet("settings")}
          renderBubble={(b) => <BubbleView bubble={b as any} />}
        />
        {/* Permission modal stays mounted so the paseo shell can trigger it
            via setPerm without losing the screen. */}
        <Modal visible={perm !== null} transparent animationType="fade" onRequestClose={() => setPerm(null)}>
          <View style={styles.backdropCenter}>
            <View style={styles.permCard}>
              <Text style={styles.permTitle}>Tier {perm?.tier} 操作审批</Text>
              <Text style={styles.permSummary}>{perm?.summary}</Text>
              <View style={styles.permRow}>
                <Pressable
                  style={styles.permBtnDeny}
                  onPress={() => {
                    if (perm) client.current?.respondPermission(perm.reqId, false);
                    setPerm(null);
                  }}
                >
                  <Text style={styles.permBtnDenyText}>拒绝</Text>
                </Pressable>
                <Pressable
                  style={styles.permBtnApprove}
                  onPress={() => {
                    if (perm) client.current?.respondPermission(perm.reqId, true);
                    setPerm(null);
                  }}
                >
                  <Text style={styles.permBtnApproveText}>批准</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <StatusBar style="light" />

      {/* §6 Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerMenuBtn} onPress={() => setDrawerOpen(true)}>
          <Text style={styles.headerMenuIcon}>☰</Text>
        </Pressable>
        <View style={styles.headerStatusWrap}>
          <View style={[styles.statusDot, { backgroundColor: pill.color }]} />
          <Text style={[styles.headerStatusLabel, { color: pill.color }]}>
            {pill.label}
          </Text>
        </View>
        {/* "✚ New conversation" — clears selectedAgentId + chat surface so the
            next submit creates a fresh agent (GPT-style). Always visible so
            the user can fork a new chat without diving into the drawer. */}
        <Pressable
          style={[styles.headerWsBtn, { paddingHorizontal: 10, opacity: selectedAgentId ? 1 : 0.4 }]}
          onPress={() => {
            if (!selectedAgentId) return;
            setSelectedAgentId(null);
            setLines([]);
            pushLine("system", "✚ 新对话已就绪 — 下条消息会创建新会话");
          }}
        >
          <Text style={styles.headerWsIcon}>✚</Text>
        </Pressable>
        <Pressable
          style={styles.headerWsBtn}
          onPress={() => {
            client.current?.requestWorkspaceList();
            setWsPickerOpen(true);
          }}
        >
          <Text style={styles.headerWsIcon}>📁</Text>
          <Text style={styles.headerWsText} numberOfLines={1}>
            {workspaceActive || "主目录"}
          </Text>
          <Text style={styles.headerWsCaret}>▾</Text>
        </Pressable>
      </View>

      {/* §7 Stream */}
      <FlatList
        ref={listRef}
        style={styles.stream}
        data={lines}
        keyExtractor={(l) => l.id}
        onContentSizeChange={() => {
          if (lines.length > 0) {
            listRef.current?.scrollToEnd({ animated: true });
          }
        }}
        contentContainerStyle={styles.streamContent}
        renderItem={({ item }) => <BubbleView bubble={item} />}
      />

      {/* Recording / busy banner (above input) */}
      {(recording || busy) && (
        <View style={[styles.banner, recording ? styles.bannerRecording : styles.bannerBusy]}>
          {recording ? (
            <>
              <PulseDot color={C.destructive} />
              <Text style={[styles.bannerText, { color: C.destructive, flex: 1 }]}>
                {recMode.current === "auto"
                  ? "聆听中 — 说完停顿约 1 秒自动发送（按麦克风立即结束）"
                  : recMode.current === "tap"
                    ? "录音中 — 再按一下麦克风结束"
                    : "录音中 — 松开发送"}
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="small" color={C.accentBright} />
              <Text style={[styles.bannerText, { color: C.accentBright, flex: 1 }]}>
                任务执行中…
              </Text>
              <Pressable
                style={styles.stopBtn}
                onPress={() => {
                  client.current?.stopTask();
                  setBusy(false);
                  pushLine("system", "🛑 已发送停止");
                }}
              >
                <Text style={styles.stopBtnText}>⏹ 停止</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* §8 Composer */}
      {selectedAgentId && (
        <View style={styles.agentChipRow}>
          <Text style={styles.agentEngineBadge}>
            {agents.find((a) => a.id === selectedAgentId)?.engine === "codex" ? "Cx" : "Cl"}
          </Text>
          <Text style={styles.agentChipText} numberOfLines={1}>
            → {(agents.find((a) => a.id === selectedAgentId)?.title || "(无标题)").slice(0, 50)}
          </Text>
          <Pressable onPress={() => setSelectedAgentId(null)}>
            <Text style={styles.agentChipClear}>✕ 退出 resume</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.composer}>
        <Pressable
          style={[styles.micBtn, recording && styles.micBtnActive]}
          onPressIn={() => void onMicPressIn()}
          onPressOut={() => void onMicPressOut()}
        >
          <Text style={styles.micIcon}>{recording ? "■" : "🎙"}</Text>
        </Pressable>
        <TextInput
          style={styles.composerInput}
          value={input}
          onChangeText={setInput}
          placeholder={
            selectedAgentId
              ? "接着这个会话说…"
              : "对 Jarvis 说点什么…"
          }
          placeholderTextColor={C.fgSubtle}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={submit}>
          <Text style={styles.sendBtnText}>↑</Text>
        </Pressable>
      </View>

      {/* §9 Drawer (left slide-out) */}
      <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={() => setDrawerOpen(false)}>
        <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)}>
          <Animated.View
            style={[styles.drawerPanel, { width: DRAWER_WIDTH, transform: [{ translateX: drawerAnim }] }]}
            onStartShouldSetResponder={() => true}
          >
            <DrawerContent
              linkUp={linkUp}
              wakeOn={wakeOn}
              convMode={convMode}
              workspaceActive={workspaceActive}
              workspaceList={workspaceList}
              wsConfigs={wsConfigs}
              pill={pill}
              onToggleWake={() => void toggleWake()}
              onToggleConv={() => setConvMode((v) => !v)}
              onSwitchWorkspace={(ws) => {
                client.current?.switchWorkspace(ws);
                setDrawerOpen(false);
              }}
              onEditWorkspaceConfig={(ws) => {
                setWsConfigTarget(ws);
                client.current?.requestTmuxPanes();
                client.current?.requestEngines();
                setDrawerOpen(false);
              }}
              onOpenSheet={openSheet}
              onUnpair={() => void unpair()}
              onClose={() => setDrawerOpen(false)}
            />
          </Animated.View>
        </Pressable>
      </Modal>

      {/* §F Workspace config editor (mode/engine/tmuxTarget) */}
      <WorkspaceConfigSheet
        target={wsConfigTarget}
        config={wsConfigTarget ? (wsConfigs[wsConfigTarget] ?? { mode: "spawn", engine: "claude" }) : null}
        tmuxPanes={tmuxPanes}
        engines={engines}
        onClose={() => setWsConfigTarget(null)}
        onSave={(ws, cfg) => {
          client.current?.setWorkspaceConfig(ws, cfg);
        }}
        onRescanPanes={() => client.current?.requestTmuxPanes()}
      />

      {/* Workspace picker (compact bottom sheet for ws switch) */}
      <Modal visible={wsPickerOpen} transparent animationType="slide" onRequestClose={() => setWsPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setWsPickerOpen(false)}>
          <View style={styles.wsSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>切换工作空间</Text>
            <Text style={styles.sheetSubtitle}>
              当前: {workspaceActive || "主目录"}{"\n"}每个工作空间 = 独立 Claude Code 会话
            </Text>
            <ScrollView style={{ maxHeight: 380 }}>
              <Pressable
                style={[styles.wsRow, workspaceActive === "" && styles.wsRowActive]}
                onPress={() => {
                  client.current?.switchWorkspace("");
                  setWsPickerOpen(false);
                }}
              >
                <Text style={styles.wsRowIcon}>🏠</Text>
                <Text style={[styles.wsRowLabel, workspaceActive === "" && styles.wsRowLabelActive]}>
                  主目录
                </Text>
                {workspaceActive === "" && <Text style={styles.wsRowCheck}>✓</Text>}
              </Pressable>
              {workspaceList.map((ws) => (
                <Pressable
                  key={ws}
                  style={[styles.wsRow, workspaceActive === ws && styles.wsRowActive]}
                  onPress={() => {
                    client.current?.switchWorkspace(ws);
                    setWsPickerOpen(false);
                  }}
                >
                  <Text style={styles.wsRowIcon}>📁</Text>
                  <Text style={[styles.wsRowLabel, workspaceActive === ws && styles.wsRowLabelActive]}>
                    {ws}
                  </Text>
                  {workspaceActive === ws && <Text style={styles.wsRowCheck}>✓</Text>}
                </Pressable>
              ))}
              {workspaceList.length === 0 && (
                <Text style={styles.wsEmpty}>(空列表 — 等 daemon 推送)</Text>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* §10 BottomSheet — Memory / Settings / History / Tasks / Agents */}
      <BottomSheet
        kind={sheet}
        tasks={tasks}
        memoryItems={memoryItems}
        settings={settings}
        historyEntries={historyEntries}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onClose={() => setSheet(null)}
        onDeleteMemory={(key) => client.current?.deleteMemory(key)}
        onSetSetting={(k, v) => client.current?.setSetting(k, v)}
        onSelectAgent={(id) => {
          setSelectedAgentId(id);
          // Pull agent history when user selects one so the chat surface
          // shows the prior conversation before they type.
          if (id) client.current?.requestAgentHistory(id, 50);
          setSheet(null);
        }}
        onDeleteAgent={(id) => {
          client.current?.deleteAgent(id);
          if (selectedAgentId === id) setSelectedAgentId(null);
        }}
        onStopAgent={(id) => client.current?.agentStop(id)}
        onRenameAgent={(agent) => {
          // Long-press → rename. Alert.prompt is iOS-only; on Android we fall
          // back to window.prompt via a TextInput Modal (setRenameTarget).
          if (Platform.OS === "ios") {
            Alert.prompt(
              "重命名会话",
              `改 "${agent.title || "(无标题)"}" 的标题`,
              (newTitle) => {
                const t = newTitle?.trim();
                if (t) client.current?.agentRename(agent.id, t);
              },
              undefined,
              agent.title || "",
            );
          } else {
            setRenameValue(agent.title || "");
            setRenameTarget(agent);
          }
        }}
      />

      {/* §11 PermissionModal */}
      <Modal visible={perm !== null} transparent animationType="fade" onRequestClose={() => setPerm(null)}>
        <View style={styles.backdropCenter}>
          <View style={styles.permCard}>
            <View style={styles.permHeader}>
              <Text style={styles.permIcon}>🔐</Text>
              <Text style={styles.permTitle}>Tier {perm?.tier} 操作审批</Text>
            </View>
            <Text style={styles.permSummary}>{perm?.summary}</Text>
            {perm?.detail ? <Text style={styles.permDetail}>{perm.detail}</Text> : null}
            <View style={styles.permRow}>
              <Pressable
                style={styles.permBtnDeny}
                onPress={() => {
                  if (perm) client.current?.respondPermission(perm.reqId, false);
                  setPerm(null);
                }}
              >
                <Text style={styles.permBtnDenyText}>拒绝</Text>
              </Pressable>
              <Pressable
                style={styles.permBtnApprove}
                onPress={() => {
                  if (perm) client.current?.respondPermission(perm.reqId, true);
                  setPerm(null);
                }}
              >
                <Text style={styles.permBtnApproveText}>批准</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename agent modal — Android fallback for iOS Alert.prompt. */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View style={styles.backdropCenter}>
          <View style={styles.permCard}>
            <View style={styles.permHeader}>
              <Text style={styles.permIcon}>✏️</Text>
              <Text style={styles.permTitle}>重命名会话</Text>
            </View>
            <TextInput
              style={{
                backgroundColor: "#0B0F14",
                color: C.fg,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginVertical: 12,
                fontSize: 15,
                borderWidth: 1,
                borderColor: C.border,
              }}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder={renameTarget?.title || "新标题"}
              placeholderTextColor={C.fgSubtle}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.permRow}>
              <Pressable
                style={styles.permBtnDeny}
                onPress={() => setRenameTarget(null)}
              >
                <Text style={styles.permBtnDenyText}>取消</Text>
              </Pressable>
              <Pressable
                style={styles.permBtnApprove}
                onPress={() => {
                  const t = renameValue.trim();
                  if (t && renameTarget) client.current?.agentRename(renameTarget.id, t);
                  setRenameTarget(null);
                  setRenameValue("");
                }}
              >
                <Text style={styles.permBtnApproveText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// §7 Stream — single bubble renderer
// ============================================================================
function BubbleView({ bubble }: { bubble: Bubble }) {
  switch (bubble.kind) {
    case "user":
      return (
        <View style={styles.rowRight}>
          <View style={styles.bubbleUser}>
            <Text style={styles.bubbleUserText}>{bubble.text}</Text>
          </View>
        </View>
      );
    case "jarvis":
      return (
        <View style={styles.rowLeft}>
          <View style={styles.bubbleJarvis}>{renderMarkdownLite(bubble.text)}</View>
        </View>
      );
    case "tool":
      return (
        <View style={styles.rowLeft}>
          <View style={styles.bubbleTool}>
            <Text style={styles.bubbleToolText}>{bubble.text}</Text>
          </View>
        </View>
      );
    case "error":
      return (
        <View style={styles.rowLeft}>
          <View style={styles.bubbleError}>
            <Text style={styles.bubbleErrorText}>{bubble.text}</Text>
          </View>
        </View>
      );
    case "system":
      return (
        <View style={styles.rowCenter}>
          <View style={styles.bubbleSystem}>
            <Text style={styles.bubbleSystemText}>{bubble.text}</Text>
          </View>
        </View>
      );
    default:
      return null;
  }
}

// ============================================================================
// Pulse dot — small animated indicator for the recording banner
// ============================================================================
function PulseDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View style={[styles.pulseDot, { backgroundColor: color, opacity }]} />
  );
}

// ============================================================================
// §9 Drawer content
// ============================================================================
function DrawerContent(props: {
  linkUp: boolean;
  wakeOn: boolean;
  convMode: boolean;
  workspaceActive: string;
  workspaceList: string[];
  wsConfigs: Record<string, WorkspaceConfig>;
  pill: { label: string; color: string };
  onToggleWake: () => void;
  onToggleConv: () => void;
  onSwitchWorkspace: (ws: string) => void;
  onEditWorkspaceConfig: (ws: string) => void;
  onOpenSheet: (kind: Exclude<SheetKind, null>) => void;
  onUnpair: () => void;
  onClose: () => void;
}) {
  // Render a compact "engine·mode" tag for a workspace.
  const renderTag = (ws: string) => {
    const cfg = props.wsConfigs[ws];
    if (!cfg) return null;
    const engineLabel = cfg.engine === "codex" ? "codex" : "claude";
    const modeLabel = cfg.mode === "tmux" ? "tmux" : "spawn";
    return (
      <View
        style={[
          styles.wsTag,
          cfg.engine === "codex" ? styles.wsTagCodex : styles.wsTagClaude,
        ]}
      >
        <Text style={styles.wsTagText}>{engineLabel}·{modeLabel}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerBrand}>🤖 Jarvis</Text>
        <View style={styles.drawerStatusRow}>
          <View style={[styles.statusDot, { backgroundColor: props.pill.color }]} />
          <Text style={[styles.drawerStatusLabel, { color: props.pill.color }]}>
            {props.pill.label}
          </Text>
        </View>
      </View>

      {/* Workspace section */}
      <Text style={styles.drawerSectionLabel}>工作空间</Text>
      <Pressable
        style={[styles.drawerItem, props.workspaceActive === "" && styles.drawerItemActive]}
        onPress={() => props.onSwitchWorkspace("")}
      >
        <Text style={styles.drawerItemIcon}>🏠</Text>
        <Text style={styles.drawerItemLabel}>主目录</Text>
        {props.workspaceActive === "" && <Text style={styles.drawerItemCheck}>✓</Text>}
      </Pressable>
      {props.workspaceList.map((ws) => (
        <View
          key={ws}
          style={[
            styles.drawerItemRow,
            props.workspaceActive === ws && styles.drawerItemActive,
          ]}
        >
          <Pressable
            style={styles.drawerItemLeft}
            onPress={() => props.onSwitchWorkspace(ws)}
          >
            <Text style={styles.drawerItemIcon}>📁</Text>
            <Text style={styles.drawerItemLabel}>{ws}</Text>
            {props.workspaceActive === ws && (
              <Text style={styles.drawerItemCheck}>✓</Text>
            )}
          </Pressable>
          {renderTag(ws)}
          <Pressable
            style={styles.drawerItemConfigBtn}
            onPress={() => props.onEditWorkspaceConfig(ws)}
          >
            <Text style={styles.drawerItemConfigIcon}>⚙</Text>
          </Pressable>
        </View>
      ))}

      {/* Mode toggles */}
      <Text style={styles.drawerSectionLabel}>模式</Text>
      <Pressable style={styles.drawerItem} onPress={props.onToggleWake}>
        <Text style={styles.drawerItemIcon}>🔔</Text>
        <Text style={styles.drawerItemLabel}>唤醒</Text>
        <Text style={[styles.drawerItemToggle, props.wakeOn && styles.drawerItemToggleOn]}>
          {props.wakeOn ? "开" : "关"}
        </Text>
      </Pressable>
      <Pressable style={styles.drawerItem} onPress={props.onToggleConv}>
        <Text style={styles.drawerItemIcon}>💬</Text>
        <Text style={styles.drawerItemLabel}>对话</Text>
        <Text style={[styles.drawerItemToggle, props.convMode && styles.drawerItemToggleOn]}>
          {props.convMode ? "开" : "关"}
        </Text>
      </Pressable>

      {/* Nav */}
      <Text style={styles.drawerSectionLabel}>导航</Text>
      <Pressable style={styles.drawerItem} onPress={() => props.onOpenSheet("agents")}>
        <Text style={styles.drawerItemIcon}>💬</Text>
        <Text style={styles.drawerItemLabel}>会话</Text>
        <Text style={styles.drawerItemCaret}>→</Text>
      </Pressable>
      <Pressable style={styles.drawerItem} onPress={() => props.onOpenSheet("tasks")}>
        <Text style={styles.drawerItemIcon}>📋</Text>
        <Text style={styles.drawerItemLabel}>任务</Text>
        <Text style={styles.drawerItemCaret}>→</Text>
      </Pressable>
      <Pressable style={styles.drawerItem} onPress={() => props.onOpenSheet("memory")}>
        <Text style={styles.drawerItemIcon}>🧠</Text>
        <Text style={styles.drawerItemLabel}>记忆</Text>
        <Text style={styles.drawerItemCaret}>→</Text>
      </Pressable>
      <Pressable style={styles.drawerItem} onPress={() => props.onOpenSheet("settings")}>
        <Text style={styles.drawerItemIcon}>⚙️</Text>
        <Text style={styles.drawerItemLabel}>设置</Text>
        <Text style={styles.drawerItemCaret}>→</Text>
      </Pressable>
      <Pressable style={styles.drawerItem} onPress={() => props.onOpenSheet("history")}>
        <Text style={styles.drawerItemIcon}>📜</Text>
        <Text style={styles.drawerItemLabel}>历史</Text>
        <Text style={styles.drawerItemCaret}>→</Text>
      </Pressable>

      {/* Danger zone */}
      <View style={{ height: SP[8] }} />
      <Pressable style={[styles.drawerItem, styles.drawerItemDanger]} onPress={props.onUnpair}>
        <Text style={styles.drawerItemIcon}>⚠️</Text>
        <Text style={[styles.drawerItemLabel, { color: C.destructive }]}>取消配对</Text>
      </Pressable>
      <View style={{ height: SP[4] }} />
    </ScrollView>
  );
}

// ============================================================================
// §F WorkspaceConfigSheet — mode/engine/tmuxTarget editor
// ============================================================================
function WorkspaceConfigSheet(props: {
  target: string | null;
  config: WorkspaceConfig | null;
  tmuxPanes: TmuxPaneInfo[];
  engines: EngineInfo[];
  onClose: () => void;
  onSave: (ws: string, cfg: WorkspaceConfig) => void;
  onRescanPanes: () => void;
}) {
  const { target, config } = props;
  // Local editable copy — initialized from daemon-side config, saved on change.
  const [mode, setMode] = useState<"spawn" | "tmux">("spawn");
  const [engine, setEngine] = useState<"claude" | "codex">("claude");
  const [tmuxTarget, setTmuxTarget] = useState<string>("");

  // Sync local state when target/config changes (open or daemon pushes update).
  useEffect(() => {
    if (config) {
      setMode(config.mode);
      setEngine(config.engine);
      setTmuxTarget(config.tmuxTarget ?? "");
    }
  }, [target, config]);

  const engineInfo = (e: "claude" | "codex") =>
    props.engines.find((ei) => ei.engine === e);

  const persist = (patch: Partial<WorkspaceConfig>) => {
    if (!target) return;
    const next: WorkspaceConfig = {
      mode: patch.mode ?? mode,
      engine: patch.engine ?? engine,
      ...(patch.tmuxTarget !== undefined
        ? patch.tmuxTarget
          ? { tmuxTarget: patch.tmuxTarget }
          : {}
        : tmuxTarget
          ? { tmuxTarget }
          : {}),
      ...(config?.sessionId ? { sessionId: config.sessionId } : {}),
    };
    props.onSave(target, next);
  };

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>工作空间配置</Text>
            <Pressable style={styles.sheetCloseBtn} onPress={props.onClose}>
              <Text style={styles.sheetCloseIcon}>✕</Text>
            </Pressable>
          </View>

          {target && (
            <ScrollView style={styles.sheetBody} contentContainerStyle={{ paddingBottom: SP[8] }}>
              <Text style={styles.wsCfgTargetName}>📁 {target}</Text>

              {/* Engine segmented control */}
              <Text style={styles.wsCfgLabel}>引擎</Text>
              <View style={styles.segmentedRow}>
                {(["claude", "codex"] as const).map((e) => {
                  const info = engineInfo(e);
                  const disabled = !info?.installed || !info?.loggedIn;
                  return (
                    <Pressable
                      key={e}
                      style={[
                        styles.segmentedBtn,
                        engine === e && styles.segmentedBtnActive,
                        disabled && styles.segmentedBtnDisabled,
                      ]}
                      disabled={disabled}
                      onPress={() => {
                        setEngine(e);
                        persist({ engine: e });
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentedBtnText,
                          engine === e && styles.segmentedBtnTextActive,
                        ]}
                      >
                        {e === "claude" ? "Claude" : "Codex"}
                      </Text>
                      <Text style={styles.segmentedBtnSub}>
                        {!info?.installed
                          ? "未安装"
                          : !info?.loggedIn
                            ? "未登录"
                            : info.version
                              ? info.version.slice(0, 24)
                              : "✓"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Mode segmented control */}
              <Text style={styles.wsCfgLabel}>模式</Text>
              <View style={styles.segmentedRow}>
                {(["spawn", "tmux"] as const).map((m) => (
                  <Pressable
                    key={m}
                    style={[
                      styles.segmentedBtn,
                      mode === m && styles.segmentedBtnActive,
                    ]}
                    onPress={() => {
                      // tmux mode requires a target — if none selected yet,
                      // stay in spawn but let user pick a target first.
                      if (m === "tmux" && !tmuxTarget) {
                        // do nothing here; picker below will guide.
                      }
                      setMode(m);
                      if (m === "spawn") {
                        persist({ mode: "spawn" });
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentedBtnText,
                        mode === m && styles.segmentedBtnTextActive,
                      ]}
                    >
                      {m === "spawn" ? "Spawn" : "tmux 注入"}
                    </Text>
                    <Text style={styles.segmentedBtnSub}>
                      {m === "spawn" ? "独立子进程" : "现有 pane"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* tmux target picker (only when mode === tmux) */}
              {mode === "tmux" && (
                <View>
                  <View style={styles.wsCfgLabelRow}>
                    <Text style={styles.wsCfgLabel}>tmux pane 目标</Text>
                    <Pressable style={styles.rescanBtn} onPress={props.onRescanPanes}>
                      <Text style={styles.rescanBtnText}>↻ 扫描</Text>
                    </Pressable>
                  </View>
                  {props.tmuxPanes.length === 0 ? (
                    <Text style={styles.wsCfgEmpty}>
                      没找到 agent pane。请确认 Claude/Codex 在 tmux 里跑。
                    </Text>
                  ) : (
                    props.tmuxPanes.map((p) => {
                      const selected = tmuxTarget === p.target;
                      const engineDot =
                        p.engine === "claude"
                          ? "●claude"
                          : p.engine === "codex"
                            ? "●codex"
                            : "○未知";
                      return (
                        <Pressable
                          key={p.target}
                          style={[
                            styles.wsCfgPane,
                            selected && styles.wsCfgPaneActive,
                          ]}
                          onPress={() => {
                            setTmuxTarget(p.target);
                            setMode("tmux");
                            persist({ mode: "tmux", tmuxTarget: p.target });
                          }}
                        >
                          <Text style={styles.wsCfgPaneTarget}>{p.target}</Text>
                          <Text style={styles.wsCfgPaneMeta}>
                            {engineDot} · {p.cmd}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              )}

              {/* session id readout (spawn mode) */}
              {mode === "spawn" && config?.sessionId && (
                <View>
                  <Text style={styles.wsCfgLabel}>session id (sticky)</Text>
                  <Text style={styles.wsCfgSessionId}>{config.sessionId}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

// ============================================================================
// §10 BottomSheet — Memory / Settings / History / Tasks / Agents
// ============================================================================
function BottomSheet(props: {
  kind: SheetKind;
  tasks: TaskSummary[];
  memoryItems: Array<{ key: string; value: string; category: string; updatedAt: number }>;
  settings: Record<string, unknown>;
  historyEntries: Array<{ taskId: string; ev: string; data: string; ts: number }>;
  agents: AgentInfo[];
  selectedAgentId: string | null;
  onClose: () => void;
  onDeleteMemory: (key: string) => void;
  onSetSetting: (key: string, value: unknown) => void;
  onSelectAgent: (id: string | null) => void;
  onDeleteAgent: (id: string) => void;
  onStopAgent: (id: string) => void;
  onRenameAgent: (agent: AgentInfo) => void;
}) {
  const { kind } = props;
  const titles: Record<Exclude<SheetKind, null>, string> = {
    memory: "记忆",
    settings: "设置",
    history: "历史",
    tasks: "任务",
    agents: "会话",
  };

  return (
    <Modal visible={kind !== null} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{kind ? titles[kind] : ""}</Text>
            <Pressable style={styles.sheetCloseBtn} onPress={props.onClose}>
              <Text style={styles.sheetCloseIcon}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={{ paddingBottom: SP[8] }}>
            {kind === "tasks" && <TasksBody tasks={props.tasks} />}
            {kind === "memory" && (
              <MemoryBody items={props.memoryItems} onDelete={props.onDeleteMemory} />
            )}
            {kind === "settings" && (
              <SettingsBody settings={props.settings} onSet={props.onSetSetting} />
            )}
            {kind === "history" && <HistoryBody entries={props.historyEntries} />}
            {kind === "agents" && (
              <AgentsBody
                agents={props.agents}
                selectedAgentId={props.selectedAgentId}
                onSelect={props.onSelectAgent}
                onDelete={props.onDeleteAgent}
                onStop={props.onStopAgent}
                onRename={props.onRenameAgent}
              />
            )}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// ============================================================================
// §10b AgentsBody — agent list with switch + delete
// ============================================================================
function AgentsBody({
  agents,
  selectedAgentId,
  onSelect,
  onDelete,
  onStop,
  onRename,
}: {
  agents: AgentInfo[];
  selectedAgentId: string | null;
  onSelect: (id: string | null) => void;
  onRename: (agent: AgentInfo) => void;
  onDelete: (id: string) => void;
  onStop: (id: string) => void;
}) {
  if (agents.length === 0) {
    return (
      <View>
        <Text style={styles.sheetHint}>
          多会话并行 · 可跨重启 resume · 每个 agent = 一个独立的 claude/codex 会话
        </Text>
        <Text style={styles.emptyHint}>
          还没有 agent。在桌面 Jarvis Control 或这里发第一条消息就会自动创建。
        </Text>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.sheetHint}>
        点会话切回去接着聊 · ✕ 删除记录（底层 jsonl 历史保留） · 当前选中会高亮
      </Text>
      {/* "自由模式" toggle — clears selectedAgentId so submit goes to cmd.submit */}
      <Pressable
        style={[
          styles.agentCard,
          selectedAgentId === null && styles.agentCardActive,
        ]}
        onPress={() => onSelect(null)}
      >
        <View style={styles.agentHead}>
          <Text style={styles.agentTitle}>🆓 自由对话（不绑 agent）</Text>
          {selectedAgentId === null && <Text style={styles.agentCheck}>✓</Text>}
        </View>
        <Text style={styles.agentMeta}>submit → cmd.submit · 每次都是新会话</Text>
      </Pressable>

      {agents.map((a) => {
        const isSelected = a.id === selectedAgentId;
        const statusLabel =
          a.status === "running"
            ? "运行中"
            : a.status === "done"
              ? "完成"
              : a.status === "error"
                ? "失败"
                : "空闲";
        const statusColor =
          a.status === "running"
            ? C.accent
            : a.status === "done"
              ? C.accentBright
              : a.status === "error"
                ? C.destructive
                : C.fgSubtle;
        return (
          <View
            key={a.id}
            style={[styles.agentCard, isSelected && styles.agentCardActive]}
          >
            <Pressable
              onPress={() => onSelect(a.id)}
              onLongPress={() => onRename(a)}
            >
              <View style={styles.agentHead}>
                <Text style={styles.agentEngineBadge}>
                  {a.engine === "codex" ? "Cx" : "Cl"}
                </Text>
                <Text style={styles.agentTitle} numberOfLines={2}>
                  {a.title || "(无标题)"}
                </Text>
                {isSelected && <Text style={styles.agentCheck}>✓</Text>}
              </View>
              <Text style={styles.agentMeta}>
                <Text style={{ color: statusColor, fontWeight: FW.bold }}>
                  {statusLabel}
                </Text>
                {"  ·  "}
                {a.workspace || "主目录"}
                {"  ·  "}
                {a.message_count} msg
                {a.session_id ? "  ·  resume" : ""}
              </Text>
              {a.session_id && (
                <Text style={styles.agentSid}>
                  session {a.session_id.slice(0, 8)}…
                </Text>
              )}
            </Pressable>
            <View style={styles.agentActions}>
              {a.status === "running" && (
                <Pressable
                  style={[styles.agentActionBtn, styles.agentActionStop]}
                  onPress={() => onStop(a.id)}
                >
                  <Text style={styles.agentActionStopText}>⏸ 停</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.agentActionBtn, styles.agentActionDelete]}
                onPress={() => {
                  if (confirm(`删除会话 "${(a.title || "(无标题)").slice(0, 40)}"?\n底层 jsonl 历史保留，可重新 resume`)) {
                    onDelete(a.id);
                  }
                }}
              >
                <Text style={styles.agentActionDeleteText}>✕ 删</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TasksBody({ tasks }: { tasks: TaskSummary[] }) {
  if (tasks.length === 0) {
    return <Text style={styles.emptyHint}>暂无任务记录。对 Jarvis 说点什么试试。</Text>;
  }
  return (
    <View>
      {tasks.map((t) => (
        <View key={t.taskId} style={styles.taskCard}>
          <View
            style={[
              styles.taskCardAccentBar,
              { backgroundColor: taskStatusColor(t.status) },
            ]}
          />
          <View style={styles.taskCardBody}>
            <View style={styles.taskCardHead}>
              <Text style={styles.taskCardTitle} numberOfLines={2}>
                {t.title}
              </Text>
              <View style={[styles.taskStatusPill, { backgroundColor: taskStatusColor(t.status) + "22" }]}>
                <Text style={[styles.taskStatusPillText, { color: taskStatusColor(t.status) }]}>
                  {statusIcon(t.status)} {taskStatusLabel(t.status)}
                </Text>
              </View>
            </View>
            {t.workdir ? (
              <Text style={styles.taskCardMeta}>📂 {t.workdir}</Text>
            ) : null}
            <Text style={styles.taskCardMeta}>🕐 {formatDateTime(t.updatedAt)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function MemoryBody({
  items,
  onDelete,
}: {
  items: Array<{ key: string; value: string; category: string; updatedAt: number }>;
  onDelete: (key: string) => void;
}) {
  if (items.length === 0) {
    return (
      <View>
        <Text style={styles.sheetHint}>
          Jarvis 记住的事实（可在 <Text style={styles.monoInline}>~/.jarvis/memory.json</Text> 编辑）
        </Text>
        <Text style={styles.emptyHint}>
          还没记忆。告诉 Jarvis{"\n"}"记住我的默认提醒时间是 5 分钟"。
        </Text>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.sheetHint}>
        Jarvis 记住的事实（可在 <Text style={styles.monoInline}>~/.jarvis/memory.json</Text> 编辑）
      </Text>
      {items.map((m) => (
        <View key={m.key} style={styles.memoryCard}>
          <View style={styles.memoryHead}>
            <Text style={styles.memoryKey}>{m.key}</Text>
            <Pressable style={styles.memoryDeleteBtn} onPress={() => onDelete(m.key)}>
              <Text style={styles.memoryDeleteIcon}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.memoryValue}>{m.value}</Text>
          <Text style={styles.memoryMeta}>
            {m.category} · {formatDateTime(m.updatedAt)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SettingsBody({
  settings,
  onSet,
}: {
  settings: Record<string, unknown>;
  onSet: (key: string, value: unknown) => void;
}) {
  const keys = Object.keys(settings).sort();
  if (keys.length === 0) {
    return (
      <View>
        <Text style={styles.sheetHint}>
          偏好持久化在 <Text style={styles.monoInline}>~/.jarvis/settings.json</Text>
        </Text>
        <Text style={styles.emptyHint}>暂无设置项。</Text>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.sheetHint}>
        偏好持久化在 <Text style={styles.monoInline}>~/.jarvis/settings.json</Text>
      </Text>
      {keys.map((key) => {
        const value = settings[key];
        const label = SETTING_LABELS[key] ?? key;
        if (typeof value === "boolean") {
          return (
            <View key={key} style={styles.settingRow}>
              <Text style={styles.settingLabel}>{label}</Text>
              <Pressable
                style={[styles.toggle, value && styles.toggleOn]}
                onPress={() => onSet(key, !value)}
              >
                <View
                  style={[styles.toggleKnob, value && styles.toggleKnobOn]}
                />
              </Pressable>
            </View>
          );
        }
        return (
          <View key={key} style={styles.settingRow}>
            <Text style={styles.settingLabel}>{label}</Text>
            <Text style={styles.settingValue}>{String(value)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function HistoryBody({
  entries,
}: {
  entries: Array<{ taskId: string; ev: string; data: string; ts: number }>;
}) {
  if (entries.length === 0) {
    return (
      <View>
        <Text style={styles.sheetHint}>最近事件（下拉刷新）</Text>
        <Text style={styles.emptyHint}>暂无历史。说几句话再回来看。</Text>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.sheetHint}>最近事件（下拉刷新）</Text>
      {entries.map((e, idx) => (
        <View key={`${e.taskId}-${idx}`} style={styles.historyRow}>
          <View style={styles.historyMetaRow}>
            <Text style={styles.historyTime}>{formatTime(e.ts)}</Text>
            <View style={[styles.historyEvTag, { backgroundColor: historyEvColor(e.ev) + "22" }]}>
              <Text style={[styles.historyEvText, { color: historyEvColor(e.ev) }]}>
                {e.ev}
              </Text>
            </View>
          </View>
          <Text style={styles.historyData} numberOfLines={4}>
            {e.data}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ============================================================================
// §12 Styles — all tokens, no inline hex
// ============================================================================
const styles = StyleSheet.create({
  // ---- root / center ----
  root: { flex: 1, backgroundColor: C.surface0 },
  center: { alignItems: "center", justifyContent: "center", padding: SP[6] },

  // ---- §5 pairing screen ----
  pairContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SP[6],
  },
  pairLogo: {
    width: 88,
    height: 88,
    borderRadius: BR["3xl"],
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[4],
    ...SH.md,
  },
  pairLogoEmoji: { fontSize: 48 },
  pairTitle: {
    color: C.accentBright,
    fontSize: FS["4xl"],
    fontWeight: FW.bold,
    letterSpacing: 2,
  },
  pairSubtitle: {
    color: C.fgMuted,
    fontSize: FS.sm,
    textAlign: "center",
    marginTop: SP[3],
    lineHeight: 22,
  },
  pairMono: {
    color: C.fg,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: FS.xs,
  },
  pairActions: { marginTop: SP[8], alignItems: "center", gap: SP[3], width: "100%" },
  pairLoadingCard: {
    marginTop: SP[6],
    backgroundColor: C.surface2,
    borderRadius: BR.xl,
    padding: SP[4],
    alignItems: "center",
    gap: SP[2],
    ...SH.sm,
  },
  pairLoadingText: { color: C.fgMuted, fontSize: FS.sm },
  pairManualInput: {
    backgroundColor: C.surface2,
    color: C.fg,
    borderRadius: BR.xl,
    padding: SP[3],
    minHeight: 96,
    fontSize: FS.sm,
    textAlignVertical: "top",
  },
  pairRow: { flexDirection: "row", gap: SP[3], marginTop: SP[4] },
  pairManualLink: {
    color: C.accentBright,
    fontSize: FS.sm,
    marginTop: SP[4],
    textDecorationLine: "underline",
  },
  pairErrorCard: {
    marginTop: SP[6],
    width: "100%",
    backgroundColor: C.destructiveDim,
    borderRadius: BR.xl,
    padding: SP[4],
    borderLeftWidth: 3,
    borderLeftColor: C.destructive,
  },
  pairErrorTitle: { color: C.destructive, fontSize: FS.base, fontWeight: FW.semibold },
  pairErrorDetail: {
    color: C.fgMuted,
    fontSize: FS.xs,
    marginTop: SP[2],
    lineHeight: 18,
  },
  scannerBox: {
    width: "100%",
    height: "70%",
    borderRadius: BR["3xl"],
    overflow: "hidden",
    backgroundColor: C.surface0,
  },
  scanOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: C.accentBright,
    borderRadius: BR.xl,
    backgroundColor: "transparent",
  },
  cancelScan: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: C.surface3,
    paddingHorizontal: SP[6],
    paddingVertical: SP[3],
    borderRadius: BR.xl,
  },
  cancelScanText: { color: C.fg, fontSize: FS.sm, fontWeight: FW.medium },

  // ---- buttons (shared) ----
  btnPrimary: {
    backgroundColor: C.accent,
    paddingHorizontal: SP[8],
    paddingVertical: SP[3],
    borderRadius: BR.xl,
    alignItems: "center",
    justifyContent: "center",
    ...SH.sm,
  },
  btnPrimaryText: { color: C.accentForeground, fontSize: FS.base, fontWeight: FW.semibold },
  btnGhost: {
    backgroundColor: C.surface2,
    paddingHorizontal: SP[6],
    paddingVertical: SP[3],
    borderRadius: BR.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { color: C.fg, fontSize: FS.base, fontWeight: FW.medium },
  btnFlex: { flex: 1 },

  // ---- §6 header ----
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: SP[3],
    paddingBottom: SP[3],
    gap: SP[2],
    backgroundColor: C.surface0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerMenuBtn: {
    width: 38,
    height: 38,
    borderRadius: BR.xl,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMenuIcon: { color: C.fg, fontSize: 18 },
  headerStatusWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
    paddingHorizontal: SP[2],
  },
  statusDot: { width: 8, height: 8, borderRadius: BR.full },
  headerStatusLabel: { fontSize: FS.sm, fontWeight: FW.semibold },
  headerWsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
    backgroundColor: C.surface2,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: BR.xl,
    minWidth: 0,
  },
  headerWsIcon: { fontSize: 14 },
  headerWsText: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: FW.medium,
    flex: 1,
  },
  headerWsCaret: { color: C.fgSubtle, fontSize: 12 },

  // ---- §7 stream ----
  stream: { flex: 1, backgroundColor: C.surface0 },
  streamContent: { padding: SP[3], paddingBottom: SP[4] },
  rowLeft: { flexDirection: "row", justifyContent: "flex-start", marginBottom: SP[2] },
  rowRight: { flexDirection: "row", justifyContent: "flex-end", marginBottom: SP[2] },
  rowCenter: { flexDirection: "row", justifyContent: "center", marginBottom: SP[2] },
  bubbleUser: {
    backgroundColor: C.accent,
    borderRadius: BR.xl,
    borderBottomRightRadius: BR.base,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    maxWidth: "85%",
    ...SH.sm,
  },
  bubbleUserText: { color: C.accentForeground, fontSize: FS.sm, lineHeight: 21 },
  bubbleJarvis: {
    backgroundColor: C.surface2,
    borderRadius: BR.xl,
    borderBottomLeftRadius: BR.base,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    maxWidth: "90%",
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  bubbleTool: {
    backgroundColor: C.surface1,
    borderRadius: BR.lg,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    maxWidth: "85%",
    borderLeftWidth: 2,
    borderLeftColor: C.fgSubtle,
  },
  bubbleToolText: { color: C.fgMuted, fontSize: FS.xs, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  bubbleError: {
    backgroundColor: C.destructiveDim,
    borderRadius: BR.xl,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    maxWidth: "85%",
    borderLeftWidth: 3,
    borderLeftColor: C.destructive,
  },
  bubbleErrorText: { color: C.destructive, fontSize: FS.sm, lineHeight: 21 },
  bubbleSystem: {
    backgroundColor: C.surface1,
    borderRadius: BR.full,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
  },
  bubbleSystemText: { color: C.fgSubtle, fontSize: FS.xs },

  // ---- markdown styles ----
  mdParagraph: { color: C.fg, fontSize: FS.sm, lineHeight: 22, marginBottom: SP[1] },
  mdList: { marginTop: SP[1], marginBottom: SP[2], gap: SP[1] },
  mdListItem: { flexDirection: "row", gap: SP[2] },
  mdBullet: { color: C.accentBright, fontSize: FS.sm, lineHeight: 22 },
  mdListItemText: { color: C.fg, fontSize: FS.sm, lineHeight: 22, flex: 1 },
  mdBold: { color: C.fg, fontSize: FS.sm, lineHeight: 22, fontWeight: FW.semibold },
  mdInlineCode: {
    color: C.accentBright,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: FS.xs,
    backgroundColor: C.surface0,
    paddingHorizontal: SP[1],
    borderRadius: BR.base,
    overflow: "hidden",
  },
  mdCodeBlock: {
    backgroundColor: C.surface0,
    borderRadius: BR.lg,
    padding: SP[2],
    marginVertical: SP[1],
    borderWidth: 1,
    borderColor: C.border,
  },
  mdCodeText: {
    color: C.accentBright,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: FS.xs,
    lineHeight: 18,
  },

  // ---- banners (recording / busy) ----
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    marginHorizontal: SP[3],
    marginBottom: SP[2],
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: BR.xl,
    ...SH.sm,
  },
  bannerRecording: { backgroundColor: C.destructiveDim },
  bannerBusy: { backgroundColor: C.accentDim },
  bannerText: { fontSize: FS.sm, fontWeight: FW.medium },
  pulseDot: { width: 10, height: 10, borderRadius: BR.full },
  stopBtn: {
    backgroundColor: C.destructive,
    borderRadius: BR.lg,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
  },
  stopBtnText: { color: C.accentForeground, fontSize: FS.xs, fontWeight: FW.bold },

  // ---- §8 composer ----
  composer: {
    flexDirection: "row",
    padding: SP[3],
    gap: SP[2],
    backgroundColor: C.surface0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    alignItems: "flex-end",
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: BR.full,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  micBtnActive: {
    backgroundColor: C.destructive,
    borderColor: C.destructive,
  },
  micIcon: { color: C.fg, fontSize: 18 },
  composerInput: {
    flex: 1,
    backgroundColor: C.surface2,
    color: C.fg,
    borderRadius: BR.xl,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    maxHeight: 120,
    fontSize: FS.sm,
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: BR.full,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    ...SH.sm,
  },
  sendBtnText: { color: C.accentForeground, fontSize: 20, fontWeight: FW.bold },

  // ---- §9 drawer ----
  drawerBackdrop: {
    flex: 1,
    backgroundColor: C.backdropSoft,
  },
  drawerPanel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: C.surfaceSidebar,
    ...SH.lg,
  },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { padding: SP[4], paddingTop: 54 },
  drawerHeader: { marginBottom: SP[4] },
  drawerBrand: { color: C.fg, fontSize: FS["2xl"], fontWeight: FW.bold, letterSpacing: 1 },
  drawerStatusRow: { flexDirection: "row", alignItems: "center", gap: SP[1], marginTop: SP[1] },
  drawerStatusLabel: { fontSize: FS.sm, fontWeight: FW.medium },
  drawerSectionLabel: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    fontWeight: FW.semibold,
    marginTop: SP[4],
    marginBottom: SP[2],
    paddingHorizontal: SP[2],
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    borderRadius: BR.xl,
    minHeight: 44,
  },
  drawerItemActive: { backgroundColor: C.surface2 },
  drawerItemIcon: { fontSize: 16 },
  drawerItemLabel: { flex: 1, color: C.fg, fontSize: FS.sm, fontWeight: FW.medium },
  drawerItemCheck: { color: C.accentBright, fontSize: FS.sm, fontWeight: FW.bold },
  drawerItemCaret: { color: C.fgSubtle, fontSize: FS.sm },
  drawerItemToggle: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    fontWeight: FW.semibold,
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    borderRadius: BR.base,
    backgroundColor: C.surface1,
    minWidth: 36,
    textAlign: "center",
  },
  drawerItemToggleOn: { color: C.accentForeground, backgroundColor: C.accent },
  drawerItemDanger: { backgroundColor: C.destructiveDim },

  // ---- workspace picker sheet ----
  backdrop: {
    flex: 1,
    backgroundColor: C.backdropSoft,
    justifyContent: "flex-end",
  },
  backdropCenter: {
    flex: 1,
    backgroundColor: C.backdropStrong,
    alignItems: "center",
    justifyContent: "center",
    padding: SP[6],
  },
  wsSheet: {
    backgroundColor: C.surface0,
    borderTopLeftRadius: BR["3xl"],
    borderTopRightRadius: BR["3xl"],
    padding: SP[4],
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: C.border,
  },
  wsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    borderRadius: BR.xl,
    backgroundColor: C.surface1,
    marginBottom: SP[2],
  },
  wsRowActive: { backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent },
  wsRowIcon: { fontSize: 16 },
  wsRowLabel: { flex: 1, color: C.fg, fontSize: FS.sm, fontWeight: FW.medium },
  wsRowLabelActive: { color: C.accentBright },
  wsRowCheck: { color: C.accentBright, fontSize: FS.sm, fontWeight: FW.bold },
  wsEmpty: { color: C.fgSubtle, fontSize: FS.xs, textAlign: "center", padding: SP[4] },

  // ---- §10 sheet (memory/settings/history/tasks) ----
  sheet: {
    backgroundColor: C.surface0,
    borderTopLeftRadius: BR["3xl"],
    borderTopRightRadius: BR["3xl"],
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: C.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: BR.full,
    backgroundColor: C.surface4,
    alignSelf: "center",
    marginTop: SP[2],
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    paddingBottom: SP[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  sheetTitle: { color: C.fg, fontSize: FS.xl, fontWeight: FW.bold },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: BR.full,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseIcon: { color: C.fgMuted, fontSize: 14, fontWeight: FW.bold },
  sheetBody: { padding: SP[3] },
  sheetHint: {
    color: C.fgMuted,
    fontSize: FS.xs,
    lineHeight: 18,
    marginBottom: SP[3],
    paddingHorizontal: SP[2],
  },
  monoInline: {
    color: C.accentBright,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: FS.xs,
  },
  emptyHint: {
    color: C.fgSubtle,
    fontSize: FS.sm,
    textAlign: "center",
    paddingVertical: SP[8],
    lineHeight: 22,
  },

  // ---- task cards ----
  taskCard: {
    flexDirection: "row",
    backgroundColor: C.surface2,
    borderRadius: BR.xl,
    marginBottom: SP[3],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.borderAccent,
    ...SH.sm,
  },
  taskCardAccentBar: { width: 3 },
  taskCardBody: { flex: 1, padding: SP[3] },
  taskCardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SP[2],
    marginBottom: SP[2],
  },
  taskCardTitle: { color: C.fg, fontSize: FS.sm, fontWeight: FW.semibold, flex: 1, lineHeight: 20 },
  taskStatusPill: { paddingHorizontal: SP[2], paddingVertical: SP[1], borderRadius: BR.full },
  taskStatusPillText: { fontSize: FS.xs, fontWeight: FW.bold },
  taskCardMeta: { color: C.fgSubtle, fontSize: FS.xs, marginTop: SP[1] },

  // ---- agent cards (Phase G — multi-session resume) ----
  agentCard: {
    backgroundColor: C.surface2,
    borderRadius: BR.xl,
    padding: SP[3],
    marginBottom: SP[2],
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  agentCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentDim,
  },
  agentHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    marginBottom: SP[1],
  },
  agentEngineBadge: {
    color: C.surface0,
    backgroundColor: C.accent,
    fontSize: FS.xs,
    fontWeight: FW.bold,
    paddingHorizontal: SP[1],
    paddingVertical: 2,
    borderRadius: BR.sm,
    overflow: "hidden",
  },
  agentTitle: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: FW.semibold,
    flex: 1,
  },
  agentCheck: {
    color: C.accentBright,
    fontSize: FS.sm,
    fontWeight: FW.bold,
  },
  agentMeta: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    marginTop: SP[0.5],
  },
  agentSid: {
    color: C.accentBright,
    fontSize: FS.xs,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  agentActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SP[2],
    marginTop: SP[2],
    paddingTop: SP[2],
    borderTopWidth: 1,
    borderTopColor: C.borderAccent,
  },
  agentActionBtn: {
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    borderRadius: BR.md,
    borderWidth: 1,
  },
  agentActionStop: {
    backgroundColor: C.accentDim,
    borderColor: C.accent,
  },
  agentActionStopText: {
    color: C.accentBright,
    fontSize: FS.xs,
    fontWeight: FW.bold,
  },
  agentActionDelete: {
    backgroundColor: C.destructiveDim,
    borderColor: C.destructive,
  },
  agentActionDeleteText: {
    color: C.destructive,
    fontSize: FS.xs,
    fontWeight: FW.bold,
  },
  // chip shown in composer when an agent is selected
  agentChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1.5],
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    backgroundColor: C.accentDim,
    borderTopWidth: 1,
    borderTopColor: C.borderAccent,
  },
  agentChipText: {
    color: C.accentBright,
    fontSize: FS.xs,
    fontWeight: FW.semibold,
    flex: 1,
  },
  agentChipClear: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    paddingHorizontal: SP[1],
  },

  // ---- memory cards ----
  memoryCard: {
    backgroundColor: C.surface2,
    borderRadius: BR.xl,
    padding: SP[3],
    marginBottom: SP[2],
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  memoryHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SP[2],
  },
  memoryKey: {
    color: C.accentBright,
    fontSize: FS.xs,
    fontWeight: FW.bold,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    flex: 1,
  },
  memoryDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: BR.full,
    backgroundColor: C.destructiveDim,
    alignItems: "center",
    justifyContent: "center",
  },
  memoryDeleteIcon: { color: C.destructive, fontSize: 12, fontWeight: FW.bold },
  memoryValue: { color: C.fg, fontSize: FS.sm, lineHeight: 21 },
  memoryMeta: { color: C.fgSubtle, fontSize: FS.xs, marginTop: SP[2] },

  // ---- settings ----
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.surface2,
    borderRadius: BR.xl,
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    marginBottom: SP[2],
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  settingLabel: { color: C.fg, fontSize: FS.sm, flex: 1 },
  settingValue: { color: C.fgMuted, fontSize: FS.sm, fontWeight: FW.medium },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: BR.full,
    backgroundColor: C.surface4,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: C.accent },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: BR.full,
    backgroundColor: C.fg,
    transform: [{ translateX: 0 }],
  },
  toggleKnobOn: { transform: [{ translateX: 20 }] },

  // ---- history ----
  historyRow: {
    backgroundColor: C.surface2,
    borderRadius: BR.lg,
    padding: SP[3],
    marginBottom: SP[2],
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  historyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    marginBottom: SP[1],
  },
  historyTime: { color: C.fgSubtle, fontSize: FS.xs },
  historyEvTag: { paddingHorizontal: SP[1], paddingVertical: 2, borderRadius: BR.base },
  historyEvText: { fontSize: FS.xs, fontWeight: FW.bold },
  historyData: { color: C.fg, fontSize: FS.sm, lineHeight: 19 },

  // ---- workspace picker / shared sheet subtitle ----
  sheetSubtitle: {
    color: C.fgMuted,
    fontSize: FS.xs,
    lineHeight: 18,
    marginTop: SP[2],
    marginBottom: SP[3],
  },

  // ---- §11 permission modal ----
  permCard: {
    backgroundColor: C.surface2,
    borderRadius: BR["2xl"],
    padding: SP[5],
    width: "100%",
    borderWidth: 1,
    borderColor: C.borderAccent,
    ...SH.lg,
  },
  permHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    marginBottom: SP[3],
  },
  permIcon: { fontSize: 22 },
  permTitle: {
    color: C.destructive,
    fontSize: FS.lg,
    fontWeight: FW.bold,
    flex: 1,
  },
  permSummary: {
    color: C.fg,
    fontSize: FS.base,
    lineHeight: 22,
    marginBottom: SP[2],
  },
  permDetail: {
    color: C.fgMuted,
    fontSize: FS.sm,
    lineHeight: 20,
    marginBottom: SP[3],
  },
  permRow: { flexDirection: "row", gap: SP[3], marginTop: SP[2] },
  permBtnDeny: {
    flex: 1,
    backgroundColor: C.destructiveDim,
    borderRadius: BR.xl,
    paddingVertical: SP[3],
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.destructive,
  },
  permBtnDenyText: { color: C.destructive, fontSize: FS.base, fontWeight: FW.semibold },
  permBtnApprove: {
    flex: 1,
    backgroundColor: C.accent,
    borderRadius: BR.xl,
    paddingVertical: SP[3],
    alignItems: "center",
    ...SH.sm,
  },
  permBtnApproveText: { color: C.accentForeground, fontSize: FS.base, fontWeight: FW.semibold },

  // ---- §F workspace config tags + drawer row + config sheet ----
  wsTag: {
    paddingHorizontal: SP[1.5],
    paddingVertical: 2,
    borderRadius: BR.base,
    borderWidth: 1,
    marginRight: SP[1],
  },
  wsTagClaude: { backgroundColor: C.accentDim, borderColor: C.accent },
  wsTagCodex: { backgroundColor: "#1a1a2e", borderColor: "#4a4aff" },
  wsTagText: { fontSize: 10, fontWeight: FW.bold, color: C.fg },

  // drawer row (label + tag + config button)
  drawerItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    borderRadius: BR.xl,
    minHeight: 44,
  },
  drawerItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    flex: 1,
  },
  drawerItemConfigBtn: {
    width: 32,
    height: 32,
    borderRadius: BR.full,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SP[1],
  },
  drawerItemConfigIcon: { color: C.fgMuted, fontSize: 14 },

  // §F WorkspaceConfigSheet styles
  wsCfgTargetName: {
    color: C.fg,
    fontSize: FS.lg,
    fontWeight: FW.bold,
    marginBottom: SP[3],
    paddingHorizontal: SP[2],
  },
  wsCfgLabel: {
    color: C.fgMuted,
    fontSize: FS.xs,
    fontWeight: FW.semibold,
    marginTop: SP[3],
    marginBottom: SP[2],
    paddingHorizontal: SP[2],
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  wsCfgLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SP[3],
    marginBottom: SP[2],
    paddingHorizontal: SP[2],
  },
  segmentedRow: {
    flexDirection: "row",
    gap: SP[2],
    paddingHorizontal: SP[2],
    marginBottom: SP[1],
  },
  segmentedBtn: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: BR.xl,
    paddingVertical: SP[3],
    paddingHorizontal: SP[3],
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.borderAccent,
    gap: 2,
  },
  segmentedBtnActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
    ...SH.sm,
  },
  segmentedBtnDisabled: {
    opacity: 0.45,
  },
  segmentedBtnText: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: FW.semibold,
  },
  segmentedBtnTextActive: { color: C.accentForeground },
  segmentedBtnSub: { color: C.fgSubtle, fontSize: 10 },
  rescanBtn: {
    backgroundColor: C.surface2,
    borderRadius: BR.base,
    paddingHorizontal: SP[2],
    paddingVertical: 2,
  },
  rescanBtnText: { color: C.accentBright, fontSize: FS.xs, fontWeight: FW.semibold },
  wsCfgEmpty: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    textAlign: "center",
    padding: SP[4],
    lineHeight: 18,
  },
  wsCfgPane: {
    backgroundColor: C.surface2,
    borderRadius: BR.lg,
    padding: SP[3],
    marginHorizontal: SP[2],
    marginBottom: SP[2],
    borderWidth: 1,
    borderColor: C.borderAccent,
    gap: 2,
  },
  wsCfgPaneActive: { backgroundColor: C.accentDim, borderColor: C.accent },
  wsCfgPaneTarget: {
    color: C.fg,
    fontSize: FS.sm,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: FW.semibold,
  },
  wsCfgPaneMeta: { color: C.fgSubtle, fontSize: 10 },
  wsCfgSessionId: {
    color: C.accentBright,
    fontSize: FS.xs,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    backgroundColor: C.surface1,
    borderRadius: BR.base,
    overflow: "hidden",
  },
});
