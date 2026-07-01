/**
 * Syntax highlighting themes for Jarvis
 *
 * Simplified version for paseo compatibility.
 */

export type SyntaxThemeId =
  | "github-dark"
  | "github-light"
  | "monokai"
  | "dracula"
  | "nord"
  | "vscode-dark";

export interface SyntaxThemeOption {
  id: SyntaxThemeId;
  label: string;
}

export const SYNTAX_THEME_OPTIONS: SyntaxThemeOption[] = [
  { id: "github-dark", label: "GitHub Dark" },
  { id: "github-light", label: "GitHub Light" },
  { id: "monokai", label: "Monokai" },
  { id: "dracula", label: "Dracula" },
  { id: "nord", label: "Nord" },
  { id: "vscode-dark", label: "VS Code Dark" },
];
