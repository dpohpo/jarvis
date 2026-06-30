/**
 * Providers Section — AI 提供商管理
 *
 * - Provider 卡片列表（Claude/Codex/Copilot/Gemini）
 * - 每个 Provider 有 toggle 启用
 * - 模型选择
 * - STUB: 数据从 client.ts 的 requestProviders() 拉取（如果还没实现，先 hardcode stub）
 */
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { C, SP, RD } from "../../theme";

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  models?: string[];
}

interface ProvidersSectionProps {
  providers: Provider[];
  onSetSetting: (key: string, value: unknown) => void;
}

// STUB: 硬编码的提供商数据（如果还没实现 requestProviders API）
const STUB_PROVIDERS: Provider[] = [
  {
    id: "claude",
    name: "Claude",
    enabled: true,
    models: ["claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"],
  },
  {
    id: "codex",
    name: "Codex",
    enabled: true,
    models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    enabled: false,
    models: ["copilot-3.5", "copilot-4"],
  },
  {
    id: "gemini",
    name: "Gemini",
    enabled: false,
    models: ["gemini-pro", "gemini-ultra"],
  },
];

export function ProvidersSection({
  providers = STUB_PROVIDERS,
  onSetSetting,
}: ProvidersSectionProps) {
  const handleToggleProvider = (providerId: string, enabled: boolean) => {
    // STUB: 实际切换逻辑待实现
    console.log("切换 provider:", providerId, enabled);
    Alert.alert("切换提供商", `[STUB] 切换 "${providerId}" 待实现`);
  };

  const handleSelectModel = (providerId: string, model: string) => {
    // STUB: 实际选择逻辑待实现
    console.log("选择模型:", providerId, model);
    Alert.alert("选择模型", `[STUB] 为 "${providerId}" 选择 "${model}" 待实现`);
  };

  return (
    <ScrollView style={styles.container}>
      {providers.map((provider) => (
        <View key={provider.id} style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>{provider.name}</Text>
              <Text style={styles.id}>{provider.id}</Text>
            </View>
            <Pressable
              style={[styles.toggle, provider.enabled && styles.toggleOn]}
              onPress={() => handleToggleProvider(provider.id, !provider.enabled)}
            >
              <View style={[styles.toggleKnob, provider.enabled && styles.toggleKnobOn]} />
            </Pressable>
          </View>

          {/* Models */}
          {provider.enabled && provider.models && provider.models.length > 0 && (
            <View style={styles.modelsSection}>
              <Text style={styles.modelsTitle}>可用模型</Text>
              {provider.models.map((model) => (
                <Pressable
                  key={model}
                  style={styles.modelItem}
                  onPress={() => handleSelectModel(provider.id, model)}
                >
                  <Text style={styles.modelName}>{model}</Text>
                  <Text style={styles.modelArrow}>→</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Status */}
          <View style={styles.status}>
            <Text style={[styles.statusText, provider.enabled ? styles.statusTextEnabled : styles.statusTextDisabled]}>
              {provider.enabled ? "已启用" : "已禁用"}
            </Text>
          </View>
        </View>
      ))}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>提供商说明</Text>
        <Text style={styles.infoText}>
          • Claude: Anthropic 的 GPT-4 竞品{"\n"}
          • Codex: OpenAI 的代码生成模型{"\n"}
          • Copilot: GitHub 的 AI 编程助手{"\n"}
          • Gemini: Google 的多模态模型
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
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: SP[4],
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: C.fg,
  },
  id: {
    fontSize: 12,
    color: C.fgSubtle,
    marginTop: 2,
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
  modelsSection: {
    marginBottom: SP[4],
  },
  modelsTitle: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: C.fgMuted,
    marginBottom: SP[2],
    textTransform: "uppercase" as const,
  },
  modelItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: SP[2],
    paddingHorizontal: SP[3],
    backgroundColor: C.surface0,
    borderRadius: RD.sm,
    marginBottom: SP[2],
  },
  modelName: {
    fontSize: 13,
    color: C.fg,
  },
  modelArrow: {
    fontSize: 12,
    color: C.fgMuted,
  },
  status: {
    paddingTop: SP[3],
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  statusTextEnabled: {
    color: C.success,
  },
  statusTextDisabled: {
    color: C.fgSubtle,
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
