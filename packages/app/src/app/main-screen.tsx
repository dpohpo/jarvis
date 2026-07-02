/**
 * MainScreen — Phase 8+ fills this in (chat surface + sidebar + composer).
 * Phase 4 placeholder.
 */
import { View, Text } from "react-native";
import { C, FS, FW } from "../theme";
import type { PhoneState } from "../store";

export function MainScreen({ state }: { state: PhoneState }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: C.fg, fontSize: FS.xl, fontWeight: FW.semibold }}>Main placeholder</Text>
      <Text style={{ color: C.fgSubtle, fontSize: FS.sm, marginTop: 8 }}>
        Paired with {state.daemonDeviceId} · Phase 8 will render TopBar + ChatSurface
      </Text>
    </View>
  );
}
