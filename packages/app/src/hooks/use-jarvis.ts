/**
 * useJarvis — main business hook (Phase 14).
 *
 * Wires JarvisClient + voice + permission flow into the v2 stores.
 * Mount this once inside MainScreen; everything else reads via store
 * selectors.
 *
 * Ported from src/legacy/app-legacy.tsx lines 88-223 (the connect
 * effect + 6 client callbacks + mic state machine + PermRequest modal
 * state). Behavior preserved verbatim — only the state container
 * changed (from useState in App.tsx to zustand stores).
 */
import { useEffect, useRef } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import type { PermRequest, TaskEvent } from "@jarvis/protocol";
import { JarvisClient } from "../client";
import { playTtsWav, startCapture, stopCapture } from "../voice";
import type { PhoneState } from "../store";
import { useSessionStore } from "../stores/session-store";
import { useWorkspaceStore, type Agent, type AgentStatus } from "../stores/workspace-store";
import { useInputStore, type RecMode } from "../stores/input-store";
import { useSettingsStore } from "../stores/settings-store";
import { useUiStore } from "../stores/ui-store";

const AUTO_LISTEN_DELAY_MS = 500;

/** TaskEvent status → AgentStatus mapping for sidebar dots. */
function statusFromEvent(e: TaskEvent["ev"]): AgentStatus | null {
  if (e === "started") return "running";
  if (e === "done") return "done";
  if (e === "error") return "error";
  return null;
}

export function useJarvis(state: PhoneState) {
  const client = useRef<JarvisClient | null>(null);
  const pressStart = useRef(0);

  const pushLine = useSessionStore((s) => s.pushLine);
  const setLinkUp = useSessionStore((s) => s.setLinkUp);
  const setBusy = useSessionStore((s) => s.setBusy);
  const upsertAgent = useWorkspaceStore((s) => s.upsertAgent);

  const setRecording = useInputStore((s) => s.setRecording);
  const setRecMode = useInputStore((s) => s.setRecMode);

  const settings = useSettingsStore((s) => s.settings);

  // ----- client lifecycle -----
  useEffect(() => {
    const c = new JarvisClient(state, {
      onLink: setLinkUp,
      onTaskEvent: (e) => {
        // map event → session line
        if (e.ev === "output" || e.ev === "done") pushLine({ kind: "assistant", text: e.data });
        else if (e.ev === "error") pushLine({ kind: "error", text: e.data });
        else if (e.ev === "tool_use") pushLine({ kind: "tool", text: `⚙ ${e.data}` });
        else if (e.ev === "progress") pushLine({ kind: "system", text: e.data });
        // busy state — real tasks only, not chat replies
        if (e.ev === "started") setBusy(true);
        else if (e.ev === "done" || e.ev === "error") {
          if (!e.taskId.startsWith("chat-")) setBusy(false);
        }
        // sync agent row in sidebar (best-effort)
        const status = statusFromEvent(e.ev);
        if (status) upsertAgent({ id: e.taskId, title: e.taskId.slice(0, 24), status });
      },
      onPermRequest: (r: PermRequest) => useUiStore.getState().setPermRequest(r),
      onAsrFinal: (text) =>
        pushLine({ kind: "local", text: text ? `🎤 ${text}` : "🎤 (没听清)" }),
      onTtsReady: (chunks, _mime, durationMs, expectReply) => {
        void playTtsWav(chunks).catch((e) => pushLine({ kind: "error", text: `播放失败: ${e}` }));
        // convMode auto-listen chain
        if (settings.convMode && expectReply) {
          setTimeout(() => void autoListen(), Math.max(durationMs, 500) + AUTO_LISTEN_DELAY_MS);
        }
      },
      onTaskState: (tasks) => {
        // Replace agent list with current snapshot
        const agents: Agent[] = tasks.map((t) => ({
          id: t.taskId,
          title: t.title,
          status: (t.status as AgentStatus) ?? "idle",
        }));
        useWorkspaceStore.getState().setAgents(agents);
      },
    });
    client.current = c;
    c.start();
    return () => {
      c.stop();
      client.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ----- submit -----
  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !client.current) return;
    pushLine({ kind: "user", text: trimmed });
    client.current.submitCommand(trimmed);
  };

  // ----- voice (3-mode state machine ported from app-legacy) -----
  const beginRecording = async (vad: boolean): Promise<boolean> => {
    if (!client.current) return false;
    if (Platform.OS === "android") {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
    client.current.startVoice();
    const ok = await startCapture({
      onChunk: (b64) => client.current?.sendVoiceChunk(b64),
      vad,
      onAutoEnd: () => {
        setRecMode(null);
        setRecording(false);
        client.current?.endVoice();
      },
    });
    if (ok) setRecording(true);
    return ok;
  };

  const finishRecording = async () => {
    setRecMode(null);
    setRecording(false);
    await stopCapture();
    client.current?.endVoice();
  };

  const autoListen = async () => {
    if (useInputStore.getState().recMode !== null) return;
    setRecMode("auto");
    const ok = await beginRecording(true);
    if (!ok) setRecMode(null);
  };

  const onMicPressIn = async () => {
    const cur = useInputStore.getState();
    if (cur.recording && cur.recMode === "tap") {
      await finishRecording();
      return;
    }
    if (cur.recording && cur.recMode === "auto") {
      await finishRecording();
      return;
    }
    pressStart.current = Date.now();
    setRecMode("hold");
    await beginRecording(false);
  };

  const onMicPressOut = async () => {
    const cur = useInputStore.getState();
    if (!cur.recording && cur.recMode === null) return;
    if (Date.now() - pressStart.current < 350) {
      setRecMode("tap");
      return;
    }
    if (cur.recMode === "hold") await finishRecording();
  };

  // ----- permission flow -----
  const respondPermission = (reqId: string, allow: boolean) => {
    client.current?.respondPermission(reqId, allow);
    useUiStore.getState().setPermRequest(null);
  };

  // ----- session switch -----
  const selectAgent = (id: string) => {
    useSessionStore.getState().setAgent(id);
    // requestAgentHistory lands on JarvisClient when Phase 15 ports the
    // feature/paseo-pixel-perfect protocol additions. Until then cast any.
    (client.current as any)?.requestAgentHistory?.(id, 50);
  };

  // ----- workspace ops (stub until daemon protocol confirms shape) -----
  const switchWorkspace = (name: string) => {
    useWorkspaceStore.getState().setWorkspaceActive(name);
    (client.current as any)?.switchWorkspace?.(name);
  };

  return {
    submit,
    onMicPressIn,
    onMicPressOut,
    respondPermission,
    selectAgent,
    switchWorkspace,
  };
}

/**
 * useStableRecMode — exposes the current RecMode for UI display without
 * causing re-renders. Read from input-store.
 */
export function readRecMode(): RecMode {
  return useInputStore.getState().recMode;
}
