/**
 * MainScreen — host for the post-pairing UI.
 *
 * Phase 8:  TopBar + AgentStatusPopover + TopMenu
 * Phase 9:  Drawer (LeftSidebar, 8.jpg)
 * Phase 10: EmptyMain body (2.jpg) when no projects + AddProjectSheet (2.1.jpg)
 * Phase 11 will swap EmptyMain for ChatSurface when there are messages.
 * Phase 12 will mount Composer at the bottom.
 * Phase 13 will mount SettingsScreen.
 */
import { StyleSheet, View } from "react-native";
import { TopBar } from "../components/top-bar";
import { LeftSidebar } from "../components/left-sidebar";
import { EmptyMain } from "../components/empty-main";
import { ChatSurface } from "../components/chat-surface";
import { Composer } from "../components/composer";
import { AddProjectSheet } from "../components/add-project-sheet";
import { ProviderPicker } from "../components/provider-picker";
import { SessionPicker } from "../components/session-picker";
import { AgentStatusPopover } from "../components/agent-status-popover";
import { TopMenu } from "../components/top-menu";
import { SettingsScreen } from "./settings-screen";
import { Drawer } from "../lib/ui-primitives";
import { C } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useSessionStore } from "../stores/session-store";
import { useWorkspaceStore } from "../stores/workspace-store";
import type { PhoneState } from "../store";

interface Props {
  state: PhoneState;
}

export function MainScreen({ state }: Props) {
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);
  const linkUp = useSessionStore((s) => s.linkUp);
  const hasProjects = useWorkspaceStore((s) => s.workspaceList.length > 0);
  const setAgent = useSessionStore((s) => s.setAgent);

  return (
    <View style={styles.root}>
      <TopBar />
      <View style={styles.body}>
        {hasProjects ? <ChatSurface /> : <EmptyMain />}
      </View>
      <Composer
        onSubmit={() => {
          /* Phase 14 wires client.submitCommand */
        }}
        onMicPressIn={() => {
          /* Phase 14 wires beginRecording */
        }}
        onMicPressOut={() => {
          /* Phase 14 wires finishRecording */
        }}
      />
      <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <LeftSidebar
          hostName={state.daemonDeviceId}
          linkUp={linkUp}
          onHome={() => setDrawerOpen(false)}
        />
      </Drawer>
      <AddProjectSheet />
      <ProviderPicker />
      <SessionPicker onSelect={(id) => setAgent(id)} />
      <AgentStatusPopover />
      <TopMenu />
      <SettingsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1 },
});


