/**
 * STT correction vocabulary.
 *
 * Design (revised after user feedback):
 *   The user does NOT maintain "wrong-form → standard-form" aliases — they
 *   can't predict what faster-whisper will mishear. Instead they list only the
 *   correct terms (skill names, product names, proper nouns, etc.), and the
 *   brain router LLM does the fuzzy matching: similar pronunciation, context,
 *   and the dictionary as a "standard target" list.
 *
 * Dictionary file (~/.jarvis/dict.json) is a flat JSON array of canonical
 * tokens the user wants preserved in the final prompt:
 *
 *   [
 *     "/bht",
 *     "/codereview",
 *     "/commit",
 *     "OpenClaw",
 *     "Claude Code",
 *     "网易云音乐"
 *   ]
 *
 * The whole list is injected into the router's system prompt as a "standard
 * vocabulary" — see dictPromptHint(). No deterministic replacement is done;
 * the LLM is the only judge. This is intentional: STT errors are open-ended
 * (bht → 必海天 / BHT / 比海天 / 毕赫提…), and trying to enumerate them in a
 * side-table is a losing game.
 *
 * The dict is loaded once and cached. Hot-reload via reloadIfStale() (checks
 * file mtime; cheap to call on every voice turn).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_DICT_PATH = join(homedir(), ".jarvis", "dict.json");

export interface SttDict {
  /** Canonical tokens the user wants preserved (in declared order). */
  words: string[];
  loadedFrom: string;
  loadedAt: number;
}

const EMPTY: SttDict = { words: [], loadedFrom: "", loadedAt: 0 };

let cached: SttDict | null = null;

/**
 * Load and parse the dictionary file.
 *
 * Accepts a plain JSON array of strings:
 *   ["/bht", "OpenClaw", "网易云音乐"]
 *
 * Also accepts a legacy object form ({wrong: right, ...}) by collecting the
 * values — so the user can freely switch formats without breaking.
 */
export function loadDict(path: string = DEFAULT_DICT_PATH): SttDict {
  if (!existsSync(path)) return { ...EMPTY, loadedFrom: path };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    let words: string[] = [];

    if (Array.isArray(raw)) {
      words = raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    } else if (raw && typeof raw === "object") {
      // Legacy alias form: collect values (the canonical forms).
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (k.startsWith("_")) continue; // skip comments
        if (typeof v === "string" && v.trim()) words.push(v);
      }
      // Also support { words: [...] } / { vocabulary: [...] } shapes.
      const arrField = (raw as { words?: unknown; vocabulary?: unknown });
      if (Array.isArray(arrField.words)) {
        for (const w of arrField.words) if (typeof w === "string" && w.trim()) words.push(w);
      }
      if (Array.isArray(arrField.vocabulary)) {
        for (const w of arrField.vocabulary) if (typeof w === "string" && w.trim()) words.push(w);
      }
    }

    // De-duplicate while preserving declared order.
    const seen = new Set<string>();
    words = words.filter((w) => {
      const key = w.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { words, loadedFrom: path, loadedAt: Date.now() };
  } catch (e) {
    console.error(`[dict] failed to load ${path}:`, e);
    return { ...EMPTY, loadedFrom: path };
  }
}

export function getDict(): SttDict {
  if (!cached) cached = loadDict();
  return cached;
}

export function reloadDict(): SttDict {
  cached = loadDict();
  console.log(`[dict] reloaded ${cached.words.length} words from ${cached.loadedFrom}`);
  return cached;
}

export function reloadIfStale(): SttDict {
  const d = getDict();
  if (!d.loadedFrom) return d;
  try {
    const mtime = statSync(d.loadedFrom).mtimeMs;
    if (mtime > d.loadedAt) return reloadDict();
  } catch {
    /* file vanished — keep stale cache */
  }
  return d;
}

/**
 * Standard-vocabulary hint appended to the router's system prompt.
 *
 * The LLM uses this as a "target list" when correcting STT errors: if the
 * transcript contains a word that sounds like / looks like / could be a
 * mishearing of one of these canonical tokens, prefer the canonical form in
 * the output. Slash-prefixed entries are Claude Code skill names and MUST be
 * restored exactly.
 */
export function dictPromptHint(dict: SttDict = getDict()): string {
  if (dict.words.length === 0) return "";
  const formatted = dict.words.map((w) => `「${w}」`).join("、");
  return `

[用户的标准词汇表] ${formatted}

STT 经常会把以下几类词识别错，请根据发音相似度、上下文和上面的词汇表进行纠正：
1. 英文短词/缩写 → 中文同音错字（例：bht → 必海天；glm → 鸡腾妹；mcp → 麦克匹）
2. 英文产品名 → 中文音译或近音字（例：Claude → 克劳德；OpenClaw → 欧本克劳 / openclone）
3. 斜杠开头的技能名（/xxx）→ 中文短句或字母（例：/bht → 使用技能 bht / 必海天）
4. 专有名词 → 常见同音字

纠正规则：
- 如果 STT 文本中某个词（尤其是中文字段）发音或形似词汇表中的某个条目，且上下文支持，必须替换为词汇表里的原始形式（区分大小写、保留斜杠）。
- 技能名（/ 开头）特别关键，因为下游对接的是 Claude Code，技能名必须精确。
- 如果不确定，宁可在 task 字段里保留原词并在 reply 里反问确认。
- 纠正后的 task 字段应当是书面化、自包含的正式 prompt。`;
}
