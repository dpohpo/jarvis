/**
 * App.tsx — v2 entry.
 *
 * Phase 15: dropped react-native-keyboard-controller (was dragging in
 * reanimated + worklets which CMake-build fail on exFAT). RN's built-in
 * KeyboardAvoidingView handles the Android keyboard fine for our 2 input
 * fields (composer + manual JSON pair).
 *
 * Phase 15-v5: boot now restores workspace-store (project list + agents)
 * from SecureStore so app restart / phone reboot doesn't drop the user's
 * project list and show "Welcome to Jarvis" empty state every time.
 */
import { useEffect, useState } from "react";
import { ensureCrypto } from "./src/crypto-init";
import { loadState, type PhoneState } from "./src/store";
import { loadSettings, useSettingsStore } from "./src/stores/settings-store";
import { loadWorkspace, useWorkspaceStore } from "./src/stores/workspace-store";
import { LoadingScreen } from "./src/app/loading-screen";
import { LoginScreen } from "./src/app/login-screen";
import { MainScreen } from "./src/app/main-screen";

export default function App() {
  return <Root />;
}

function Root() {
  const [booted, setBooted] = useState(false);
  const [state, setState] = useState<PhoneState | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureCrypto();
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
      setBooted(true);
    })();
  }, []);

  if (!booted) return <LoadingScreen />;
  if (!state) return <LoginScreen onPaired={setState} />;
  return <MainScreen state={state} />;
}

