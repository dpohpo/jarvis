/**
 * Paseo Host Picker — 像素级复刻版
 *
 * 真实源码：/tmp/paseo-ref/packages/app/src/components/hosts/host-picker.tsx
 *
 * Port 规则：
 * - 保留 paseo 视觉（紧凑行内，无模态框）
 * - 删除 paseo 复杂逻辑（Combobox、搜索、多 host）
 * - 适配 jarvis props 接口（单 host + 状态）
 */

import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, type PressableStateCallbackType } from "react-native";
import { Server, Settings, Plus } from "lucide-react-native";
import { DARK, SP, RD, FS, FW, SH } from "../theme";

const C = DARK;

interface Props {
  hostName: string;
  status: "online" | "offline" | "connecting";
  onSwitchHost?: (hostId: string) => void;
  onAddHost?: () => void;
  onOpenSettings?: () => void;
  // jarvis 扩展：是否显示设置按钮
  showSettings?: boolean;
}

export function HostPicker(props: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const statusColor =
    props.status === "online"
      ? C.statusSuccess
      : props.status === "connecting"
        ? C.statusWarning
        : C.statusDanger;

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handlePress = useCallback(() => {
    if (!expanded) {
      handleToggle();
    }
  }, [expanded, handleToggle]);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);

  const handleAddHost = useCallback(() => {
    props.onAddHost?.();
    setExpanded(false);
  }, [props.onAddHost]);

  const handleOpenSettings = useCallback(() => {
    props.onOpenSettings?.();
    setExpanded(false);
  }, [props.onOpenSettings]);

  const triggerStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.trigger,
      isHovered && styles.triggerHovered,
      pressed && styles.triggerPressed,
    ],
    [isHovered],
  );

  return (
    <View style={styles.container}>
      <Pressable
        style={triggerStyle}
        onPress={handlePress}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        testID="host-picker-trigger"
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.hostName}>{props.hostName}</Text>
        <View style={styles.chevronSlot}>
          {expanded ? (
            <Text style={styles.chevronText}>▼</Text>
          ) : (
            <Text style={styles.chevronText}>▶</Text>
          )}
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.dropdown} testID="host-picker-dropdown">
          {/* Current host */}
          <View style={styles.hostItem}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.hostItemText, styles.hostItemActive]}>
              {props.hostName}
            </Text>
            <Text style={styles.checkmark}>✓</Text>
          </View>

          {/* Settings */}
          {props.showSettings && props.onOpenSettings && (
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={handleOpenSettings}
              testID="host-picker-settings"
            >
              <Settings size={14} color={C.fgMuted} />
              <Text style={styles.menuItemText}>Settings</Text>
            </Pressable>
          )}

          {/* Add host */}
          {props.onAddHost && (
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={handleAddHost}
              testID="host-picker-add-host"
            >
              <Plus size={14} color={C.fgMuted} />
              <Text style={styles.menuItemText}>Add host</Text>
            </Pressable>
          )}
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
    paddingHorizontal: SP[2],
    borderRadius: RD.md,
  },
  triggerHovered: {
    backgroundColor: C.surfaceSidebarHover,
  },
  triggerPressed: {
    backgroundColor: C.surface2,
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
    flex: 1,
  },
  chevronSlot: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronText: {
    color: C.fgSubtle,
    fontSize: FS.xs,
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
    ...SH.sm,
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
    flex: 1,
  },
  hostItemActive: {
    color: C.fg,
    fontWeight: FW.medium,
  },
  checkmark: {
    color: C.accent,
    fontSize: FS.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    padding: SP[2],
    borderRadius: RD.sm,
  },
  menuItemPressed: {
    backgroundColor: C.surfaceSidebarHover,
  },
  menuItemText: {
    color: C.fgMuted,
    fontSize: FS.sm,
  },
});
