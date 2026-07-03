/**
 * App.tsx — v2 entry.
 *
 * Phase 15-v11: boot now proactively requests CAMERA + RECORD_AUDIO
 * permissions once, on first run after install / pm clear. Android
 * persists the grant across launches after that, so the user only sees
 * the system prompt once instead of every time they hit the QR scanner
 * or mic button.
 *
 * Phase 15-v5: boot restores workspace-store (project list + agents)
 * from SecureStore so app restart / phone reboot doesn't drop the
 * user's project list.
 */
import { useEffect, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { ensureCrypto } from "./src/crypto-init";
import { loadState, type PhoneState } from "./src/store";
import { loadSettings, useSettingsStore } from "./src/stores/settings-store";
import { loadWorkspace, useWorkspaceStore } from "./src/stores/workspace-store";
import { useSessionStore } from "./src/stores/session-store";
import { LoadingScreen } from "./src/app/loading-screen";
import { LoginScreen } from "./src/app/login-screen";
import { MainScreen } from "./src/app/main-screen";

/** Ask the OS for CAMERA + RECORD_AUDIO on first run. Idempotent — Android
 *  returns GRANTED immediately if the user already approved. We bundle both
 *  into one PermissionsAndroid.requestMultiple call so the user sees one
 *  system dialog instead of two. */
async function ensureCorePermissions(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
  } catch (e) {
    console.warn("[perm] requestMultiple failed:", String(e));
  }
}

export default function App() {
  return <Root />;
}

function Root() {
  const [booted, setBooted] = useState(false);
  const [state, setState] = useState<PhoneState | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureCrypto();
      await ensureCorePermissions();
      const [s, settings, workspace] = await Promise.all([
        loadState(),
        loadSettings(),
        loadWorkspace(),
      ]);
      setState(s);
      useSettingsStore.setState({ settings, ready: true });
      if (workspace) {
        useWorkspaceStore.setState({
          workspaceActive: workspace.workspaceActive,
          workspaceList: workspace.workspaceList,
          agents: workspace.agents,
        });
      }
      // Restore last conversation — reads jarvis_last_agent from
      // AsyncStorage, calls setAgent(id) → hydrateForAgent loads
      // the per-agent chat lines. Without this, app restart always
      // shows empty chat even though AsyncStorage has the data.
      await useSessionStore.getState().restoreLastAgent();
      setBooted(true);
    })();
  }, []);

  if (!booted) return <LoadingScreen />;
  if (!state) return <LoginScreen onPaired={setState} />;
  return <MainScreen state={state} />;
}
