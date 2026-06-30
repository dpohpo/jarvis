/**
 * Claude Code provider implementation.
 */
import { findClaudeBin } from "../claude-code.js";
import { runClaudeCode } from "../claude-code.js";
import type { Provider, SpawnOpts } from "../provider-registry.js";

export const claudeProvider: Provider = {
  id: "claude",
  name: "Claude Code",
  isAvailable(): boolean {
    try {
      return !!findClaudeBin();
    } catch {
      return false;
    }
  },
  listModels(): string[] {
    // Claude Code models (as of 2026-06)
    return [
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ];
  },
  spawn(opts: SpawnOpts) {
    // Claude Code model selection is via environment variable ANTHROPIC_MODEL,
    // not a CLI flag. We could set it in the child env, but for now we ignore
    // opts.model and let the default apply.
    return runClaudeCode({
      prompt: opts.prompt,
      workdir: opts.workdir,
      resumeSessionId: opts.resumeSessionId,
      onEvent: opts.onEvent,
      onSessionId: opts.onSessionId,
    });
  },
};
