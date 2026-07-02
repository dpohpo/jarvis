/**
 * PermissionModal — wired to ui-store.permRequest.
 *
 * 3.5.jpg-style approval card. When client.onPermRequest fires, the
 * hook writes the request into ui-store and this modal mounts. User
 * taps 批准 / 拒绝 → useJarvis.respondPermission(reqId, allow).
 */
import { Modal, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, FW, RD, SP } from "../theme";
import { useUiStore } from "../stores/ui-store";

interface Props {
  onRespond: (reqId: string, allow: boolean) => void;
}

export function PermissionModal({ onRespond }: Props) {
  const perm = useUiStore((s) => s.permRequest);
  return (
    <Modal visible={perm !== null} transparent animationType="fade" onRequestClose={() => perm && onRespond(perm.reqId, false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>🔐 Tier {perm?.tier} 操作审批</Text>
          <Text style={styles.summary}>{perm?.summary}</Text>
          <Text style={styles.detail}>{perm?.detail}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnDeny]}
              onPress={() => perm && onRespond(perm.reqId, false)}
            >
              <Text style={styles.btnDenyText}>拒绝</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnApprove]}
              onPress={() => perm && onRespond(perm.reqId, true)}
            >
              <Text style={styles.btnApproveText}>批准</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: C.backdrop,
    alignItems: "center",
    justifyContent: "center",
    padding: SP[5],
  } as ViewStyle,
  card: {
    backgroundColor: C.surface2,
    borderRadius: RD.xl,
    padding: SP[4],
    width: "100%",
  } as ViewStyle,
  title: { color: C.fg, fontSize: FS.lg, fontWeight: FW.bold },
  summary: { color: C.fgMuted, fontSize: FS.sm, marginTop: SP[2] },
  detail: { color: C.fgSubtle, fontSize: FS.xs, marginTop: SP[1], lineHeight: 19 },
  row: { flexDirection: "row", gap: SP[2], marginTop: SP[4] } as ViewStyle,
  btn: { flex: 1, paddingVertical: SP[3], borderRadius: RD.lg, alignItems: "center" } as ViewStyle,
  btnDeny: { backgroundColor: C.surface1 } as ViewStyle,
  btnApprove: { backgroundColor: C.accent } as ViewStyle,
  btnDenyText: { color: C.destructive, fontSize: FS.base, fontWeight: FW.semibold },
  btnApproveText: { color: C.accentForeground, fontSize: FS.base, fontWeight: FW.semibold },
});
