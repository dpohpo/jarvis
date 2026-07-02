/**
 * MainScreen — host for the post-pairing UI.
 *
 * Phase 8: TopBar (5 interactive elements) + AgentStatusPopover + TopMenu.
 * Phase 9: Drawer wrapping LeftSidebar (8.jpg).
 * Phase 11 will swap the placeholder for ChatSurface.
 * Phase 12 will add Composer at the bottom.
 * Phase 13 will mount SettingsScreen.
 */
import { StyleSheet, Text, View } from "react-native";
import { TopBar } from "../components/top-bar";
import { LeftSidebar } from "../components/left-sidebar";
import { AgentStatusPopover } from "../components/agent-status-popover";
import { TopMenu } from "../components/top-menu";
import { Drawer } from "../lib/ui-primitives";
import { C, FS, FW } from "../theme";
import { useUiStore } from "../stores/ui-store";
import { useSessionStore } from "../stores/session-store";
import type { PhoneState } from "../store";

interface Props {
  state: PhoneState;
}

export function MainScreen({ state }: Props) {
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);
  const linkUp = useSessionStore((s) => s.linkUp);

  return (
    <View style={styles.root}>
      <TopBar />
      <View style={styles.body}>
        <Text style={styles.placeholder}>
          Phase 11 will mount ChatSurface here.{"\n"}Paired with {state.daemonDeviceId}.
        </Text>
      </View>
      <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <LeftSidebar
          hostName={state.daemonDeviceId}
          linkUp={linkUp}
          onHome={() => setDrawerOpen(false)}
        />
      </Drawer>
      <AgentStatusPopover />
      <TopMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  placeholder: { color: C.fgSubtle, fontSize: FS.sm, fontWeight: FW.regular, textAlign: "center", lineHeight: 22 },
});

