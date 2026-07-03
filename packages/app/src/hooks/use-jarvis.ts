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
import { initWake, startListening, destroyWake } from "../wakeword";
import type { PhoneState } from "../store";
import { useSessionStore } from "../stores/session-store";
import { useWorkspaceStore, type Agent, type AgentStatus } from "../stores/workspace-store";
import { useInputStore, type RecMode } from "../stores/input-store";
import { saveSettings, useSettingsStore } from "../stores/settings-store";
import { useUiStore } from "../stores/ui-store";

const AUTO_LISTEN_DELAY_MS = 500;

/** TaskEvent status → AgentStatus mapping for sidebar dots. */
function statusFromEvent(e: TaskEvent["ev"]): AgentStatus | null {
  if (e === "started") return "running";
  if (e === "done") return "done";
  if (e === "error") return "error";
  return null;
}

/** Map a daemon TaskSummary.status to the app's AgentStatus enum.
 *  Daemon: running | waiting_approval | paused | done | error.
 *  App:    idle | running | done | error | needs_input | attention. */
function mapDaemonStatus(s: string): AgentStatus {
  switch (s) {
    case "running": return "running";
    case "waiting_approval": return "needs_input";
    case "paused": return "idle";
    case "done": return "done";
    case "error": return "error";
    default: return "idle";
  }
}

export function useJarvis(state: PhoneState) {
  const client = useRef<JarvisClient | null>(null);
  const pressStart = useRef(0);

  const pushLine = useSessionStore((s) => s.pushLine);
  const setLinkUp = useSessionStore((s) => s.setLinkUp);
  const linkUp = useSessionStore((s) => s.linkUp);
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
        // Use t.title as agent id (NOT t.taskId). taskId is a per-spawn
        // ulid that changes every time the daemon re-emits task.state —
        // if we used it as AsyncStorage key, the phone would never find
        // previously-saved chat lines after an app restart. title is the
        // human-readable agent/workspace name which stays stable across
        // daemon restarts, so AsyncStorage key = title → chat history
        // survives.
        const agents: Agent[] = tasks.map((t) => ({
          id: t.title,
          title: t.title,
          status: mapDaemonStatus(t.status),
        }));
        useWorkspaceStore.getState().setAgents(agents);
      },
    });
    client.current = c;
    c.start();

    // Session recovery: as soon as the link comes up, pull the daemon's
    // current task list so the sidebar / session picker reflects what's
    // actually running on the Mac. onTaskState callback above will fire
    // and replace the local agent list with the daemon's snapshot.
    // We retry on a timer because linkUp is async (depends on relay round-
    // trip); 2s × 3 attempts is a reasonable backoff for cold start.
    let cancelled = false;
    const tryPull = (attempt: number) => {
      if (cancelled || !client.current) return;
      if (attempt > 3) return;
      // requestTaskList is a no-op if the link isn't up yet; the daemon
      // simply won't reply. The onLink(true) callback is what tells us
      // the channel is ready — schedule one pull there.
      setTimeout(() => {
        if (cancelled) return;
        if (useSessionStore.getState().linkUp) {
          client.current?.requestTaskList();
        } else {
          tryPull(attempt + 1);
        }
      }, 600 * attempt);
    };
    tryPull(1);

    return () => {
      cancelled = true;
      c.stop();
      client.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // First-link-up hook: when linkUp flips false→true, immediately request
  // the task list so the user sees their sessions restored.
  useEffect(() => {
    if (linkUp && client.current) {
      client.current.requestTaskList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkUp]);

  // Wake-word auto-init. SherpaWake needs no AccessKey (offline model
  // bundled in modules/sherpa-wake/android/src/main/assets/). When the
  // user has settings.autoWake=true, we initialize on first link-up and
  // start listening. On wake, we kick the same autoListen chain that
  // VAD auto-mode uses, so the user can say "Jarvis" → speak prompt →
  // hear TTS → "Jarvis" → speak again, fully hands-free.
  //
  // Phase 15-v7: re-enabled after fixing autolinking (app.json now sets
  // expo.autolinking.nativeModulesDir = "./modules" so prebuild picks up
  // sherpa-wake + sherpa-vad). Lazy Proxy in modules/sherpa-wake/index.ts
  // still degrades gracefully to no-op if the native side isn't present.
  useEffect(() => {
    if (!settings.autoWake || !linkUp) return;
    let cancelled = false;
    void (async () => {
      const ok = await initWake(() => {
        void autoListen();
      });
      if (cancelled) return;
      if (ok) await startListening();
    })();
    return () => {
      cancelled = true;
      void destroyWake();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoWake, linkUp]);

  // ----- submit -----
  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !client.current) return;
    pushLine({ kind: "user", text: trimmed });
    client.current.submitCommand(trimmed);
  };

  // ----- task control -----
  const stopTask = (taskId?: string) => {
    client.current?.stopTask(taskId);
  };

  const requestTaskList = () => {
    client.current?.requestTaskList();
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
    // No main-branch payload for history fetch — submit a slash command
    // so the daemon has a chance to dump history when it upgrades.
    client.current?.submitCommand(`/history ${id} 50`);
  };

  // ----- workspace ops (stub until daemon protocol confirms shape) -----
  const switchWorkspace = (name: string) => {
    useWorkspaceStore.getState().setWorkspaceActive(name);
    client.current?.submitCommand(`/workspace.switch ${name}`);
  };

  // ----- create project (AddProjectSheet Create button) -----
  // Sends the new project's name + spawn config to the daemon so the agent
  // there starts up. Also pushes a local "system" line so the chat surface
  // shows the create event immediately, before the daemon's task event.
  const createWorkspace = (
    name: string,
    cfg: { spawnMode: "spawn" | "tmux"; engine: string; tmuxTarget?: string },
  ) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    useWorkspaceStore.getState().addWorkspace(trimmed);
    useWorkspaceStore.getState().setWorkspaceActive(trimmed);
    // Daemon: best-effort — submit a slash command so the daemon has a
    // record of the create intent. Future daemon upgrades will parse
    // /workspace.create and spawn the agent with the chosen engine/mode.
    client.current?.submitCommand(
      `/workspace.create ${trimmed} ${cfg.engine} ${cfg.spawnMode}`.trim(),
    );
    useSessionStore.getState().pushLine({
      kind: "system",
      text: `Created project "${trimmed}"`,
    });
  };

  // ----- agent rename / delete (ProjectContextMenu) -----
  // Note: main-branch protocol does NOT yet carry agent.rename / workspace.*
  // payloads (only cmd.submit / task.* / voice.* / pair.*). So these methods
  // update local stores immediately for visual feedback, AND wrap the action
  // as a slash command via submitCommand so the daemon can at least log it
  // and (future daemon upgrade) parse + execute. Local-first keeps the UX
  // responsive even when the daemon doesn't yet understand.
  const renameAgent = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Local: rename workspace + propagate to agents belonging to it
    useWorkspaceStore.getState().renameWorkspace(id, trimmed);
    // Daemon: best-effort slash command (daemon may not yet parse /rename)
    client.current?.submitCommand(`/rename ${id} ${trimmed}`);
  };

  const deleteAgent = (id: string) => {
    // Local: remove workspace + its agents
    useWorkspaceStore.getState().removeWorkspace(id);
    // Daemon: best-effort slash command
    client.current?.submitCommand(`/delete ${id}`);
    // If the deleted agent was selected, drop the selection so the chat
    // surface clears on next render.
    const cur = useSessionStore.getState().currentAgentId;
    if (cur === id) useSessionStore.getState().setAgent("");
  };

  // ----- provider/model/mode apply (ProviderPicker Apply button) -----
  // Persists the selection so it survives app restart, then notifies the
  // daemon via submitCommand (best-effort — main-branch protocol has no
  // provider.switch payload; daemon may parse /provider.set if upgraded).
  const applyProvider = (
    provider: string,
    model: string,
    mode: string,
  ) => {
    const next = {
      ...settings,
      defaultProvider: provider as any,
      defaultModel: model as any,
      defaultMode: mode as any,
    };
    useSettingsStore.setState({ settings: next });
    void saveSettings(next);
    client.current?.submitCommand(`/provider.set ${provider} ${model} ${mode}`);
  };

  return {
    submit,
    stopTask,
    requestTaskList,
    onMicPressIn,
    onMicPressOut,
    respondPermission,
    selectAgent,
    switchWorkspace,
    createWorkspace,
    renameAgent,
    deleteAgent,
    applyProvider,
  };
}

/**
 * useStableRecMode — exposes the current RecMode for UI display without
 * causing re-renders. Read from input-store.
 */
export function readRecMode(): RecMode {
  return useInputStore.getState().recMode;
}
