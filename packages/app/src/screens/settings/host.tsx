/**
 * Host Section — 主机详情
 *
 * - 当前 host 详情（hostname / IP / OS version / daemon version）
 * - 系统资源监控
 * - STUB: 显示基础信息，实际监控待后端补
 */
import { View, Text, ScrollView } from "react-native";
import { C, SP, RD } from "../../theme";

interface HostSectionProps {
  hostInfo?: {
    hostname: string;
    ip: string;
    osVersion: string;
    daemonVersion: string;
    relayUrl: string;
    connected: boolean;
  };
}

// STUB: 假数据（扩展 hostInfo 类型，包含资源监控）
const STUB_HOST_INFO = {
  hostname: "Poincares-Mac-mini",
  ip: "192.168.1.100",
  osVersion: "macOS 14.4",
  daemonVersion: "0.1.0",
  relayUrl: "ws://39.108.123.54:18790",
  connected: true,
  cpuUsage: 12,
  memoryUsage: 45,
  diskUsage: 68,
};

export function HostSection({ hostInfo }: HostSectionProps) {
  const info = hostInfo ?? STUB_HOST_INFO;

  return (
    <ScrollView style={styles.container}>
      {/* Basic Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>主机信息</Text>

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>主机名</Text>
          </View>
          <Text style={styles.value}>{info.hostname}</Text>
        </View>

        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>IP 地址</Text>
          </View>
          <Text style={styles.value}>{info.ip}</Text>
        </View>

        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>操作系统</Text>
          </View>
          <Text style={styles.value}>{info.osVersion}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Daemon 版本</Text>
          </View>
          <Text style={styles.value}>{info.daemonVersion}</Text>
        </View>
      </View>

      {/* System Resources */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>系统资源</Text>

        {/* CPU */}
        <View style={styles.resourceRow}>
          <View style={styles.resourceInfo}>
            <Text style={styles.resourceLabel}>CPU</Text>
            <Text style={styles.resourceValue}>{STUB_HOST_INFO.cpuUsage}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                styles.progressFillCpu,
                { width: `${STUB_HOST_INFO.cpuUsage}%` },
              ]}
            />
          </View>
        </View>

        {/* Memory */}
        <View style={styles.resourceRow}>
          <View style={styles.resourceInfo}>
            <Text style={styles.resourceLabel}>内存</Text>
            <Text style={styles.resourceValue}>{STUB_HOST_INFO.memoryUsage}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                styles.progressFillMemory,
                { width: `${STUB_HOST_INFO.memoryUsage}%` },
              ]}
            />
          </View>
        </View>

        {/* Disk */}
        <View style={styles.resourceRow}>
          <View style={styles.resourceInfo}>
            <Text style={styles.resourceLabel}>磁盘</Text>
            <Text style={styles.resourceValue}>{STUB_HOST_INFO.diskUsage}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                styles.progressFillDisk,
                { width: `${STUB_HOST_INFO.diskUsage}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Connection Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>连接状态</Text>

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Relay URL</Text>
          </View>
          <Text style={styles.value}>{info.relayUrl}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>状态</Text>
          </View>
          <Text
            style={[
              styles.value,
              info.connected ? styles.valueConnected : styles.valueDisconnected,
            ]}
          >
            {info.connected ? "已连接" : "未连接"}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>监控说明</Text>
        <Text style={styles.infoText}>
          • 系统资源数据来自本地监控{"\n"}
          • CPU/内存/磁盘为实时数据{"\n"}
          • [STUB] 当前显示假数据，实际监控待后端实现
        </Text>
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
    fontWeight: "500" as const,
    color: C.fg,
  },
  value: {
    fontSize: 14,
    color: C.fgMuted,
  },
  valueConnected: {
    color: C.success,
  },
  valueDisconnected: {
    color: C.destructive,
  },
  resourceRow: {
    marginBottom: SP[4],
  },
  resourceInfo: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: SP[2],
  },
  resourceLabel: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: C.fg,
  },
  resourceValue: {
    fontSize: 14,
    color: C.fgMuted,
  },
  progressBar: {
    height: 6,
    backgroundColor: C.surface0,
    borderRadius: RD.full,
    overflow: "hidden" as const,
  },
  progressFill: {
    height: "100%" as const,
    borderRadius: RD.full,
  },
  progressFillCpu: {
    backgroundColor: C.accent,
  },
  progressFillMemory: {
    backgroundColor: C.warn,
  },
  progressFillDisk: {
    backgroundColor: C.destructive,
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
