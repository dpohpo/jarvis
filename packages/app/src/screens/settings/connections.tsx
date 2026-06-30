/**
 * Connections Section — 连接配置
 *
 * - Relay URL: ws://39.108.123.54:18790
 * - 重连按钮
 * - 连接状态显示
 */
import { View, Text, Pressable, ScrollView } from "react-native";
import { C, SP, RD } from "../../theme";

interface ConnectionsSectionProps {
  hostInfo?: {
    hostname: string;
    ip: string;
    osVersion: string;
    daemonVersion: string;
    relayUrl: string;
    connected: boolean;
  };
  onSetSetting: (key: string, value: unknown) => void;
}

export function ConnectionsSection({
  hostInfo,
  onSetSetting,
}: ConnectionsSectionProps) {
  const relayUrl = hostInfo?.relayUrl ?? "ws://39.108.123.54:18790";
  const connected = hostInfo?.connected ?? false;

  const handleReconnect = () => {
    // STUB: 实际重连逻辑待实现
    console.log("触发重连");
  };

  const handleEditUrl = () => {
    // STUB: URL 编辑逻辑待实现
    console.log("编辑 Relay URL");
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {/* Connection Status */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>连接状态</Text>
            <Text style={styles.rowHint}>与 daemon 的实时连接</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              connected ? styles.statusConnected : styles.statusDisconnected,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                connected ? styles.statusTextConnected : styles.statusTextDisconnected,
              ]}
            >
              {connected ? "已连接" : "未连接"}
            </Text>
          </View>
        </View>

        {/* Relay URL */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Relay URL</Text>
            <Text style={styles.rowHint}>WebSocket 中继服务器地址</Text>
          </View>
          <Pressable onPress={handleEditUrl}>
            <Text style={styles.value}>{relayUrl}</Text>
          </Pressable>
        </View>

        {/* Host Info */}
        {hostInfo && (
          <>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>主机名</Text>
              </View>
              <Text style={styles.value}>{hostInfo.hostname}</Text>
            </View>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>IP 地址</Text>
              </View>
              <Text style={styles.value}>{hostInfo.ip}</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Daemon 版本</Text>
              </View>
              <Text style={styles.value}>{hostInfo.daemonVersion}</Text>
            </View>
          </>
        )}

        {/* Reconnect Button */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.button, !connected && styles.buttonPrimary]}
            onPress={handleReconnect}
          >
            <Text style={styles.buttonText}>{connected ? "重新连接" : "连接"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Connection Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>连接说明</Text>
        <Text style={styles.infoText}>
          Jarvis 通过 WebSocket Relay 与本机 daemon 通信。
          {"\n\n"}
          • Relay URL: 中继服务器地址{"\n"}
          • 连接状态: 实时显示在线/离线{"\n"}
          • 支持自动重连
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
  statusBadge: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RD.full,
  },
  statusConnected: {
    backgroundColor: C.success + "20",
  },
  statusDisconnected: {
    backgroundColor: C.destructive + "20",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  statusTextConnected: {
    color: C.success,
  },
  statusTextDisconnected: {
    color: C.destructive,
  },
  actionRow: {
    marginTop: SP[4],
    paddingTop: SP[4],
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  button: {
    backgroundColor: C.surface3,
    paddingHorizontal: SP[6],
    paddingVertical: SP[3],
    borderRadius: RD.md,
  },
  buttonPrimary: {
    backgroundColor: C.accent,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: C.fg,
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
