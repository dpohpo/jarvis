/**
 * Built-in slash commands — triggered in the composer by typing "/".
 *
 * Each command provides:
 * - name: Unique identifier (e.g., "clear")
 * - description: What it does (shown in Command Center)
 * - handler: Function that executes the command
 */

import type { ThemeName } from "../theme";

export interface SlashCommand {
  name: string;
  description: string;
  handler: (context: SlashCommandContext) => void | Promise<void>;
}

export interface SlashCommandContext {
  /** Clear the current chat surface. */
  clearChat: () => void;
  /** Create a new agent (clears selectedAgentId + chat). */
  newAgent: () => void;
  /** Switch theme. */
  setTheme: (name: ThemeName) => void;
  /** Open agents list sheet. */
  openAgentsSheet: () => void;
  /** Open settings sheet. */
  openSettingsSheet: () => void;
  /** Show help message. */
  showHelp: (message: string) => void;
  /** Current input text (for commands that consume it). */
  inputText: string;
  /** Set input text (for commands that modify it). */
  setInputText: (text: string) => void;
}

/** Registry of all built-in slash commands. */
export const BUILT_IN_COMMANDS: SlashCommand[] = [
  {
    name: "clear",
    description: "清空当前对话显示",
    handler: ({ clearChat, showHelp }) => {
      clearChat();
      showHelp("对话已清空");
    },
  },
  {
    name: "new",
    description: "新建会话",
    handler: ({ newAgent, showHelp }) => {
      newAgent();
      showHelp("✚ 新对话已就绪 — 下条消息会创建新会话");
    },
  },
  {
    name: "theme",
    description: "切换主题 (dark/zinc/midnight/claude/ghostty/light)",
    handler: async ({ setTheme, inputText, showHelp }) => {
      // Parse theme name from input: "/theme zinc" → "zinc"
      const parts = inputText.trim().split(/\s+/);
      const themeName = parts[1]?.toLowerCase() as ThemeName;

      const validThemes: ThemeName[] = ["dark", "zinc", "midnight", "claude", "ghostty", "light"];
      if (!themeName || !validThemes.includes(themeName)) {
        showHelp(
          `可用主题: ${validThemes.join(", ")}\n用法: /theme ${validThemes[0]}`,
        );
        return;
      }

      setTheme(themeName);
      showHelp(`主题已切换到 ${themeName}`);
    },
  },
  {
    name: "help",
    description: "显示帮助",
    handler: ({ showHelp }) => {
      showHelp(
        "可用命令:\n" +
          "/clear - 清空对话\n" +
          "/new - 新建会话\n" +
          "/theme <名称> - 切换主题\n" +
          "/agents - 打开会话列表\n" +
          "/settings - 打开设置",
      );
    },
  },
  {
    name: "agents",
    description: "打开会话列表",
    handler: ({ openAgentsSheet }) => {
      openAgentsSheet();
    },
  },
  {
    name: "settings",
    description: "打开设置",
    handler: ({ openSettingsSheet }) => {
      openSettingsSheet();
    },
  },
];

/**
 * Parse input text to extract slash command.
 * Returns null if input doesn't start with "/".
 */
export function parseSlashCommand(input: string): SlashCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  // Extract command name: "/theme zinc" → "theme"
  const parts = trimmed.slice(1).split(/\s+/);
  const commandName = parts[0]?.toLowerCase();

  if (!commandName) return null;

  return (
    BUILT_IN_COMMANDS.find((cmd) => cmd.name === commandName) ?? null
  );
}
