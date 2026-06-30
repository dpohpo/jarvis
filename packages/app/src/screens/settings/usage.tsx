/**
 * Usage Section — 使用统计
 *
 * - 任务数统计
 * - 语音时长统计
 * - Token 用量统计
 * - STUB: 显示 stub 数据，实际数据待后端补
 */
import { View, Text, ScrollView } from "react-native";
import { C, SP, RD } from "../../theme";

// STUB: 假数据
const STUB_STATS = {
  totalTasks: 42,
  voiceMinutes: 128,
  tokensUsed: 156000,
};

export function UsageSection() {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("zh-CN").format(num);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Overview Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatNumber(STUB_STATS.totalTasks)}</Text>
          <Text style={styles.statLabel}>总任务数</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatNumber(STUB_STATS.voiceMinutes)} min</Text>
          <Text style={styles.statLabel}>语音时长</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatNumber(STUB_STATS.tokensUsed)}</Text>
          <Text style={styles.statLabel}>Token 用量</Text>
        </View>
      </View>

      {/* Detailed Stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>详细统计</Text>

        {/* Tasks Breakdown */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>已完成任务</Text>
          </View>
          <Text style={styles.value}>38</Text>
        </View>

        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>运行中任务</Text>
          </View>
          <Text style={styles.value}>2</Text>
        </View>

        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>失败任务</Text>
          </View>
          <Text style={styles.value}>2</Text>
        </View>

        {/* Voice Stats */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>今日语音时长</Text>
          </View>
          <Text style={styles.value}>15 min</Text>
        </View>

        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>本周语音时长</Text>
          </View>
          <Text style={styles.value}>48 min</Text>
        </View>

        {/* Token Stats */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Claude Tokens</Text>
          </View>
          <Text style={styles.value}>120K</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Codex Tokens</Text>
          </View>
          <Text style={styles.value}>36K</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>统计说明</Text>
        <Text style={styles.infoText}>
          • 数据来源于本地 daemon 日志{"\n"}
          • Token 用量为估算值，以提供商账单为准{"\n"}
          • [STUB] 当前显示假数据，实际统计待后端实现
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    marginBottom: SP[4],
    gap: SP[3],
  },
  statCard: {
    flex: 1,
    minWidth: "45%" as const,
    backgroundColor: C.surface1,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: SP[4],
  },
  statValue: {
    fontSize: 24,
    fontWeight: "600" as const,
    color: C.fg,
    marginBottom: SP[1],
  },
  statLabel: {
    fontSize: 12,
    color: C.fgMuted,
  },
  card: {
    backgroundColor: C.surface1,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: SP[4],
    padding: SP[4],
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: C.fg,
    marginBottom: SP[4],
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: SP[3],
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    color: C.fg,
  },
  value: {
    fontSize: 14,
    color: C.fgMuted,
  },
  infoCard: {
    backgroundColor: C.surface1,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: SP[4],
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: C.fg,
    marginBottom: SP[2],
  },
  infoText: {
    fontSize: 12,
    color: C.fgMuted,
    lineHeight: 18,
  },
};
