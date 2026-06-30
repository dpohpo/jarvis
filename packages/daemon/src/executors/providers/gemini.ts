/**
 * Gemini CLI provider (stub — not yet implemented).
 */
import type { Provider, SpawnOpts } from "../provider-registry.js";

export const geminiProvider: Provider = {
  id: "gemini",
  name: "Gemini CLI",
  isAvailable(): boolean {
    // Gemini CLI not integrated yet
    return false;
  },
  listModels(): string[] {
    return [];
  },
  spawn(_opts: SpawnOpts) {
    throw new Error("Gemini provider is not available yet");
  },
};
