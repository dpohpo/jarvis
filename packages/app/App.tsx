/**
 * App.tsx — v2 entry (Phase 4 + Phase 6 settings load).
 *
 * Responsibilities (kept narrow on purpose):
 *  1. crypto-init once at boot
 *  2. load PhoneState (pairing) from SecureStore
 *  3. load AppSettings (theme/provider/autoWake etc.) from SecureStore
 *  4. branch: not-booted → LoadingScreen | not-paired → LoginScreen | else → MainScreen
 *
 * All legacy business state/effects/handlers from the 570-line MVP now live
 * in ./src/legacy/app-legacy.tsx as a reference. Phase 7 ports PairingScreen,
 * Phase 8 ports ConsoleScreen, Phase 14 ports voice/wakeword/client hooks.
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
  const setSettingsReady = useSettingsStore((s) => s.setReady);

  useEffect(() => {
    void (async () => {
      await ensureCrypto();
      const [s, settings] = await Promise.all([loadState(), loadSettings()]);
      setState(s);
      useSettingsStore.setState({ settings, ready: true });
      setSettingsReady(true);
      setBooted(true);
    })();
  }, [setSettingsReady]);

  if (!booted) return <LoadingScreen />;
  if (!state) return <LoginScreen />;
  return <MainScreen state={state} />;
}

