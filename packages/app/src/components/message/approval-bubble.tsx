/**
 * ApprovalBubble — inline approval card rendered inside the chat surface.
 *
 * Phase 15-v10: daemon now emits task.event ev:"approval" in parallel
 * with the legacy perm.request modal. This component is the chat-side
 * rendering: a card with summary/detail and Approve/Deny buttons that
 * call the same respondPermission the modal uses (registered on the UI
 * store by useJarvis so we don't need prop drilling through ChatSurface
 * → ChatBubble).
 *
 * Visual states:
 *   - waiting: amber-tinted card, both buttons enabled.
 *   - resolved: card dims, the tapped button stays highlighted, the
 *     other goes invisible. A footer line shows the outcome so users
 *     scrolling back through chat can see what happened.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, FW, RD, SP } from "../../theme";
import type { Bubble } from "../../stores/session-store";
import { useUiStore } from "../../stores/ui-store";

export function ApprovalBubble({ bubble }: { bubble: Bubble }) {
  const ap = bubble.approval;
  const [resolved, setResolved] = useState<"allow" | "deny" | null>(null);
  if (!ap) return null;

  const respond = (allow: boolean) => {
    if (resolved) return; // double-tap guard
    setResolved(allow ? "allow" : "deny");
    useUiStore.getState().respondPermission?.(ap.reqId, allow);
  };

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.badge}>⚠ 需审批</Text>
          <Text style={styles.tier}>Tier {ap.tier}</Text>
        </View>
        <Text style={styles.summary}>{ap.summary}</Text>
        {ap.detail ? <Text style={styles.detail}>{ap.detail}</Text> : null}
        <View style={styles.buttonRow}>
          <Pressable
            style={[
              styles.btn,
              styles.btnDeny,
              resolved === "allow" && styles.btnHidden,
              resolved === "deny" && styles.btnResolved,
            ]}
            disabled={resolved !== null}
            onPress={() => respond(false)}
          >
            <Text style={styles.btnDenyText}>
              {resolved === "deny" ? "已拒绝" : "拒绝"}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.btn,
              styles.btnApprove,
              resolved === "deny" && styles.btnHidden,
              resolved === "allow" && styles.btnResolved,
            ]}
            disabled={resolved !== null}
            onPress={() => respond(true)}
          >
            <Text style={styles.btnApproveText}>
              {resolved === "allow" ? "已批准 ✓" : "批准"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: SP[2],
  } as ViewStyle,
  card: {
    backgroundColor: C.surface1,
    borderColor: "#f59e0b", // amber-500 — warning, not error (red)
    borderWidth: 1,
    borderRadius: RD.xl,
    padding: SP[3],
    width: "100%",
    gap: SP[2],
  } as ViewStyle,
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,
  badge: {
    color: "#f59e0b",
    fontSize: FS.sm,
    fontWeight: FW.bold,
  },
  tier: {
    color: C.fgSubtle,
    fontSize: FS.xs,
  },
  summary: {
    color: C.fg,
    fontSize: FS.base,
    fontWeight: FW.semibold,
  },
  detail: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SP[2],
    marginTop: SP[1],
  } as ViewStyle,
  btn: {
    flex: 1,
    paddingVertical: SP[2],
    borderRadius: RD.lg,
    alignItems: "center",
  } as ViewStyle,
  btnDeny: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.destructive,
  } as ViewStyle,
  btnApprove: {
    backgroundColor: C.btnPrimary, // BLACK
  } as ViewStyle,
  btnDenyText: {
    color: C.destructive,
    fontSize: FS.base,
    fontWeight: FW.semibold,
  },
  btnApproveText: {
    color: C.btnPrimaryFg,
    fontSize: FS.base,
    fontWeight: FW.semibold,
  },
  btnResolved: {
    opacity: 0.85,
  } as ViewStyle,
  btnHidden: {
    opacity: 0.3,
  } as ViewStyle,
});
