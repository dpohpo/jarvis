/**
 * MainScreen — host for the post-pairing UI.
 *
 * Phase 8: TopBar (5 interactive elements) + empty placeholder content
 *           + AgentStatusPopover + TopMenu mounts.
 * Phase 9 will add the Drawer (LeftSidebar).
 * Phase 11 will swap the placeholder for ChatSurface.
 * Phase 12 will add Composer at the bottom.
 * Phase 13 will mount SettingsScreen.
 */
import { StyleSheet, Text, View } from "react-native";
import { TopBar } from "../components/top-bar";
import { AgentStatusPopover } from "../components/agent-status-popover";
import { TopMenu } from "../components/top-menu";
import { C, FS, FW } from "../theme";
import type { PhoneState } from "../store";

interface Props {
  state: PhoneState;
}

export function MainScreen({ state }: Props) {
  return (
    <View style={styles.root}>
      <TopBar />
      <View style={styles.body}>
        <Text style={styles.placeholder}>
          Phase 11 will mount ChatSurface here.{"\n"}Paired with {state.daemonDeviceId}.
        </Text>
      </View>
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
