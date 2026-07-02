/**
 * App.tsx — v2 entry (Phase 4 + Phase 6 settings + Phase 7 LoginScreen onPaired).
 */
import { useEffect, useState } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ensureCrypto } from "./src/crypto-init";
import { loadState, type PhoneState } from "./src/store";
import { loadSettings, useSettingsStore } from "./src/stores/settings-store";
import { LoadingScreen } from "./src/app/loading-screen";
import { LoginScreen } from "./src/app/login-screen";
import { MainScreen } from "./src/app/main-screen";

export default function App() {
  return (
    <KeyboardProvider>
      <Root />
    </KeyboardProvider>
  );
}

function Root() {
  const [booted, setBooted] = useState(false);
  const [state, setState] = useState<PhoneState | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureCrypto();
      const [s, settings] = await Promise.all([loadState(), loadSettings()]);
      setState(s);
      useSettingsStore.setState({ settings, ready: true });
      setBooted(true);
    })();
  }, []);

  if (!booted) return <LoadingScreen />;
  if (!state) return <LoginScreen onPaired={setState} />;
  return <MainScreen state={state} />;
}
