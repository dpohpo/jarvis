/**
 * File Explorer — simplified file tree (Paseo style).
 *
 * Phase 1 stub: displays mock file structure. Protocol will add
 * fs.list request later.
 */

import { useState } from "react";
import type { ReactElement } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { DARK, SP, FS, FW, RD as BR } from "../theme";

// Alias DARK tokens for inline style usage
const C = DARK;

interface FileNode {
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
}

/** Mock file tree for Phase 1. Real data will come from daemon fs.list. */
const MOCK_FILES: FileNode[] = [
  {
    name: "src",
    type: "directory",
    children: [
      { name: "App.tsx", type: "file" },
      { name: "theme.ts", type: "file" },
      { name: "client.ts", type: "file" },
    ],
  },
  {
    name: "packages",
    type: "directory",
    children: [
      { name: "app", type: "directory", children: [{ name: "package.json", type: "file" }] },
      { name: "daemon", type: "directory", children: [{ name: "package.json", type: "file" }] },
    ],
  },
  { name: "package.json", type: "file" },
  { name: "README.md", type: "file" },
];

interface FileExplorerProps {
  /** Current working directory (not used in Phase 1 stub). */
  cwd?: string;
  /** Called when a file is clicked (passes filename only). */
  onFileSelect?: (filename: string) => void;
}

export function FileExplorer({ cwd, onFileSelect }: FileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["src", "packages"]));

  const toggleDir = (name: string) => {
    const next = new Set(expandedDirs);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setExpandedDirs(next);
  };

  const renderNode = (node: FileNode, depth: number = 0): ReactElement => {
    const isExpanded = expandedDirs.has(node.name);

    return (
      <View key={`${node.name}-${depth}`} style={{ marginLeft: depth * SP[3] }}>
        <Pressable
          style={styles.row}
          onPress={() => {
            if (node.type === "directory") {
              toggleDir(node.name);
            } else {
              onFileSelect?.(node.name);
            }
          }}
        >
          <Text style={styles.icon}>
            {node.type === "directory" ? (isExpanded ? "📂" : "📁") : "📄"}
          </Text>
          <Text style={styles.name}>{node.name}</Text>
        </Pressable>
        {node.type === "directory" && isExpanded && node.children && (
          <View>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>文件浏览器</Text>
      <ScrollView style={styles.tree}>{MOCK_FILES.map((node) => renderNode(node))}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK.surface0,
    padding: SP[3],
  },
  header: {
    color: DARK.fgMuted,
    fontSize: FS.xs,
    fontWeight: FW.semibold,
    marginBottom: SP[3],
    paddingHorizontal: SP[2],
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tree: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SP[1],
    paddingHorizontal: SP[2],
    borderRadius: BR.base,
    gap: SP[2],
  },
  icon: {
    fontSize: 16,
    width: 20,
    textAlign: "center",
  },
  name: {
    color: DARK.fg,
    fontSize: FS.sm,
    fontWeight: FW.medium,
  },
});
