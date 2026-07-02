/**
 * UI store — overlay visibility flags.
 *
 * Every overlay primitive in src/lib/ui-primitives.tsx is bound to one of
 * these flags. Components call open() / close() rather than passing
 * `visible` props around.
 */
import { create } from "zustand";

export type SettingsSection =
  | "general"
  | "appearance"
  | "permissions"
  | "diagnostics"
  | "about"
  | "connections"
  | "agents"
  | "workspaces"
  | "providers"
  | "usage"
  | "terminals"
  | "host";

interface UiState {
  drawerOpen: boolean;            // LeftSidebar (8.jpg)
  providerPickerOpen: boolean;    // 3.1.jpg
  sessionPickerOpen: boolean;     // 7.jpg
  addProjectOpen: boolean;        // 2.1.jpg
  settingsOpen: boolean;          // 8.2.jpg
  settingsSection: SettingsSection | null;  // null = list view, set = section detail
  topMenuOpen: boolean;           // 6.jpg
  agentStatusOpen: boolean;       // 5.jpg
  attachMenuOpen: boolean;        // 3.2.jpg (Composer + button)
  permRequest: { reqId: string; tier: number; summary: string; detail: string } | null;
  setDrawerOpen: (v: boolean) => void;
  setProviderPickerOpen: (v: boolean) => void;
  setSessionPickerOpen: (v: boolean) => void;
  setAddProjectOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setSettingsSection: (s: SettingsSection | null) => void;
  setTopMenuOpen: (v: boolean) => void;
  setAgentStatusOpen: (v: boolean) => void;
  setAttachMenuOpen: (v: boolean) => void;
  setPermRequest: (r: UiState["permRequest"]) => void;
  closeAll: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  drawerOpen: false,
  providerPickerOpen: false,
  sessionPickerOpen: false,
  addProjectOpen: false,
  settingsOpen: false,
  settingsSection: null,
  topMenuOpen: false,
  agentStatusOpen: false,
  attachMenuOpen: false,
  permRequest: null,
  setDrawerOpen: (v) => set({ drawerOpen: v }),
  setProviderPickerOpen: (v) => set({ providerPickerOpen: v }),
  setSessionPickerOpen: (v) => set({ sessionPickerOpen: v }),
  setAddProjectOpen: (v) => set({ addProjectOpen: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setSettingsSection: (s) => set({ settingsSection: s }),
  setTopMenuOpen: (v) => set({ topMenuOpen: v }),
  setAgentStatusOpen: (v) => set({ agentStatusOpen: v }),
  setAttachMenuOpen: (v) => set({ attachMenuOpen: v }),
  setPermRequest: (r) => set({ permRequest: r }),
  closeAll: () =>
    set({
      drawerOpen: false,
      providerPickerOpen: false,
      sessionPickerOpen: false,
      addProjectOpen: false,
      settingsOpen: false,
      topMenuOpen: false,
      agentStatusOpen: false,
      attachMenuOpen: false,
    }),
}));
