/**
 * Slash Autocomplete — command picker triggered by `/`.
 *
 * Commands:
 *   - /clear — Clear conversation
 *   - /agents — Switch agent
 *   - /settings — Open settings
 *   - /new — New conversation
 *   - /help — Show help
 *
 * Paseo-style: popover above input, icon + name + description.
 */

import React from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { DARK, SP, RD, FS, FW, SH } from "../../theme";

const C = DARK;

interface Command {
  icon: string;
  name: string;
  description: string;
  action: () => void;
}

const COMMANDS: Command[] = [
  { icon: "🗑️", name: "clear", description: "清空对话", action: () => {} },
  { icon: "🤖", name: "agents", description: "切换 Agent", action: () => {} },
  { icon: "⚙️", name: "settings", description: "打开设置", action: () => {} },
  { icon: "✨", name: "new", description: "新对话", action: () => {} },
  { icon: "❓", name: "help", description: "帮助", action: () => {} },
];

interface Props {
  visible: boolean;
  onSelect: (command: Command) => void;
  position: { x: number; y: number };
}

export function SlashAutocomplete(props: Props): React.JSX.Element | null {
  if (!props.visible) return null;

  return (
    <View style={[styles.popover, { top: props.position.y - 220 }]}>
      <FlatList
        data={COMMANDS}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => props.onSelect(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.textContainer}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: "absolute",
    left: SP[3],
    width: 280,
    maxHeight: 200,
    backgroundColor: C.surface2,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: C.border,
    ...SH.md,
    zIndex: 100,
  },
  list: {
    paddingVertical: SP[2],
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    color: C.fg,
    fontSize: FS.sm,
    fontWeight: FW.medium,
  },
  description: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: SP[3],
    marginTop: SP[2],
  },
});
