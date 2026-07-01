/**
 * use-settings hook for Jarvis
 *
 * Simplified version of paseo's use-settings, adapted for Jarvis theme system.
 */

import { useState, useCallback } from "react";

export type SendBehavior = "interrupt" | "queue";
export type ServiceUrlBehavior = "ask" | "in-app" | "external";

export interface AppSettings {
  // Theme
  theme: "dark" | "light" | "zinc" | "midnight" | "claude" | "ghostty" | "auto";
  syntaxTheme: string;

  // Fonts
  uiFontFamily: string;
  monoFontFamily: string;
  uiFontSize: number;
  codeFontSize: number;

  // Behavior
  sendBehavior: SendBehavior;
  serviceUrlBehavior: ServiceUrlBehavior;
  language: string;
  terminalScrollbackLines: number;

  // Desktop
  releaseChannel: "stable" | "beta";
}

export interface EffectiveSettings {
  releaseChannel: "stable" | "beta";
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  syntaxTheme: "github-dark",
  uiFontFamily: "system-ui",
  monoFontFamily: "monospace",
  uiFontSize: 16,
  codeFontSize: 14,
  sendBehavior: "interrupt",
  serviceUrlBehavior: "ask",
  language: "zh-CN",
  terminalScrollbackLines: 10000,
  releaseChannel: "stable",
};

let globalSettings: AppSettings = { ...DEFAULT_SETTINGS };

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(globalSettings);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    globalSettings = { ...globalSettings, ...updates };
    setSettings(globalSettings);
    // TODO: Persist to AsyncStorage
  }, []);

  return {
    settings,
    updateSettings,
    isLoading: false,
  };
}

export function useSettings() {
  return useAppSettings();
}

export function parseTerminalScrollbackLines(value: string): number | null {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1000 || parsed > 100000) {
    return null;
  }
  return parsed;
}

export const MAX_CODE_FONT_SIZE = 24;
export const MAX_UI_FONT_SIZE = 20;
export const MIN_CODE_FONT_SIZE = 10;
export const MIN_UI_FONT_SIZE = 12;

export function parseClampedFontSize(
  value: string,
  options: { min: number; max: number },
): number | null {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return null;
  if (parsed < options.min) return options.min;
  if (parsed > options.max) return options.max;
  return parsed;
}

export function sanitizeFontFamily(value: string): string | null {
  const sanitized = value.trim();
  if (!sanitized) return null;
  if (sanitized.length > 100) return null; // Prevent abuse
  return sanitized;
}
