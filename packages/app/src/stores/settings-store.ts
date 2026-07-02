/**
 * Settings store — user preferences, persisted across app restarts.
 *
 * Persistence: backed by expo-secure-store (already in deps). We re-use
 * the same secure-storage primitive as PhoneState (./store.ts) — but
 * under a different key — so a single key wipe (clearState) does NOT
 * lose user preferences. Re-pairing the daemon keeps your theme choice.
 *
 * Phase 13 screens read/write these fields. Phase 6 just defines the
 * schema + load/save helpers.
 */
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export type ThemeName = "dark" | "light" | "system";
export type Provider = "claude" | "codex" | "copilot" | "gemini";
export type Mode = "plan" | "code" | "ask";

export interface AppSettings {
  theme: ThemeName;
  fontScale: number;             // 1.0 default; Appearance section adjusts
  defaultProvider: Provider;
  defaultModel: Partial<Record<Provider, string>>;
  defaultMode: Mode;
  autoWake: boolean;             // start wakeword listener on boot
  convMode: boolean;             // TTS auto-listen chain
  recentHosts: string[];         // daemonDeviceId history for Connections
  defaultSpawnMode: "spawn" | "tmux";
  defaultEngine: Provider;       // default workspace engine
  scrollbackLines: number;       // terminal scrollback (General section)
}

const DEFAULTS: AppSettings = {
  theme: "dark",
  fontScale: 1.0,
  defaultProvider: "claude",
  defaultModel: { claude: "claude-sonnet-4-6", codex: "gpt-5" },
  defaultMode: "code",
  autoWake: true,
  convMode: false,
  recentHosts: [],
  defaultSpawnMode: "tmux",
  defaultEngine: "claude",
  scrollbackLines: 5000,
};

const KEY = "jarvis.settings.v1";

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  } catch (e) {
    console.warn("[settings] failed to persist:", e);
  }
}

interface SettingsState {
  ready: boolean;
  settings: AppSettings;
  setReady: (v: boolean) => void;
  patch: (p: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ready: false,
  settings: DEFAULTS,
  setReady: (v) => set({ ready: v }),
  patch: (p) => {
    const next = { ...get().settings, ...p };
    set({ settings: next });
    void saveSettings(next);
  },
}));
