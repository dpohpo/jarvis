/**
 * BusyBanner — appears when session-store.busy is true (task in flight).
 *
 * Shows "Jarvis is working…" + a Stop button that calls client.stopTask()
 * to cancel the current daemon-side task.
 *
 * Position: between TopBar and ChatSurface; absolute-positioned so it
 * doesn't shift the chat list layout when it appears/disappears.
 */
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Square } from "lucide-react-native";
import { C, FS, FW, RD, SP } from "../theme";
import { useSessionStore } from "../stores/session-store";

interface Props {
  onStop: () => void;
}

export function BusyBanner({ onStop }: Props) {
  const busy = useSessionStore((s) => s.busy);
  if (!busy) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.dot} />
      <Text style={styles.text}>Jarvis is working…</Text>
      <Pressable style={styles.stopBtn} onPress={onStop} hitSlop={8}>
        <Square size={12} color={C.fg} />
        <Text style={styles.stopText}>Stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    backgroundColor: C.surface1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.borderSubtle,
  } as ViewStyle,
  dot: {
    width: 8, height: 8, borderRadius: 9999,
    backgroundColor: C.statusBusy,
  } as ViewStyle,
  text: {
    flex: 1,
    color: C.fgMuted,
    fontSize: FS.sm,
    fontWeight: FW.medium,
  },
  stopBtn: {
    flexDirection: "row", alignItems: "center", gap: SP[1],
    paddingHorizontal: SP[2], paddingVertical: SP[1],
    backgroundColor: C.surface2, borderRadius: RD.sm,
  } as ViewStyle,
  stopText: {
    color: C.fg,
    fontSize: FS.xs,
    fontWeight: FW.semibold,
  },
});
