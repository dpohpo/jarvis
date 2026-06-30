/**
 * Codex CLI provider implementation.
 */
import { findCodexBin } from "../codex.js";
import { runCodex } from "../codex.js";
import type { Provider, SpawnOpts } from "../provider-registry.js";

export const codexProvider: Provider = {
  id: "codex",
  name: "Codex CLI",
  isAvailable(): boolean {
    return !!findCodexBin();
  },
  listModels(): string[] {
    // OpenAI / Codex models (as of 2026-06)
    return [
      "gpt-5",
      "gpt-5-codex",
      "o3",
    ];
  },
  spawn(opts: SpawnOpts) {
    // Codex supports `-m <model>` flag. We could pass opts.model via
    // JARVIS_CODEX_MODEL env, but for now we let the default apply.
    return runCodex({
      prompt: opts.prompt,
      workdir: opts.workdir,
      resumeSessionId: opts.resumeSessionId,
      onEvent: opts.onEvent,
      onSessionId: opts.onSessionId,
    });
  },
};
