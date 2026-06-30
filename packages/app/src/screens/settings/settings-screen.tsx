/**
 * Paseo-style Settings Screen — 主壳
 *
 * 左侧：SettingsSidebar 导航（移动端全屏）
 * 右侧：content pane 显示选中 section
 *
 * 接受 props: onClose, settings, onSetSetting, hostInfo, agents, providers
 */
import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SettingsSidebar } from "../../components/settings-sidebar";
import { C, SP, RD } from "../../theme";
import { GeneralSection } from "./general";
import { AppearanceSection } from "./appearance";
import { PermissionsSection } from "./permissions";
import { DiagnosticsSection } from "./diagnostics";
import { AboutSection } from "./about";
import { ConnectionsSection } from "./connections";
import { AgentsSection } from "./agents";
import { WorkspacesSection } from "./workspaces";
import { ProvidersSection } from "./providers";
import { UsageSection } from "./usage";
import { TerminalsSection } from "./terminals";
import { HostSection } from "./host";

export type SettingsSection =
  | "general"
  | "appearance"
  | "permissions"
  | "diagnostics"
  | "about"
  | "connections"
  | "agents"
  | "workspaces"
  | "providers"
  | "usage"
  | "terminals"
  | "host";

interface SettingsScreenProps {
  onClose: () => void;
  settings: Record<string, unknown>;
  onSetSetting: (key: string, value: unknown) => void;
  hostInfo?: {
    hostname: string;
    ip: string;
    osVersion: string;
    daemonVersion: string;
    relayUrl: string;
    connected: boolean;
  };
  agents: Array<{
    id: string;
    title: string;
    status: "running" | "stopped";
    engine: "claude" | "codex";
  }>;
  providers?: Array<{
    id: string;
    name: string;
    enabled: boolean;
    models?: string[];
  }>;
  workspaces?: string[];
  activeWorkspace?: string;
}

export function SettingsScreen({
  onClose,
  settings,
  onSetSetting,
  hostInfo,
  agents,
  providers = [],
  workspaces = [],
  activeWorkspace,
}: SettingsScreenProps) {
  const [selectedSection, setSelectedSection] = useState<SettingsSection>("general");

  const renderContent = useCallback(() => {
    switch (selectedSection) {
      case "general":
        return <GeneralSection settings={settings} onSetSetting={onSetSetting} />;
      case "appearance":
        return <AppearanceSection settings={settings} onSetSetting={onSetSetting} />;
      case "permissions":
        return <PermissionsSection settings={settings} onSetSetting={onSetSetting} />;
      case "diagnostics":
        return <DiagnosticsSection />;
      case "about":
        return <AboutSection />;
      case "connections":
        return (
          <ConnectionsSection
            hostInfo={hostInfo}
            onSetSetting={onSetSetting}
          />
        );
      case "agents":
        return <AgentsSection agents={agents} />;
      case "workspaces":
        return (
          <WorkspacesSection
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            onSetSetting={onSetSetting}
          />
        );
      case "providers":
        return (
          <ProvidersSection
            providers={providers}
            onSetSetting={onSetSetting}
          />
        );
      case "usage":
        return <UsageSection />;
      case "terminals":
        return <TerminalsSection settings={settings} onSetSetting={onSetSetting} />;
      case "host":
        return <HostSection hostInfo={hostInfo} />;
      default:
        return null;
    }
  }, [selectedSection, settings, onSetSetting, hostInfo, agents, providers, workspaces, activeWorkspace]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>设置</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            <SettingsSidebar
              selectedSection={selectedSection}
              onSelectSection={setSelectedSection}
            />
            <ScrollView style={styles.detailPane}>
              <View style={styles.detailContent}>{renderContent()}</View>
            </ScrollView>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = {
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.70)",
  },
  container: {
    flex: 1,
    backgroundColor: C.surface0,
    marginTop: 80,
    marginBottom: 0,
    borderTopLeftRadius: RD["2xl"],
    borderTopRightRadius: RD["2xl"],
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: SP[4],
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: C.fg,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: RD.base,
  },
  closeIcon: {
    fontSize: 20,
    color: C.fgMuted,
  },
  content: {
    flex: 1,
    flexDirection: "row" as const,
  },
  detailPane: {
    flex: 1,
    backgroundColor: C.surface1,
  },
  detailContent: {
    padding: SP[4],
  },
};
