/**
 * ChatSurface — message stream.
 *
 * 3.jpg main content area. Reads Bubble[] from session-store, renders
 * one ChatBubble per row, auto-scrolls to bottom when new lines arrive.
 *
 * Phase 11 also handles time-gap dividers: when 2 consecutive messages
 * are more than 5 minutes apart, a centered timestamp chip is inserted.
 */
import { useEffect, useRef } from "react";
import { FlatList, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, RD, SP } from "../theme";
import { useSessionStore, type Bubble } from "../stores/session-store";
import { ChatBubble } from "./message";

const GAP_MS = 5 * 60 * 1000;

type Row = { kind: "bubble"; bubble: Bubble } | { kind: "timestamp"; id: string; label: string };

function buildRows(lines: Bubble[]): Row[] {
  const rows: Row[] = [];
  let lastTs = 0;
  for (const b of lines) {
    if (b.ts - lastTs > GAP_MS) {
      rows.push({ kind: "timestamp", id: `ts-${b.id}`, label: formatTs(b.ts) });
    }
    rows.push({ kind: "bubble", bubble: b });
    lastTs = b.ts;
  }
  return rows;
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}

export function ChatSurface() {
  const lines = useSessionStore((s) => s.lines);
  const listRef = useRef<FlatList<Row>>(null);
  const rows = buildRows(lines);

  useEffect(() => {
    if (rows.length === 0) return;
    // Defer to next frame so layout settles before scroll.
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [rows.length]);

  if (lines.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Send a message to start the conversation.</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={{ padding: SP[3], paddingBottom: SP[5] }}
      data={rows}
      keyExtractor={(item) => (item.kind === "bubble" ? item.bubble.id : item.id)}
      renderItem={({ item }) =>
        item.kind === "bubble" ? (
          <ChatBubble bubble={item.bubble} />
        ) : (
          <View style={styles.tsRow}>
            <Text style={styles.tsText}>{item.label}</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: C.bg },
  empty: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: SP[6] } as ViewStyle,
  emptyText: { color: C.fgSubtle, fontSize: FS.sm, textAlign: "center", lineHeight: 22 },
  tsRow: { flexDirection: "row", justifyContent: "center", marginVertical: SP[2] } as ViewStyle,
  tsText: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    backgroundColor: C.surface1,
    paddingHorizontal: SP[2],
    paddingVertical: 2,
    borderRadius: RD.full,
  },
});
