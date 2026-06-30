/**
 * General Section — 通用设置
 *
 * - defaultSend: interrupt / queue
 * - language: 语言选择
 * - terminalScrollbackLines: 终端回滚行数
 */
import { View, Text, Pressable, ScrollView } from "react-native";
import { C, SP, RD } from "../../theme";

interface GeneralSectionProps {
  settings: Record<string, unknown>;
  onSetSetting: (key: string, value: unknown) => void;
}

export function GeneralSection({ settings, onSetSetting }: GeneralSectionProps) {
  const defaultSend = (settings.defaultSend as "interrupt" | "queue") ?? "interrupt";
  const language = (settings.language as string) ?? "zh-CN";
  const scrollbackLines = (settings.terminalScrollbackLines as number) ?? 10000;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {/* Default Send */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>默认发送行为</Text>
            <Text style={styles.rowHint}>Agent 运行时按 Enter 的行为</Text>
          </View>
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segment, defaultSend === "interrupt" && styles.segmentActive]}
              onPress={() => onSetSetting("defaultSend", "interrupt")}
            >
              <Text style={[styles.segmentText, defaultSend === "interrupt" && styles.segmentTextActive]}>
                中断
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, defaultSend === "queue" && styles.segmentActive]}
              onPress={() => onSetSetting("defaultSend", "queue")}
            >
              <Text style={[styles.segmentText, defaultSend === "queue" && styles.segmentTextActive]}>
                排队
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Language */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>语言</Text>
            <Text style={styles.rowHint}>界面显示语言</Text>
          </View>
          <Text style={styles.value}>{language}</Text>
        </View>

        {/* Terminal Scrollback */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>终端回滚行数</Text>
            <Text style={styles.rowHint}>终端历史保留行数</Text>
          </View>
          <Text style={styles.value}>{scrollbackLines}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: C.surface1,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: SP[4],
    paddingHorizontal: SP[4],
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: C.fg,
    marginBottom: 2,
  },
  rowHint: {
    fontSize: 12,
    color: C.fgMuted,
  },
  value: {
    fontSize: 14,
    color: C.fgMuted,
  },
  segmentedControl: {
    flexDirection: "row" as const,
    backgroundColor: C.surface0,
    borderRadius: RD.md,
    padding: 2,
  },
  segment: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: RD.sm,
  },
  segmentActive: {
    backgroundColor: C.accent,
  },
  segmentText: {
    fontSize: 12,
    color: C.fgMuted,
  },
  segmentTextActive: {
    color: C.accentForeground,
  },
};
