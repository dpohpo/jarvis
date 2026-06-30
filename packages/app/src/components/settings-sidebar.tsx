/**
 * SettingsSidebar — 设置导航组件
 *
 * App 组：General / Appearance / Permissions / Diagnostics / About
 * Host 组：Connections / Agents / Workspaces / Providers / Usage / Terminals / Host
 */
import { Pressable, Text, View } from "react-native";
import { C, SP, RD } from "../theme";
import type { SettingsSection } from "../screens/settings/settings-screen";

interface SidebarSectionItem {
  id: SettingsSection;
  label: string;
  emoji: string;
  group: "app" | "host";
}

const SECTIONS: SidebarSectionItem[] = [
  // App 组
  { id: "general", label: "通用", emoji: "⚙️", group: "app" },
  { id: "appearance", label: "外观", emoji: "🎨", group: "app" },
  { id: "permissions", label: "权限", emoji: "🔒", group: "app" },
  { id: "diagnostics", label: "诊断", emoji: "🔍", group: "app" },
  { id: "about", label: "关于", emoji: "ℹ️", group: "app" },
  // Host 组
  { id: "connections", label: "连接", emoji: "🌐", group: "host" },
  { id: "agents", label: "会话", emoji: "👥", group: "host" },
  { id: "workspaces", label: "工作空间", emoji: "📁", group: "host" },
  { id: "providers", label: "提供商", emoji: "🤖", group: "host" },
  { id: "usage", label: "使用统计", emoji: "📊", group: "host" },
  { id: "terminals", label: "终端", emoji: "💻", group: "host" },
  { id: "host", label: "主机", emoji: "🖥️", group: "host" },
];

interface SettingsSidebarProps {
  selectedSection: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
}

export function SettingsSidebar({
  selectedSection,
  onSelectSection,
}: SettingsSidebarProps) {
  const appSections = SECTIONS.filter((s) => s.group === "app");
  const hostSections = SECTIONS.filter((s) => s.group === "host");

  return (
    <View style={styles.container}>
      <View style={styles.group}>
        <Text style={styles.groupLabel}>应用</Text>
        {appSections.map((section) => (
          <SectionItem
            key={section.id}
            item={section}
            selected={selectedSection === section.id}
            onPress={onSelectSection}
          />
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.group}>
        <Text style={styles.groupLabel}>主机</Text>
        {hostSections.map((section) => (
          <SectionItem
            key={section.id}
            item={section}
            selected={selectedSection === section.id}
            onPress={onSelectSection}
          />
        ))}
      </View>
    </View>
  );
}

interface SectionItemProps {
  item: SidebarSectionItem;
  selected: boolean;
  onPress: (id: SettingsSection) => void;
}

function SectionItem({ item, selected, onPress }: SectionItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        selected && styles.itemSelected,
        pressed && styles.itemPressed,
      ]}
      onPress={() => onPress(item.id)}
    >
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text
        style={[styles.itemLabel, selected && styles.itemLabelSelected]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = {
  container: {
    width: 240,
    backgroundColor: C.surfaceSidebar,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingVertical: SP[4],
  },
  group: {
    marginBottom: SP[4],
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: C.fgSubtle,
    paddingHorizontal: SP[4],
    marginBottom: SP[2],
    textTransform: "uppercase" as const,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: SP[2],
  },
  item: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    gap: SP[3],
  },
  itemSelected: {
    backgroundColor: C.surface2,
  },
  itemPressed: {
    backgroundColor: C.surfaceSidebarHover,
  },
  itemLabel: {
    fontSize: 14,
    color: C.fgMuted,
  },
  itemLabelSelected: {
    color: C.fg,
  },
  emoji: {
    fontSize: 16,
  },
};
