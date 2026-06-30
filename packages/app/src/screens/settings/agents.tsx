/**
 * Agents Section — 会话管理
 *
 * - Agent 列表（显示标题、状态、引擎）
 * - 删除、重命名操作
 * - STUB: 实际操作待后端实现
 */
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { C, SP, RD } from "../../theme";

interface Agent {
  id: string;
  title: string;
  status: "running" | "stopped";
  engine: "claude" | "codex";
}

interface AgentsSectionProps {
  agents: Agent[];
}

export function AgentsSection({ agents }: AgentsSectionProps) {
  const handleDeleteAgent = (agent: Agent) => {
    Alert.alert(
      "删除会话",
      `确定要删除 "${agent.title}" 吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            // STUB: 实际删除逻辑待实现
            console.log("删除 agent:", agent.id);
          },
        },
      ]
    );
  };

  const handleRenameAgent = (agent: Agent) => {
    Alert.alert(
      "重命名",
      `[STUB] 重命名功能待实现\n当前: ${agent.title}`
    );
  };

  const handleStopAgent = (agent: Agent) => {
    // STUB: 实际停止逻辑待实现
    console.log("停止 agent:", agent.id);
  };

  if (agents.length === 0) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>暂无会话</Text>
          <Text style={styles.emptyHint}>发起语音指令后会自动创建会话</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {agents.map((agent) => (
        <View key={agent.id} style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>{agent.title}</Text>
              <View
                style={[
                  styles.statusBadge,
                  agent.status === "running" ? styles.statusRunning : styles.statusStopped,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    agent.status === "running" ? styles.statusTextRunning : styles.statusTextStopped,
                  ]}
                >
                  {agent.status === "running" ? "运行中" : "已停止"}
                </Text>
              </View>
            </View>
            <Text style={styles.engineBadge}>{agent.engine.toUpperCase()}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {agent.status === "running" && (
              <Pressable
                style={[styles.actionButton, styles.actionButtonStop]}
                onPress={() => handleStopAgent(agent)}
              >
                <Text style={styles.actionButtonText}>停止</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.actionButton}
              onPress={() => handleRenameAgent(agent)}
            >
              <Text style={styles.actionButtonText}>重命名</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.actionButtonDelete]}
              onPress={() => handleDeleteAgent(agent)}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextDelete]}>
                删除
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: SP[8],
  },
  emptyText: {
    fontSize: 16,
    color: C.fgMuted,
    marginBottom: SP[2],
  },
  emptyHint: {
    fontSize: 12,
    color: C.fgSubtle,
  },
  card: {
    backgroundColor: C.surface1,
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: SP[4],
    padding: SP[4],
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: SP[4],
  },
  headerLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: SP[3],
  },
  title: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: C.fg,
  },
  statusBadge: {
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    borderRadius: RD.sm,
  },
  statusRunning: {
    backgroundColor: C.success + "20",
  },
  statusStopped: {
    backgroundColor: C.surface3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "500" as const,
  },
  statusTextRunning: {
    color: C.success,
  },
  statusTextStopped: {
    color: C.fgMuted,
  },
  engineBadge: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: C.accent,
    paddingHorizontal: SP[2],
    paddingVertical: 2,
    backgroundColor: C.accentDim,
    borderRadius: RD.sm,
  },
  actions: {
    flexDirection: "row" as const,
    gap: SP[3],
  },
  actionButton: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionButtonStop: {
    backgroundColor: C.warnDim,
    borderColor: C.warn,
  },
  actionButtonDelete: {
    backgroundColor: C.destructiveDim,
    borderColor: C.destructive,
  },
  actionButtonText: {
    fontSize: 12,
    color: C.fg,
  },
  actionButtonTextDelete: {
    color: C.destructiveForeground,
  },
};
