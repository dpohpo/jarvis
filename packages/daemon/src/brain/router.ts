/**
 * Brain router — one GLM-4.7 call (coding-plan endpoint, thinking disabled,
 * verified live) that simultaneously:
 *   1. cleans the raw ASR transcript (Typeless-style: fillers out, self-
 *      corrections resolved, intent preserved),
 *   2. injects user-specific vocabulary from ~/.jarvis/dict.json so ASR
 *      mis-transcriptions of project names, slash commands, brand jargon
 *      are corrected back to the canonical form,
 *   3. decides what to do: answer directly / dispatch a computer task /
 *      ask a clarifying question,
 *   4. writes the spoken reply.
 *
 * Persistence:
 *   - chatHistory (in-memory Map in index.ts, per-device, last 20 turns)
 *   - ~/.jarvis/memory.jsonl — every (user, assistant) Turn pair is appended
 *     here so the brain has long-term recall across daemon restarts. Loaded
 *     lazily on first route() call, cached, and tailed for new entries.
 *
 * Output is strict JSON (no function-calling API dependency); zod-validated
 * with one retry. The router NEVER executes anything itself — task dispatch
 * still flows through the deterministic approval gate.
 */
import { z } from "zod";
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const BASE =
  process.env.JARVIS_ZHIPU_BASE ?? "https://open.bigmodel.cn/api/coding/paas/v4";
const MODEL = process.env.JARVIS_BRAIN_MODEL ?? "glm-4.7";

const Decision = z.object({
  action: z.enum(["answer", "task", "clarify"]),
  /** Spoken reply (answer/clarify) or acknowledgement before a task starts. */
  reply: z.string().default(""),
  /** Cleaned, self-contained task instruction for the executor (task only). */
  task: z.string().default(""),
});
export type Decision = z.infer<typeof Decision>;

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

// ---- User vocabulary (~/.jarvis/dict.json) ---------------------------------

let _dictCache: string[] | null = null;

function loadDict(): string[] {
  if (_dictCache !== null) return _dictCache;
  const dictPath = process.env.JARVIS_DICT_PATH ?? join(homedir(), ".jarvis", "dict.json");
  try {
    if (!existsSync(dictPath)) {
      _dictCache = [];
      return _dictCache;
    }
    const raw = readFileSync(dictPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("[brain] dict.json is not an array, ignoring");
      _dictCache = [];
      return _dictCache;
    }
    _dictCache = parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
    console.log(`[brain] dict.json loaded: ${_dictCache.length} terms`);
    return _dictCache;
  } catch (e) {
    console.warn(`[brain] dict.json load failed: ${String(e)}`);
    _dictCache = [];
    return _dictCache;
  }
}

// ---- Long-term memory (~/.jarvis/memory.jsonl) -----------------------------

const MEMORY_PATH = process.env.JARVIS_MEMORY_PATH ?? join(homedir(), ".jarvis", "memory.jsonl");
let _memoryCache: Turn[] | null = null;
let _memoryLoadedAt = 0;

function loadMemory(): Turn[] {
  // Reload if file mtime advanced since last load (cheap stat).
  try {
    if (!existsSync(MEMORY_PATH)) return [];
    const stats = readFileSync(MEMORY_PATH, "utf8");  // also serves as existence check
    if (_memoryCache !== null && Date.now() - _memoryLoadedAt < 60_000) {
      return _memoryCache;
    }
    const lines = stats.split(/\r?\n/).filter(Boolean);
    const turns: Turn[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as Turn;
        if (parsed && (parsed.role === "user" || parsed.role === "assistant") && typeof parsed.content === "string") {
          turns.push(parsed);
        }
      } catch {
        // skip malformed line
      }
    }
    _memoryCache = turns.slice(-40);  // last 20 turn pairs
    _memoryLoadedAt = Date.now();
    return _memoryCache;
  } catch {
    return _memoryCache ?? [];
  }
}

export function rememberTurn(turn: Turn): void {
  try {
    const dir = dirname(MEMORY_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(MEMORY_PATH, JSON.stringify(turn) + "\n", "utf8");
    if (_memoryCache !== null) {
      _memoryCache.push(turn);
      _memoryCache = _memoryCache.slice(-40);
    }
  } catch (e) {
    console.warn(`[brain] memory append failed: ${String(e)}`);
  }
}

// ---- System prompt ---------------------------------------------------------

function buildSystemPrompt(): string {
  const dict = loadDict();
  const dictSection =
    dict.length === 0
      ? ""
      : `\n\n用户专属词汇表（ASR 转写时如果听到类似发音，优先匹配成这些词；不要把它们当错字纠正）：\n${dict.map((w) => `- ${w}`).join("\n")}`;

  return `你是 Jarvis，用户的私人语音管家，运行在他的 Mac 上，能操作这台电脑（写代码、跑命令、管文件等，由下游执行器完成）。

你收到的是语音转写文本，可能有错字、口语填充词（嗯、呃、那个）、中途改口。先在心里清洗它：去掉填充词，改口以最后说的为准，保留完整意图。

然后判断并输出 JSON（只输出 JSON，不要别的）：
{"action": "answer" | "task" | "clarify", "reply": "...", "task": "..."}

规则：
- "answer"：闲聊、问答、查询你已知的信息 → reply 写口语化回答（将被朗读，简短自然，不用 markdown，不超过3句）
- "task"：需要操作电脑（创建/修改文件、写代码、跑命令、查电脑上的东西）→ task 写清洗后的完整指令（书面化、自包含），reply 写一句简短确认（如"好的，这就去办"）
- "clarify"：意图缺关键信息无法执行 → reply 写一个具体的反问（一次只问一件事）
- 宁可 task 也不要把电脑操作误判为 answer；宁可 clarify 也不要瞎猜关键参数
- 用户说中文你就用中文回答${dictSection}`;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s.trim();
}

async function callGlm(messages: ChatMessage[], timeoutMs = 20_000): Promise<string> {
  const key = process.env.JARVIS_ZHIPU_KEY;
  if (!key) throw new Error("JARVIS_ZHIPU_KEY not set");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      thinking: { type: "disabled" },
      temperature: 0.3,
      max_tokens: 500,
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`glm ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function route(transcript: string, history: Turn[]): Promise<Decision> {
  // Long-term recall: blend persisted memory (last 20 turns across all
  // sessions) with the in-memory per-device history (last 10 turns this
  // session). Dedup by simple content match so we don't double-feed the
  // same line.
  const memory = loadMemory();
  const seenContent = new Set<string>();
  const blended: Turn[] = [];
  for (const t of [...memory, ...history]) {
    const key = `${t.role}:${t.content.slice(0, 64)}`;
    if (seenContent.has(key)) continue;
    seenContent.add(key);
    blended.push(t);
  }
  const recent = blended.slice(-12);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    ...recent,
    { role: "user", content: transcript },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callGlm(messages);
    const candidate = extractJson(raw);
    try {
      const parsed = Decision.safeParse(JSON.parse(candidate));
      if (parsed.success) return parsed.data;
    } catch {
      // fall through to retry
    }
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: "你的输出不是合法 JSON。只输出 {\"action\":...,\"reply\":...,\"task\":...}",
    });
  }
  // brain unreachable/incoherent — degrade to direct task dispatch (old D1 path)
  return { action: "task", task: transcript, reply: "好的。" };
}
