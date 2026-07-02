/**
 * LoginScreen — Phase 7 will fill this in (1.jpg screenshot).
 * Phase 4 placeholder.
 */
import { View, Text } from "react-native";
import { C, FS, FW } from "../theme";

export function LoginScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: C.fg, fontSize: FS["3xl"], fontWeight: FW.bold }}>Jarvis</Text>
      <Text style={{ color: C.fgSubtle, fontSize: FS.sm, marginTop: 8 }}>Login placeholder · Phase 7</Text>
    </View>
  );
}
