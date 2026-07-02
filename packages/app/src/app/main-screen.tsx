/**
 * MainScreen — host for the post-pairing UI.
 *
 * Phase 14 wires useJarvis hook for full business integration.
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
import { PermissionModal } from "../components/permission-modal";
import { BusyBanner } from "../components/busy-banner";
import { SettingsScreen } from "./settings-screen";
import { Drawer } from "../lib/ui-primitives";
import { C } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useSessionStore } from "../stores/session-store";
import { useWorkspaceStore } from "../stores/workspace-store";
import { useInputStore } from "../stores/input-store";
import { useJarvis } from "../hooks/use-jarvis";
import type { PhoneState } from "../store";

interface Props {
  state: PhoneState;
}

export function MainScreen({ state }: Props) {
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);
  const linkUp = useSessionStore((s) => s.linkUp);
  const hasProjects = useWorkspaceStore((s) => s.workspaceList.length > 0);
  const setInput = useInputStore((s) => s.setInput);

  const jarvis = useJarvis(state);

  return (
    <View style={styles.root}>
      <TopBar />
      <BusyBanner onStop={() => jarvis.stopTask()} />
      <View style={styles.body}>
        {hasProjects ? <ChatSurface /> : <EmptyMain />}
      </View>
      <Composer
        onSubmit={(t) => {
          jarvis.submit(t);
          setInput("");
        }}
        onMicPressIn={() => void jarvis.onMicPressIn()}
        onMicPressOut={() => void jarvis.onMicPressOut()}
      />
      <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <LeftSidebar
          hostName={state.daemonDeviceId}
          linkUp={linkUp}
          onHome={() => setDrawerOpen(false)}
          onRename={(oldName, newName) => jarvis.renameAgent(oldName, newName)}
          onArchive={(name) => {
            // Archive mirrors to delete until a separate archived section exists.
            jarvis.deleteAgent(name);
          }}
          onDelete={(name) => jarvis.deleteAgent(name)}
        />
      </Drawer>
      <AddProjectSheet
        onCreate={(name, cfg) => jarvis.createWorkspace(name, cfg)}
      />
      <ProviderPicker />
      <SessionPicker onSelect={(id) => jarvis.selectAgent(id)} />
      <AgentStatusPopover />
      <TopMenu />
      <SettingsScreen />
      <PermissionModal onRespond={jarvis.respondPermission} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1 },
});
