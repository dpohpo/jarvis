/**
 * Command Center — Cmd+K palette for quick navigation & actions.
 *
 * Features:
 * - Search box with fuzzy filtering
 * - Keyboard navigation (↑/↓/Enter)
 * - Command categories (navigate / action / slash)
 * - Icons + titles + subtitles + shortcuts
 */

import { useState, useEffect, useRef } from "react";
import {
  Modal,
  Pressable,
  TextInput,
  View,
  Text,
  FlatList,
  StyleSheet,
} from "react-native";
import { DARK, SP, FS, FW, RD } from "../theme";
import type { Command } from "../lib/commands-registry";

// Alias DARK tokens for inline style usage
const C = DARK;

interface CommandCenterProps {
  visible: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandCenter({ visible, onClose, commands }: CommandCenterProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<TextInput>(null);

  // Filter commands by search text
  const filteredCommands = commands.filter((cmd) => {
    const query = search.toLowerCase();
    const titleMatch = cmd.title.toLowerCase().includes(query);
    const subtitleMatch = cmd.subtitle?.toLowerCase().includes(query) ?? false;
    const typeMatch = cmd.type.toLowerCase().includes(query);
    return titleMatch || subtitleMatch || typeMatch;
  });

  // Focus search input when modal opens
  useEffect(() => {
    if (visible) {
      setSearch("");
      setSelectedIndex(0);
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Handle keyboard selection
  const handleKeyDown = (e: any) => {
    if (e.nativeEvent.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.nativeEvent.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.nativeEvent.key === "Enter") {
      e.preventDefault();
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        cmd.handler();
        onClose();
      }
    }
  };

  const executeCommand = (cmd: Command) => {
    cmd.handler();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {/* Search input */}
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="搜索命令..."
              placeholderTextColor={DARK.fgSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              onKeyPress={handleKeyDown}
            />
          </View>

          {/* Command list */}
          <FlatList
            style={styles.list}
            data={filteredCommands}
            keyExtractor={(cmd) => cmd.id}
            renderItem={({ item: cmd, index }) => {
              const isSelected = index === selectedIndex;
              return (
                <Pressable
                  style={[styles.commandRow, isSelected && styles.commandRowSelected]}
                  onPress={() => executeCommand(cmd)}
                >
                  <Text style={styles.commandIcon}>{cmd.icon}</Text>
                  <View style={styles.commandText}>
                    <Text style={[styles.commandTitle, isSelected && styles.commandTitleSelected]}>
                      {cmd.title}
                    </Text>
                    {cmd.subtitle && (
                      <Text style={styles.commandSubtitle}>{cmd.subtitle}</Text>
                    )}
                  </View>
                  {cmd.shortcut && (
                    <Text style={styles.commandShortcut}>{cmd.shortcut}</Text>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>没有找到命令</Text>
              </View>
            }
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: SP[6],
  },
  container: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "80%",
    backgroundColor: DARK.surface0,
    borderRadius: RD["2xl"],
    borderWidth: 1,
    borderColor: DARK.border,
    overflow: "hidden",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    borderBottomWidth: 1,
    borderBottomColor: DARK.border,
    gap: SP[3],
  },
  searchIcon: {
    fontSize: 18,
    color: DARK.fgSubtle,
  },
  searchInput: {
    flex: 1,
    color: DARK.fg,
    fontSize: FS.base,
    padding: 0,
    margin: 0,
  },
  list: {
    flex: 1,
  },
  commandRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    gap: SP[3],
  },
  commandRowSelected: {
    backgroundColor: DARK.accentDim,
  },
  commandIcon: {
    fontSize: 18,
    width: 24,
    textAlign: "center",
  },
  commandText: {
    flex: 1,
  },
  commandTitle: {
    color: DARK.fg,
    fontSize: FS.sm,
    fontWeight: FW.medium,
  },
  commandTitleSelected: {
    color: DARK.accentBright,
    fontWeight: FW.semibold,
  },
  commandSubtitle: {
    color: DARK.fgSubtle,
    fontSize: FS.xs,
    marginTop: 2,
  },
  commandShortcut: {
    color: DARK.fgSubtle,
    fontSize: FS.xs,
    fontFamily: "monospace",
    paddingHorizontal: SP[2],
    paddingVertical: 4,
    backgroundColor: DARK.surface2,
    borderRadius: RD.base,
  },
  empty: {
    padding: SP[8],
    alignItems: "center",
  },
  emptyText: {
    color: DARK.fgSubtle,
    fontSize: FS.sm,
  },
});
