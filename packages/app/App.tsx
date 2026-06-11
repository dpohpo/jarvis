/**
 * Jarvis — phone remote for all your computer agents.
 * MVP screens: pair (QR scan) ⇄ console (command input + live event stream + approval modal).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { PermRequest, TaskEvent } from "@jarvis/protocol";
import { ensureCrypto } from "./src/crypto-init";
import { JarvisClient, pairWithDaemon, type PairInfo } from "./src/client";
import { clearState, loadState, saveState, type PhoneState } from "./src/store";

interface LogLine {
  id: string;
  kind: TaskEvent["ev"] | "local";
  text: string;
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [state, setState] = useState<PhoneState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [linkUp, setLinkUp] = useState(false);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [perm, setPerm] = useState<PermRequest | null>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const client = useRef<JarvisClient | null>(null);
  const scanned = useRef(false);

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
      },
      onPermRequest: setPerm,
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
      Alert.alert("配对失败", String(e instanceof Error ? e.message : e));
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
            ) : (
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
            )}
          </>
        )}
      </View>
    );
  }

  // ---------- console screen ----------
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: linkUp ? "#7FD1AE" : "#E0635C" }]} />
        <Text style={styles.headerText}>{state.daemonDeviceId}</Text>
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

      <View style={styles.inputRow}>
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
