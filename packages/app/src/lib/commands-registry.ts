/**
 * Command Registry — central registry for all commands (slash + global).
 *
 * Commands can be:
 * - Slash: typed in composer (handled by slash-commands.ts)
 * - Global: triggered via Cmd+K Command Center
 *
 * This file handles the Command Center commands only.
 */

import type { ThemeName } from "../theme";

export interface Command {
  id: string;
  type: "navigate" | "action" | "slash";
  icon: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  handler: () => void;
}

interface CommandContext {
  /** Navigate to a workspace. */
  navigateToWorkspace: (name: string) => void;
  /** Navigate to an agent. */
  navigateToAgent: (id: string | null) => void;
  /** Switch theme. */
  setTheme: (name: ThemeName) => void;
  /** Create new agent. */
  newAgent: () => void;
  /** Clear chat. */
  clearChat: () => void;
  /** Open agents sheet. */
  openAgentsSheet: () => void;
  /** Show help. */
  showHelp: (msg: string) => void;
  /** Current workspace name. */
  currentWorkspace: string;
  /** All workspace names. */
  workspaceList: string[];
  /** All agents. */
  agents: Array<{ id: string; title?: string }>;
}

/**
 * Build command list for Command Center.
 * Dynamically includes workspace/agent navigation commands.
 */
export function buildCommands(ctx: CommandContext): Command[] {
  const commands: Command[] = [
    // ---- Theme commands ----
    {
      id: "theme.dark",
      type: "action",
      icon: "🎨",
      title: "切换到 Dark 主题",
      handler: () => ctx.setTheme("dark"),
    },
    {
      id: "theme.zinc",
      type: "action",
      icon: "🎨",
      title: "切换到 Zinc 主题",
      handler: () => ctx.setTheme("zinc"),
    },
    {
      id: "theme.midnight",
      type: "action",
      icon: "🎨",
      title: "切换到 Midnight 主题",
      handler: () => ctx.setTheme("midnight"),
    },
    {
      id: "theme.claude",
      type: "action",
      icon: "🎨",
      title: "切换到 Claude 主题",
      handler: () => ctx.setTheme("claude"),
    },
    {
      id: "theme.ghostty",
      type: "action",
      icon: "🎨",
      title: "切换到 Ghostty 主题",
      handler: () => ctx.setTheme("ghostty"),
    },
    {
      id: "theme.light",
      type: "action",
      icon: "🎨",
      title: "切换到 Light 主题",
      handler: () => ctx.setTheme("light"),
    },

    // ---- Agent commands ----
    {
      id: "agent.new",
      type: "action",
      icon: "✚",
      title: "新建会话",
      subtitle: "开始新对话",
      handler: () => ctx.newAgent(),
    },
    {
      id: "agent.list",
      type: "action",
      icon: "💬",
      title: "查看所有会话",
      handler: () => ctx.openAgentsSheet(),
    },

    // ---- Chat commands ----
    {
      id: "chat.clear",
      type: "slash",
      icon: "🗑",
      title: "清空对话",
      subtitle: "清除当前对话显示",
      shortcut: "/clear",
      handler: () => {
        ctx.clearChat();
        ctx.showHelp("对话已清空");
      },
    },
  ];

  // ---- Workspace navigation commands ----
  for (const ws of ctx.workspaceList) {
    commands.push({
      id: `workspace.${ws}`,
      type: "navigate",
      icon: "📁",
      title: `切换到 ${ws || "主目录"}`,
      subtitle: ws ? `工作空间: ${ws}` : "主目录",
      handler: () => ctx.navigateToWorkspace(ws),
    });
  }

  // ---- Agent navigation commands ----
  for (const agent of ctx.agents) {
    commands.push({
      id: `agent.${agent.id}`,
      type: "navigate",
      icon: agent.title?.includes("codex") ? "Cx" : "Cl",
      title: agent.title || "(无标题)",
      subtitle: "继续这个对话",
      handler: () => ctx.navigateToAgent(agent.id),
    });
  }

  // ---- "自由模式" (no agent selected) ----
  commands.push({
    id: "agent.none",
    type: "navigate",
    icon: "🆓",
    title: "自由对话（不绑 agent）",
    subtitle: "每次都是新会话",
    handler: () => ctx.navigateToAgent(null),
  });

  return commands;
}
