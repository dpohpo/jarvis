/**
 * Terminals Section — 终端配置
 *
 * - 终端类型选择
 * - Shell 配置
 * - 字体设置
 * - STUB: 先显示基础配置，实际配置待后端补
 */
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { C, SP, RD } from "../../theme";

interface TerminalsSectionProps {
  settings: Record<string, unknown>;
  onSetSetting: (key: string, value: unknown) => void;
}

export function TerminalsSection({ settings, onSetSetting }: TerminalsSectionProps) {
  const terminalType = (settings.terminalType as "tmux" | "shell") ?? "tmux";
  const shellPath = (settings.shellPath as string) ?? "/bin/zsh";
  const terminalFont = (settings.terminalFont as string) ?? "Menlo";

  const handleSelectTerminalType = (type: "tmux" | "shell") => {
    // STUB: 实际选择逻辑待实现
    console.log("选择终端类型:", type);
  };

  const handleChangeShellPath = (path: string) => {
    onSetSetting("shellPath", path);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {/* Terminal Type */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>终端类型</Text>
            <Text style={styles.rowHint}>选择默认终端环境</Text>
          </View>
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segment, terminalType === "tmux" && styles.segmentActive]}
              onPress={() => handleSelectTerminalType("tmux")}
            >
              <Text style={[styles.segmentText, terminalType === "tmux" && styles.segmentTextActive]}>
                Tmux
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, terminalType === "shell" && styles.segmentActive]}
              onPress={() => handleSelectTerminalType("shell")}
            >
              <Text style={[styles.segmentText, terminalType === "shell" && styles.segmentTextActive]}>
                Shell
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Shell Path */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Shell 路径</Text>
            <Text style={styles.rowHint}>默认 shell 可执行文件路径</Text>
          </View>
          <TextInput
            style={styles.input}
            value={shellPath}
            onChangeText={handleChangeShellPath}
            placeholder="/bin/zsh"
            placeholderTextColor={C.fgSubtle}
          />
        </View>

        {/* Terminal Font */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>终端字体</Text>
            <Text style={styles.rowHint}>代码显示字体</Text>
          </View>
          <Text style={styles.value}>{terminalFont}</Text>
        </View>

        {/* Scrollback Lines */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>回滚行数</Text>
            <Text style={styles.rowHint}>终端历史保留行数</Text>
          </View>
          <Text style={styles.value}>10,000</Text>
        </View>
      </View>

      {/* Tmux Config */}
      {terminalType === "tmux" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tmux 配置</Text>

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Session 名称</Text>
            </View>
            <Text style={styles.value}>jarvis</Text>
          </View>

          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>自动附加</Text>
            </View>
            <Text style={styles.value}>是</Text>
          </View>

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Pane 布局</Text>
            </View>
            <Text style={styles.value}>even-horizontal</Text>
          </View>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>终端说明</Text>
        <Text style={styles.infoText}>
          • Tmux: 终端复用器，支持多会话管理{"\n"}
          • Shell: 直接调用系统 shell{"\n"}
          • [STUB] 当前显示基础配置，高级配置待实现
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
    marginBottom: 2,
  },
  rowHint: {
    fontSize: 11,
    color: C.fgMuted,
  },
  value: {
    fontSize: 13,
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
  input: {
    width: 200,
    height: 36,
    backgroundColor: C.surface0,
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SP[3],
    fontSize: 12,
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
