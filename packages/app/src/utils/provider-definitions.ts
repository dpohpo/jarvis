/**
 * Provider definitions for Jarvis
 *
 * Simplified version for paseo providers section compatibility.
 */

import type { ProviderEntry } from "@/hooks/use-providers-snapshot";

export interface ProviderDefinition {
  id: string;
  label: string;
}

export function buildProviderDefinitions(entries: ProviderEntry[]): ProviderDefinition[] {
  return entries.map((entry) => ({
    id: entry.provider,
    label: entry.provider,
  }));
}
