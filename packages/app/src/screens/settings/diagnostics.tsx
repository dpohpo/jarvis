/**
 * Diagnostics Section — 诊断工具
 *
 * - 日志查看器（读 ~/.jarvis/logs 或显示 daemon log tail）
 * - 连接测试
 * - 错误报告
 */
import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { C, SP, RD } from "../../theme";

export function DiagnosticsSection() {
  const [isTailingLogs, setIsTailingLogs] = useState(false);
  const [logContent, setLogContent] = useState<string>(
    "点击下方按钮开始查看日志...\n\n日志路径: ~/.jarvis/logs/"
  );

  const handleViewLogs = () => {
    setIsTailingLogs(true);
    setLogContent("正在读取日志文件...\n\n[STUB] 日志内容待后端实现");
    setTimeout(() => setIsTailingLogs(false), 1000);
  };

  const handleTestConnection = () => {
    Alert.alert("连接测试", "[STUB] 连接测试功能待实现");
  };

  const handleExportLogs = () => {
    Alert.alert("导出日志", "[STUB] 日志导出功能待实现");
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {/* Log Viewer */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>日志查看器</Text>
            <Text style={styles.rowHint}>实时查看应用和 daemon 日志</Text>
          </View>
          <Pressable
            style={[styles.button, isTailingLogs && styles.buttonDisabled]}
            onPress={handleViewLogs}
            disabled={isTailingLogs}
          >
            <Text style={styles.buttonText}>{isTailingLogs ? "加载中..." : "查看日志"}</Text>
          </Pressable>
        </View>

        {/* Log Content */}
        {logContent && (
          <View style={styles.logContainer}>
            <Text style={styles.logContent}>{logContent}</Text>
          </View>
        )}

        {/* Connection Test */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>连接测试</Text>
            <Text style={styles.rowHint}>测试与 daemon 的连接状态</Text>
          </View>
          <Pressable style={styles.button} onPress={handleTestConnection}>
            <Text style={styles.buttonText}>测试</Text>
          </Pressable>
        </View>

        {/* Export Logs */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>导出日志</Text>
            <Text style={styles.rowHint}>打包导出所有日志文件</Text>
          </View>
          <Pressable style={styles.button} onPress={handleExportLogs}>
            <Text style={styles.buttonText}>导出</Text>
          </Pressable>
        </View>
      </View>

      {/* System Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>系统信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>应用版本</Text>
          <Text style={styles.infoValue}>0.1.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>React Native</Text>
          <Text style={styles.infoValue}>0.73.x</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>平台</Text>
          <Text style={styles.infoValue}>iOS / Android</Text>
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
    marginBottom: SP[4],
  },
  rowBorder: {
    paddingTop: SP[4],
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
  button: {
    backgroundColor: C.accent,
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
    borderRadius: RD.md,
  },
  buttonDisabled: {
    backgroundColor: C.surface3,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: C.accentForeground,
  },
  logContainer: {
    backgroundColor: C.surface0,
    borderRadius: RD.md,
    padding: SP[3],
    marginTop: SP[3],
    minHeight: 120,
  },
  logContent: {
    fontSize: 11,
    color: C.fgMuted,
    fontFamily: "monospace",
    lineHeight: 16,
  },
  infoRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingVertical: SP[2],
  },
  infoLabel: {
    fontSize: 14,
    color: C.fgMuted,
  },
  infoValue: {
    fontSize: 14,
    color: C.fg,
  },
};
