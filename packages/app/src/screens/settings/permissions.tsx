/**
 * Permissions Section — 权限设置
 *
 * - Tier 1/2/3 阈值配置
 * - 自动批准规则
 */
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { C, SP, RD } from "../../theme";

interface PermissionsSectionProps {
  settings: Record<string, unknown>;
  onSetSetting: (key: string, value: unknown) => void;
}

export function PermissionsSection({ settings, onSetSetting }: PermissionsSectionProps) {
  const tier1Threshold = (settings.tier1Threshold as number) ?? 0;
  const tier2Threshold = (settings.tier2Threshold as number) ?? 100;
  const tier3Threshold = (settings.tier3Threshold as number) ?? 1000;
  const autoApproveTier1 = (settings.autoApproveTier1 as boolean) ?? true;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {/* Tier 1 */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Tier 1 阈值</Text>
            <Text style={styles.rowHint}>自动批准的低风险操作上限</Text>
          </View>
          <TextInput
            style={styles.input}
            value={String(tier1Threshold)}
            onChangeText={(text) => onSetSetting("tier1Threshold", parseInt(text, 10) || 0)}
            keyboardType="number-pad"
          />
        </View>

        {/* Tier 2 */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Tier 2 阈值</Text>
            <Text style={styles.rowHint}>需要确认的中等风险操作上限</Text>
          </View>
          <TextInput
            style={styles.input}
            value={String(tier2Threshold)}
            onChangeText={(text) => onSetSetting("tier2Threshold", parseInt(text, 10) || 0)}
            keyboardType="number-pad"
          />
        </View>

        {/* Tier 3 */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Tier 3 阈值</Text>
            <Text style={styles.rowHint}>需要严格确认的高风险操作上限</Text>
          </View>
          <TextInput
            style={styles.input}
            value={String(tier3Threshold)}
            onChangeText={(text) => onSetSetting("tier3Threshold", parseInt(text, 10) || 0)}
            keyboardType="number-pad"
          />
        </View>

        {/* Auto Approve Tier 1 */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>自动批准 Tier 1</Text>
            <Text style={styles.rowHint}>低于阈值的操作自动放行</Text>
          </View>
          <Pressable
            style={[styles.toggle, autoApproveTier1 && styles.toggleOn]}
            onPress={() => onSetSetting("autoApproveTier1", !autoApproveTier1)}
          >
            <View style={[styles.toggleKnob, autoApproveTier1 && styles.toggleKnobOn]} />
          </Pressable>
        </View>
      </View>

      {/* Explanation */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>权限分级说明</Text>
        <Text style={styles.infoText}>
          • Tier 1: 低风险操作（如读取文件、查看状态）{"\n"}
          • Tier 2: 中等风险操作（如修改配置、执行命令）{"\n"}
          • Tier 3: 高风险操作（如删除文件、系统变更）
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
  input: {
    width: 80,
    height: 36,
    backgroundColor: C.surface0,
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SP[3],
    fontSize: 14,
    color: C.fg,
    textAlign: "center" as const,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surface3,
    padding: 2,
  },
  toggleOn: {
    backgroundColor: C.accent,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.fg,
  },
  toggleKnobOn: {
    backgroundColor: C.accentForeground,
    alignSelf: "flex-end" as const,
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
