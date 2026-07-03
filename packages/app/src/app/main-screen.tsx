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
  const hasLines = useSessionStore((s) => s.lines.length > 0);
  const hasProjects = useWorkspaceStore((s) => s.workspaceList.length > 0);
  // Show ChatSurface as soon as EITHER projects exist OR there are chat lines
  // in the current session. Otherwise voice replies from the daemon land in
  // an invisible store while the user stares at the EmptyMain placeholder —
  // which is exactly the "I sent voice, daemon ran the task, but UI didn't
  // switch" bug.
  const showChat = hasProjects || hasLines;
  const setInput = useInputStore((s) => s.setInput);

  const jarvis = useJarvis(state);

  return (
    <View style={styles.root}>
      <TopBar />
      <BusyBanner onStop={() => jarvis.stopTask()} />
      <View style={styles.body}>
        {showChat ? <ChatSurface /> : <EmptyMain />}
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
          onSelectAgent={(id) => jarvis.selectAgent(id)}
          onRenameWorkspace={(oldName, newName) => jarvis.renameAgent(oldName, newName)}
          onDeleteWorkspace={(name: string) => jarvis.deleteAgent(name)}
          onAddSession={(ws: string) => {
            // Create a new session in this workspace
            const id = `agent-${Date.now()}`;
            useWorkspaceStore.getState().upsertAgent({ id, title: "New session", status: "idle", workspace: ws });
            jarvis.selectAgent(id);
            setDrawerOpen(false);
          }}
          onRenameAgent={(id: string, newName: string) => {
            const agent = useWorkspaceStore.getState().agents.find((a) => a.id === id);
            if (agent) useWorkspaceStore.getState().upsertAgent({ ...agent, title: newName });
          }}
          onDeleteAgent={(id: string) => {
            useWorkspaceStore.getState().removeAgent(id);
          }}
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
