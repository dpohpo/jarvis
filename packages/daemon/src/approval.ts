/**
 * Deterministic approval gate. This is CODE, not LLM judgement — an LLM can be
 * sweet-talked by prompt injection; a regex cannot.
 *
 * Tier 1: runs silently. Tier 2: runs, phone gets notified. Tier 3: blocks
 * until the phone approves; timeout = deny.
 */
export type Tier = 1 | 2 | 3;

const TIER3_PATTERNS: RegExp[] = [
  /\bsudo\b/,
  /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i, // rm -rf and friends
  /\bgit\s+push\s+.*--force/,
  /\b(curl|wget)\b.*\|\s*(ba|z)?sh\b/, // pipe-to-shell
  /\bdiskutil\b|\bmkfs\b|\bdd\s+if=/,
  /\b(shutdown|reboot|halt)\b/,
  /\bsecurity\s+(dump-keychain|find-generic-password)/,
];

const TIER2_PATTERNS: RegExp[] = [/\bgit\s+(commit|push)\b/, /\bnpm\s+publish\b/];

export interface TierVerdict {
  tier: Tier;
  reason: string;
}

/**
 * Classify a natural-language command before it reaches any agent.
 * MVP heuristic: scan the text for shell-shaped danger. v1 moves this onto
 * the structured tool calls the brain emits, where matching is exact.
 */
export function classifyCommand(text: string, workdir: string): TierVerdict {
  for (const p of TIER3_PATTERNS) {
    if (p.test(text)) return { tier: 3, reason: `matches ${p}` };
  }
  // touching paths outside the sandbox workdir (~ or absolute, not under workdir)
  const pathMentions = text.match(/(?:^|[\s"'`])(\/(?:[\w.-]+\/)*[\w.-]+|~\/[\w./-]+)/g) ?? [];
  for (const raw of pathMentions) {
    const p = raw.trim().replace(/^["'`]/, "");
    const abs = p.startsWith("~/") ? p.replace("~", process.env.HOME ?? "") : p;
    if (abs.startsWith("/") && !abs.startsWith(workdir) && !abs.startsWith("/tmp")) {
      return { tier: 3, reason: `path outside workdir: ${p}` };
    }
  }
  for (const p of TIER2_PATTERNS) {
    if (p.test(text)) return { tier: 2, reason: `matches ${p}` };
  }
  return { tier: 1, reason: "default" };
}

/** Pending Tier-3 approvals, resolved by perm.response from the phone. */
export class ApprovalBroker {
  private pending = new Map<
    string,
    { resolve: (allowed: boolean) => void; timer: NodeJS.Timeout }
  >();

  wait(reqId: string, timeoutSec: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        resolve(false); // timeout = deny, always
      }, timeoutSec * 1000);
      this.pending.set(reqId, { resolve, timer });
    });
  }

  settle(reqId: string, allowed: boolean): boolean {
    const entry = this.pending.get(reqId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(reqId);
    entry.resolve(allowed);
    return true;
  }
}
