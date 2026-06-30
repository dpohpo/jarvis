/**
 * Host Picker component — displays current daemon host with status.
 *
 * Shows:
 *   - Current host name (e.g., "jarvis-daemon")
 *   - Status dot (online/offline/connecting)
 *   - Expandable list (stub for single host)
 *
 * Paseo-style: compact, inline, no modal.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { DARK, SP, RD, FS, FW } from "../theme";

const C = DARK;

interface Props {
  hostName: string;
  status: "online" | "offline" | "connecting";
  onSwitchHost?: (hostId: string) => void;
  onAddHost?: () => void;
}

export function HostPicker(props: Props): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);

  const statusColor =
    props.status === "online"
      ? C.statusSuccess
      : props.status === "connecting"
        ? C.statusWarning
        : C.statusDanger;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.hostName}>{props.hostName}</Text>
        <Text style={styles.chevron}>{expanded ? "▼" : "▶"}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.dropdown}>
          {/* Current host (selected) */}
          <View style={styles.hostItem}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.hostItemText, styles.hostItemActive]}>
              {props.hostName}
            </Text>
            <Text style={styles.checkmark}>✓</Text>
          </View>

          {/* Add host stub */}
          <TouchableOpacity
            style={styles.addHostBtn}
            onPress={props.onAddHost}
            activeOpacity={0.7}
          >
            <Text style={styles.addHostIcon}>+</Text>
            <Text style={styles.addHostText}>添加 Host</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    paddingVertical: SP[2],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: RD.full,
  },
  hostName: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: FW.medium,
  },
  chevron: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    marginLeft: SP[1],
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: C.surface2,
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: SP[1],
    padding: SP[2],
    zIndex: 10,
  },
  hostItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    padding: SP[2],
    borderRadius: RD.sm,
  },
  hostItemText: {
    color: C.fgMuted,
    fontSize: FS.sm,
  },
  hostItemActive: {
    color: C.fg,
    fontWeight: FW.medium,
  },
  checkmark: {
    color: C.accent,
    fontSize: FS.sm,
    marginLeft: "auto",
  },
  addHostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    padding: SP[2],
    borderRadius: RD.sm,
    marginTop: SP[1],
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "dashed" as const,
  },
  addHostIcon: {
    color: C.fgSubtle,
    fontSize: FS.sm,
    fontWeight: FW.semibold,
  },
  addHostText: {
    color: C.fgSubtle,
    fontSize: FS.sm,
  },
});
