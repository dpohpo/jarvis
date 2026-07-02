/**
 * Deterministic approval gate. This is CODE, not LLM judgement — an LLM can be
 * sweet-talked by prompt injection; a regex cannot.
 *
 * Tier 1: runs silently. Tier 2: runs, phone gets notified. Tier 3: blocks
 * until the phone approves; timeout = deny.
 */
export type Tier = 1 | 2 | 3;

const TIER3_PATTERNS: RegExp[] = [
  // Shell-shaped danger
  /\bsudo\b/,
  /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i, // rm -rf and friends
  /\bgit\s+push\s+.*--force/,
  /\b(curl|wget)\b.*\|\s*(ba|z)?sh\b/, // pipe-to-shell
  /\bdiskutil\b|\bmkfs\b|\bdd\s+if=/,
  /\b(shutdown|reboot|halt)\b/,
  /\bsecurity\s+(dump-keychain|find-generic-password)/,
  // Intent-shaped danger: sending / posting / forwarding to external services.
  // These need user approval because they leave the local machine and can't
  // be undone. Matches both Chinese (发送/转发/发到) and English (send/post).
  // Note: \b doesn't work on CJK characters in JS regex, so we omit \b around
  // Chinese terms and rely on the (capture)+ instead.
  /(发送|发送给|发给|发到|发至|转发|转告|告诉|通知)[\s\S]{0,80}(微信|企业微信|文件传输助手|邮件|email|slack|discord|telegram|朋友圈|公众号|QQ|手机号|电话|短信|sms|老婆|老公|老板|同事|客户|朋友|爸妈|父母)/i,
  /\b(send|post|forward|share|message)\b[\s\S]{0,80}\b(to|via|through)\b[\s\S]{0,80}\b(wechat|wecom|email|slack|discord|telegram|whatsapp|sms|phone)\b/i,
  // Deleting user data
  /(删除|清空|抹掉|清除)[\s\S]{0,80}(文件|文件夹|桌面|文档|图片|照片|数据库)/i,
  /\b(delete|wipe|clear|purge)\b[\s\S]{0,80}\b(files?|folder|desktop|documents?|photos?|database)\b/i,
  // Modifying system config / installing software
  /(安装|卸载|升级|更新)[\s\S]{0,80}(软件|应用|app|系统|驱动|service)/i,
  /\b(install|uninstall|upgrade|update)\b[\s\S]{0,80}\b(software|app|application|system|driver|service)\b/i,
  // Money / payments / API keys
  /(支付|付款|转账|买|订购)/,
  /\b(pay|payment|transfer|purchase|order)\b/i,
  /(api[_\s-]?key|secret|token|password|密码|口令|密钥)/i,
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
