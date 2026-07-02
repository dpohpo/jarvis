/**
 * Legacy 570-line App.tsx — kept as canonical business-behavior reference.
 *
 * Phase 4 (2026-07-01): the entry was moved here to make room for the new
 * 50-line App.tsx. This file is NOT imported by anything; it exists so
 * Phase 7 (LoginScreen), Phase 8 (TopBar), Phase 11 (ChatSurface), and
 * Phase 14 (hooks for voice/wakeword/client) can port handlers/effects
 * verbatim instead of re-deriving them.
 *
 * Key behaviors preserved (do not lose these during the rewrite):
 *  - PairingScreen with QR scan + manual JSON fallback
 *  - submit() → submitCommand(text) on the JarvisClient
 *  - 3-mode mic state machine (hold/tap/auto)
 *  - convMode TTS auto-listen chain
 *  - PermRequest approval modal
 *  - LogLine state capped to 300 entries
 *
 * @ts-nocheck — the relative imports below (./src/client etc.) only made
 * sense when this file lived at packages/app/App.tsx. The code stays as-is
 * for reference; new screens import from ../client, ../store, etc.
 */
// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
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
import type { PermRequest, TaskEvent } from "@jarvis/protocol";
import { ensureCrypto } from "./src/crypto-init";
import { JarvisClient, pairWithDaemon, type PairInfo } from "./src/client";
import { clearState, loadState, saveState, type PhoneState } from "./src/store";
import { playTtsWav, startCapture, stopCapture } from "./src/voice";

interface LogLine {
  id: string;
  kind: TaskEvent["ev"] | "local";
  text: string;
}

export default function App() {
  return (
    <KeyboardProvider>
      <Main />
    </KeyboardProvider>
  );
}

function Main() {
  const [booted, setBooted] = useState(false);
  const [state, setState] = useState<PhoneState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualPair, setManualPair] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [pairing, setPairing] = useState(false);
  const [linkUp, setLinkUp] = useState(false);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [perm, setPerm] = useState<PermRequest | null>(null);
  const [recording, setRecording] = useState(false);
  const [convMode, setConvMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const client = useRef<JarvisClient | null>(null);
  const scanned = useRef(false);
  const pressStart = useRef(0);
  const recMode = useRef<"hold" | "tap" | "auto" | null>(null);
  const convModeRef = useRef(false);
  const autoListenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  convModeRef.current = convMode;

  const pushLine = useCallback((kind: LogLine["kind"], text: string) => {
    setLines((prev) => [
      ...prev.slice(-300),
      { id: `${Date.now()}-${Math.random()}`, kind, text },
    ]);
  }, []);

  // boot: init crypto, load pairing
  useEffect(() => {
    void (async () => {
      await ensureCrypto();
      const s = await loadState();
      setState(s);
      setBooted(true);
    })();
  }, []);

  // connect when paired
  useEffect(() => {
    if (!state) return;
    const c = new JarvisClient(state, {
      onLink: setLinkUp,
      onTaskEvent: (e) => {
        if (e.ev === "output" || e.ev === "done") pushLine(e.ev, e.data);
        else if (e.ev === "error") pushLine("error", e.data);
        else if (e.ev === "tool_use") pushLine("tool_use", `⚙ ${e.data}`);
        else if (e.ev === "progress") pushLine("progress", e.data);
        // a real task (not a chat reply) is running between started and done/error
        if (e.ev === "started") setBusy(true);
        else if (e.ev === "done" || e.ev === "error") {
          if (!e.taskId.startsWith("chat-")) setBusy(false);
        }
      },
      onPermRequest: setPerm,
      onAsrFinal: (text) => pushLine("local", text ? `🎤 ${text}` : "🎤 (没听清)"),
      onTtsReady: (chunks, _mime, durationMs, expectReply) => {
        void playTtsWav(chunks).catch((e) => pushLine("error", `播放失败: ${e}`));
        // conversation mode: when Jarvis expects an answer, start listening
        // right after the reply finishes playing
        if (convModeRef.current && expectReply) {
          if (autoListenTimer.current) clearTimeout(autoListenTimer.current);
          autoListenTimer.current = setTimeout(() => {
            void autoListen();
          }, Math.max(durationMs, 500) + 500);
        }
      },
      onTaskState: (tasks) => {
        pushLine(
          "local",
          tasks
            .slice(0, 8)
            .map((t) => `${statusIcon(t.status)} ${t.title.slice(0, 40)}`)
            .join("\n") || "（暂无任务）",
        );
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
    try {
      const info = JSON.parse(data) as PairInfo;
      const s = await pairWithDaemon(info, `${Platform.OS}-phone`);
      await saveState(s);
      setState(s);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("[pair] failed:", err.message, err.stack);
      Alert.alert("配对失败", `${err.message}\n\n${(err.stack ?? "").slice(0, 600)}`);
    } finally {
      setPairing(false);
      scanned.current = false;
    }
  }, []);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || !client.current) return;
    pushLine("local", `🫵 ${text}`);
    client.current.submitCommand(text);
    setInput("");
  }, [input, pushLine]);

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
        // VAD already stopped the mic and flushed; just close the stream
        recMode.current = null;
        setRecording(false);
        client.current?.endVoice();
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
  }, []);

  const autoListen = useCallback(async () => {
    if (recMode.current !== null) return; // already recording
    recMode.current = "auto";
    const ok = await beginRecording(true);
    if (!ok) recMode.current = null;
  }, [beginRecording]);

  const onMicPressIn = useCallback(async () => {
    if (recording && recMode.current === "tap") {
      // second tap ends a tap-mode recording
      await finishRecording();
      return;
    }
    if (recording && recMode.current === "auto") {
      // tapping during auto-listen ends it immediately
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
      // quick tap → switch to tap mode, keep recording until next tap
      recMode.current = "tap";
      return;
    }
    if (recMode.current === "hold") await finishRecording();
  }, [recording, finishRecording]);

  if (!booted) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="#7FD1AE" />
      </View>
    );
  }

  // ---------- pairing screen ----------
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
            <Pressable style={styles.cancelScan} onPress={() => setScanning(false)}>
              <Text style={styles.btnText}>取消</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Jarvis</Text>
            <Text style={styles.subtitle}>
              在 Mac 上运行 `pnpm --filter @jarvis/daemon pair`{"\n"}然后扫描二维码
            </Text>
            {pairing ? (
              <ActivityIndicator color="#7FD1AE" style={{ marginTop: 24 }} />
            ) : manualPair ? (
              <View style={{ width: "100%", marginTop: 24 }}>
                <TextInput
                  style={[styles.input, { minHeight: 90 }]}
                  value={manualJson}
                  onChangeText={setManualJson}
                  placeholder='粘贴配对 JSON（{"relayUrl":...}）'
                  placeholderTextColor="#5B6770"
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                  <Pressable
                    style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]}
                    onPress={() => setManualPair(false)}
                  >
                    <Text style={styles.btnText}>返回</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]}
                    onPress={() => void onScan(manualJson.trim())}
                  >
                    <Text style={styles.btnText}>配对</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={async () => {
                    if (!camPerm?.granted) {
                      const r = await requestCamPerm();
                      if (!r.granted) return;
                    }
                    scanned.current = false;
                    setScanning(true);
                  }}
                >
                  <Text style={styles.btnText}>扫码配对</Text>
                </Pressable>
                <Pressable onPress={() => setManualPair(true)}>
                  <Text style={[styles.subtitle, { marginTop: 18 }]}>手动输入配对信息</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>
    );
  }

  // ---------- console screen ----------
  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: linkUp ? "#7FD1AE" : "#E0635C" }]} />
        <Text style={styles.headerText}>{state.daemonDeviceId}</Text>
        <Pressable onPress={() => setConvMode((v) => !v)}>
          <Text style={[styles.headerAction, convMode && { color: "#7FD1AE" }]}>
            {convMode ? "对话中" : "对话"}
          </Text>
        </Pressable>
        <Pressable onPress={() => client.current?.requestTaskList()}>
          <Text style={styles.headerAction}>任务</Text>
        </Pressable>
        <Pressable
          onLongPress={async () => {
            await clearState();
            setState(null);
            setLines([]);
          }}
        >
          <Text style={styles.headerAction}>解绑(长按)</Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.log}
        data={lines}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <Text style={[styles.line, lineStyle(item.kind)]}>{item.text}</Text>
        )}
        contentContainerStyle={{ paddingBottom: 12 }}
      />

      {recording && (
        <View style={styles.recBanner}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>
            {recMode.current === "auto"
              ? "聆听中 — 说完停顿即发送（按麦克风立即结束）"
              : recMode.current === "tap"
                ? "录音中 — 再按一下麦克风结束"
                : "录音中 — 松开发送"}
          </Text>
        </View>
      )}
      {busy && (
        <View style={styles.recBanner}>
          <ActivityIndicator size="small" color="#7FD1AE" />
          <Text style={[styles.recText, { color: "#7FD1AE", flex: 1 }]}>任务执行中…</Text>
          <Pressable
            style={styles.stopBtn}
            onPress={() => {
              client.current?.stopTask();
              setBusy(false);
              pushLine("local", "🛑 已发送停止");
            }}
          >
            <Text style={[styles.btnText, { color: "#E0635C", fontSize: 14 }]}>⏹ 停止</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.inputRow}>
        <Pressable
          style={[styles.micBtn, recording && styles.micBtnActive]}
          onPressIn={() => void onMicPressIn()}
          onPressOut={() => void onMicPressOut()}
        >
          <Text style={styles.btnText}>{recording ? "⏺" : "🎙"}</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="对 Jarvis 说点什么…"
          placeholderTextColor="#5B6770"
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={submit}>
          <Text style={styles.btnText}>发送</Text>
        </Pressable>
      </View>

      <Modal visible={perm !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔐 Tier {perm?.tier} 操作审批</Text>
            <Text style={styles.modalSummary}>{perm?.summary}</Text>
            <Text style={styles.modalDetail}>{perm?.detail}</Text>
            <View style={styles.modalRow}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: "#3A2F31" }]}
                onPress={() => {
                  if (perm) client.current?.respondPermission(perm.reqId, false);
                  setPerm(null);
                }}
              >
                <Text style={[styles.btnText, { color: "#E0635C" }]}>拒绝</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: "#23362E" }]}
                onPress={() => {
                  if (perm) client.current?.respondPermission(perm.reqId, true);
                  setPerm(null);
                }}
              >
                <Text style={[styles.btnText, { color: "#7FD1AE" }]}>批准</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function statusIcon(s: string): string {
  if (s === "done") return "✅";
  if (s === "running") return "▶️";
  if (s === "waiting_approval") return "🔐";
  if (s === "error") return "❌";
  return "⏸";
}

function lineStyle(kind: LogLine["kind"]) {
  switch (kind) {
    case "local":
      return { color: "#8FB6E8" };
    case "error":
      return { color: "#E0635C" };
    case "done":
      return { color: "#7FD1AE" };
    case "tool_use":
    case "progress":
      return { color: "#5B6770" };
    default:
      return { color: "#C9D4DC" };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B0F14" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  title: { color: "#E8EEF2", fontSize: 42, fontWeight: "700", letterSpacing: 2 },
  subtitle: { color: "#5B6770", fontSize: 14, textAlign: "center", marginTop: 12, lineHeight: 22 },
  primaryBtn: {
    backgroundColor: "#1E2B36",
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 28,
  },
  btnText: { color: "#E8EEF2", fontSize: 16, fontWeight: "600" },
  scannerBox: { width: "100%", height: "70%", borderRadius: 16, overflow: "hidden" },
  cancelScan: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "#00000088",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1E2B36",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  headerText: { color: "#E8EEF2", fontSize: 15, fontWeight: "600", flex: 1 },
  headerAction: { color: "#5B6770", fontSize: 13, marginLeft: 14 },
  log: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  line: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
    fontFamily: Platform.select({ android: "monospace", ios: "Menlo" }),
  },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1E2B36",
  },
  input: {
    flex: 1,
    backgroundColor: "#121922",
    color: "#E8EEF2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: "#1E2B36",
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  micBtn: {
    backgroundColor: "#1E2B36",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: "#5A2330",
  },
  recBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E0635C",
  },
  recText: { color: "#E0635C", fontSize: 13 },
  stopBtn: {
    backgroundColor: "#3A2F31",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#000000AA",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#121922",
    borderRadius: 16,
    padding: 20,
    width: "100%",
  },
  modalTitle: { color: "#E8EEF2", fontSize: 17, fontWeight: "700" },
  modalSummary: { color: "#C9D4DC", fontSize: 15, marginTop: 10 },
  modalDetail: { color: "#5B6770", fontSize: 13, marginTop: 8, lineHeight: 19 },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
});
