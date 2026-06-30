/**
 * Provider registry — unified abstraction for Claude Code / Codex / Copilot / Gemini.
 *
 * Each provider encapsulates:
 *   - Availability check (CLI installed + logged in)
 *   - Model listing
 *   - Spawning a task (headless or tmux)
 *
 * The daemon registers all providers at startup and routes agent.create /
 * agent.message through the appropriate provider based on the agent's
 * provider field.
 */
import type { RunningTask } from "./claude-code.js";

export interface Provider {
  /** Unique identifier (e.g. "claude", "codex", "copilot", "gemini"). */
  id: string;
  /** Human-readable name for UI display. */
  name: string;
  /** Check if the CLI is installed and authenticated. */
  isAvailable(): boolean;
  /** Return list of available model IDs for this provider. */
  listModels(): string[];
  /** Spawn a new task (or resume an existing session). */
  spawn(opts: SpawnOpts): RunningTask;
}

export interface SpawnOpts {
  prompt: string;
  workdir: string;
  resumeSessionId?: string;
  /** Optional model override (e.g. "claude-opus-4-6", "gpt-5"). */
  model?: string;
  onEvent: (e: { ev: string; data: string }) => void;
  onSessionId?: (sid: string) => void;
}

const providers = new Map<string, Provider>();

/**
 * Register a provider. Called at daemon startup for all known providers.
 */
export function registerProvider(provider: Provider): void {
  providers.set(provider.id, provider);
}

/**
 * Get a provider by ID. Returns undefined if not found.
 */
export function getProvider(id: string): Provider | undefined {
  return providers.get(id);
}

/**
 * List all registered providers.
 */
export function listProviders(): Provider[] {
  return Array.from(providers.values());
}
