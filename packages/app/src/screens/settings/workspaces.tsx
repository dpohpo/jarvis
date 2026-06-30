/**
 * Workspaces Section — 工作空间管理
 *
 * - 工作空间列表
 * - 创建新工作空间
 * - 切换工作空间
 * - STUB: 实际操作待后端实现
 */
import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, TextInput } from "react-native";
import { C, SP, RD } from "../../theme";

interface WorkspacesSectionProps {
  workspaces: string[];
  activeWorkspace?: string;
  onSetSetting: (key: string, value: unknown) => void;
}

export function WorkspacesSection({
  workspaces,
  activeWorkspace,
  onSetSetting,
}: WorkspacesSectionProps) {
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const handleSwitchWorkspace = (name: string) => {
    if (name === activeWorkspace) return;
    // STUB: 实际切换逻辑待实现
    console.log("切换工作空间:", name);
    Alert.alert("切换工作空间", `[STUB] 切换到 "${name}" 待实现`);
  };

  const handleCreateWorkspace = () => {
    if (!newWorkspaceName.trim()) {
      Alert.alert("错误", "请输入工作空间名称");
      return;
    }
    // STUB: 实际创建逻辑待实现
    console.log("创建工作空间:", newWorkspaceName);
    Alert.alert("创建工作空间", `[STUB] 创建 "${newWorkspaceName}" 待实现`);
    setNewWorkspaceName("");
    setShowCreateInput(false);
  };

  const handleDeleteWorkspace = (name: string) => {
    if (workspaces.length <= 1) {
      Alert.alert("错误", "至少需要保留一个工作空间");
      return;
    }
    Alert.alert(
      "删除工作空间",
      `确定要删除 "${name}" 吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            // STUB: 实际删除逻辑待实现
            console.log("删除工作空间:", name);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Active Workspace */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>当前工作空间</Text>
        {activeWorkspace && (
          <View style={styles.activeWorkspace}>
            <Text style={styles.activeWorkspaceName}>{activeWorkspace}</Text>
            <Text style={styles.activeWorkspaceLabel}>活跃中</Text>
          </View>
        )}
      </View>

      {/* All Workspaces */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>所有工作空间</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => setShowCreateInput(!showCreateInput)}
          >
            <Text style={styles.addButtonText}>+ 新建</Text>
          </Pressable>
        </View>

        {/* Create Input */}
        {showCreateInput && (
          <View style={styles.createInputContainer}>
            <TextInput
              style={styles.createInput}
              value={newWorkspaceName}
              onChangeText={setNewWorkspaceName}
              placeholder="工作空间名称"
              placeholderTextColor={C.fgSubtle}
              autoFocus
              onSubmitEditing={handleCreateWorkspace}
            />
            <Pressable style={styles.createButton} onPress={handleCreateWorkspace}>
              <Text style={styles.createButtonText}>创建</Text>
            </Pressable>
          </View>
        )}

        {/* Workspace List */}
        {workspaces.map((workspace) => (
          <View key={workspace} style={styles.workspaceItem}>
            <Pressable
              style={styles.workspaceInfo}
              onPress={() => handleSwitchWorkspace(workspace)}
            >
              <Text
                style={[
                  styles.workspaceName,
                  workspace === activeWorkspace && styles.workspaceNameActive,
                ]}
              >
                {workspace}
              </Text>
              {workspace === activeWorkspace && (
                <Text style={styles.workspaceActiveLabel}>当前</Text>
              )}
            </Pressable>
            {workspace !== activeWorkspace && (
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteWorkspace(workspace)}
              >
                <Text style={styles.deleteButtonText}>删除</Text>
              </Pressable>
            )}
          </View>
        ))}
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
  cardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: SP[4],
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: C.fg,
  },
  activeWorkspace: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: SP[4],
    backgroundColor: C.accentDim,
    borderRadius: RD.md,
  },
  activeWorkspaceName: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: C.fg,
  },
  activeWorkspaceLabel: {
    fontSize: 12,
    color: C.accent,
  },
  addButton: {
    backgroundColor: C.accent,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: RD.md,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: C.accentForeground,
  },
  createInputContainer: {
    flexDirection: "row" as const,
    gap: SP[3],
    marginBottom: SP[4],
  },
  createInput: {
    flex: 1,
    height: 36,
    backgroundColor: C.surface0,
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SP[3],
    fontSize: 14,
    color: C.fg,
  },
  createButton: {
    backgroundColor: C.accent,
    paddingHorizontal: SP[4],
    borderRadius: RD.md,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: C.accentForeground,
  },
  workspaceItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: SP[3],
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  workspaceInfo: {
    flex: 1,
  },
  workspaceName: {
    fontSize: 14,
    color: C.fgMuted,
  },
  workspaceNameActive: {
    color: C.fg,
    fontWeight: "500" as const,
  },
  workspaceActiveLabel: {
    fontSize: 11,
    color: C.accent,
    marginLeft: SP[2],
  },
  deleteButton: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
  },
  deleteButtonText: {
    fontSize: 12,
    color: C.destructive,
  },
};
