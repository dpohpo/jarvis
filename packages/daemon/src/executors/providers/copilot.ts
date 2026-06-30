/**
 * GitHub Copilot provider (stub — not yet implemented).
 */
import type { Provider, SpawnOpts } from "../provider-registry.js";

export const copilotProvider: Provider = {
  id: "copilot",
  name: "GitHub Copilot",
  isAvailable(): boolean {
    // Copilot CLI not integrated yet
    return false;
  },
  listModels(): string[] {
    return [];
  },
  spawn(_opts: SpawnOpts) {
    throw new Error("Copilot provider is not available yet");
  },
};
