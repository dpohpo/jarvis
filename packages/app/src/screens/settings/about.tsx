/**
 * About Section — 关于页面
 *
 * - 版本号
 * - Commit hash
 * - GitHub link
 */
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { C, SP, RD } from "../../theme";

export function AboutSection() {
  const appVersion = "0.1.0";
  const commitHash = "dev";
  const githubUrl = "https://github.com/poincare/jarvis";

  const handleOpenGitHub = () => {
    Linking.openURL(githubUrl).catch((err) =>
      console.error("无法打开 GitHub:", err)
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {/* App Info */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Jarvis</Text>
            <Text style={styles.rowHint}>Poincare 的语音助手</Text>
          </View>
        </View>

        {/* Version */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>版本</Text>
          </View>
          <Text style={styles.value}>{appVersion}</Text>
        </View>

        {/* Commit */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Commit</Text>
          </View>
          <Text style={styles.value}>{commitHash}</Text>
        </View>

        {/* GitHub */}
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>源码</Text>
          </View>
          <Pressable onPress={handleOpenGitHub}>
            <Text style={styles.link}>GitHub ↗</Text>
          </Pressable>
        </View>
      </View>

      {/* Credits */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>致谢</Text>
        <Text style={styles.creditText}>
          UI 设计灵感来自{" "}
          <Text style={styles.link} onPress={() => Linking.openURL("https://github.com/getpaseo/paseo")}>
            Paseo
          </Text>
        </Text>
        <Text style={styles.creditText}>
          Powered by React Native + Expo
        </Text>
      </View>

      {/* License */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>许可证</Text>
        <Text style={styles.creditText}>
          MIT License — 自由使用、修改、分发
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
  link: {
    fontSize: 14,
    color: C.accent,
  },
  creditText: {
    fontSize: 14,
    color: C.fgMuted,
    lineHeight: 20,
    marginBottom: SP[2],
  },
};
