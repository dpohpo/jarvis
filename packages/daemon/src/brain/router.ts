/**
 * Brain router — one GLM-5.1 call (coding-plan endpoint, thinking disabled,
 * verified live) that simultaneously:
 *   1. cleans the raw ASR transcript (Typeless-style: fillers out, self-
 *      corrections resolved, intent preserved),
 *   2. decides what to do: answer directly / dispatch a computer task /
 *      ask a clarifying question,
 *   3. writes the spoken reply.
 *
 * Output is strict JSON (no function-calling API dependency); zod-validated
 * with one retry. The router NEVER executes anything itself — task dispatch
 * still flows through the deterministic approval gate.
 */
import { z } from "zod";
import { dictPromptHint, reloadIfStale } from "./dict.js";

const BASE =
  process.env.JARVIS_ZHIPU_BASE ?? "https://open.bigmodel.cn/api/coding/paas/v4";
const MODEL = process.env.JARVIS_BRAIN_MODEL ?? "glm-5.1";

const Decision = z.object({
  action: z.enum(["answer", "task", "clarify", "workspace"]),
  /** Spoken reply (answer/clarify) or acknowledgement before a task starts. */
  reply: z.string().default(""),
  /** Cleaned, self-contained task instruction for the executor (task only). */
  task: z.string().default(""),
  /** Workspace name when action === "workspace" (must match one of the listed names; "" = root). */
  workspace: z.string().default(""),
});
export type Decision = z.infer<typeof Decision>;

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `你是 Jarvis，用户的私人语音管家，运行在他的 Mac 上，能操作这台电脑（写代码、跑命令、管文件等，由下游执行器完成）。

你收到的是语音转写文本，可能有错字、口语填充词（嗯、呃、那个）、中途改口。先在心里清洗它：去掉填充词，改口以最后说的为准，保留完整意图。

特别注意 STT 错字模式：英文短词/缩写经常被识别成中文同音字（bht → 必海天；glm → 鸡腾妹；mcp → 麦克匹），英文产品名会被音译（Claude → 克劳德），斜杠技能名（/xxx）经常被吞掉斜杠或拆成中文短句。请根据发音相似度 + 上下文还原这些词的原始形式（参考文末的「用户标准词汇表」）。

然后判断并输出 JSON（只输出 JSON，不要别的）：
{"action": "answer" | "task" | "clarify", "reply": "...", "task": "..."}

规则：
- "answer"：闲聊、问答、查询你已知的信息 → reply 写口语化回答（将被朗读，简短自然，不用 markdown，不超过3句）
- "task"：需要操作电脑（创建/修改文件、写代码、跑命令、查电脑上的东西）→ task 写清洗后的完整指令（书面化、自包含），reply 写一句简短确认（如"好的，这就去办"）
- "clarify"：意图缺关键信息无法执行 → reply 写一个具体的反问（一次只问一件事）
- 宁可 task 也不要把电脑操作误判为 answer；宁可 clarify 也不要瞎猜关键参数
- task 字段会被原封不动发给 Claude Code（下游 AI 编程助手），所以必须精确：技能名（/xxx）、文件路径、命令参数、专有名词的大小写和斜杠都要按用户的标准词汇表还原。
- 用户说中文你就用中文回答

- 如果用户想切换工作空间(workspace/project),输出 action="workspace",workspace 字段写 workspace 名字(必须在下面的「可用工作空间」列表里,精确匹配区分大小写;"空字符串"代表根目录)。reply 写一句简短确认。
- 可用工作空间列表会以「可用工作空间:[a, b, c]」形式附在末尾。用户可能用各种说法指代:项目名、目录名、"切到 X"、"打开 X 项目"、"回到主目录"(="")。`;

/** Build the system prompt with the latest dictionary hint appended. */
function buildSystemPrompt(workspaces: string[] = []): string {
  // Pick up dict edits without a daemon restart.
  reloadIfStale();
  let p = SYSTEM_PROMPT + dictPromptHint();
  if (workspaces.length > 0) {
    p += `\n\n[可用工作空间] ${JSON.stringify(workspaces)}`;
  }
  return p;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Pull the first {...} block out of possibly-fenced output. */
function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s.trim();
}

const FALLBACK_MODELS = ["glm-4.6", "glm-4-flash"];
const RETRY_BACKOFF_MS = [800, 1600];

class GlmRateLimitError extends Error {}

async function callOnce(
  model: string,
  messages: ChatMessage[],
  timeoutMs: number,
): Promise<string> {
  const key = process.env.JARVIS_ZHIPU_KEY;
  if (!key) throw new Error("JARVIS_ZHIPU_KEY not set");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      thinking: { type: "disabled" },
      temperature: 0.3,
      max_tokens: 500,
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text();
    // 429 / 1305 "该模型当前访问量过大" — GLM 服务端瞬时拥塞，重试 + 降级有效
    if (res.status === 429 || body.includes("1305") || body.includes("访问量过大")) {
      throw new GlmRateLimitError(`glm ${res.status}: ${body.slice(0, 200)}`);
    }
    throw new Error(`glm ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function callGlm(messages: ChatMessage[], timeoutMs = 20_000): Promise<string> {
  const models = [MODEL, ...FALLBACK_MODELS];
  let lastErr: unknown;
  for (const model of models) {
    const attempts = model === MODEL ? 1 + RETRY_BACKOFF_MS.length : 1;
    for (let i = 0; i < attempts; i++) {
      try {
        return await callOnce(model, messages, timeoutMs);
      } catch (e) {
        lastErr = e;
        if (e instanceof GlmRateLimitError) {
          // Same model: backoff and retry. Fallback model: just try once.
          if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[i]));
            continue;
          }
          break; // try next fallback model
        }
        throw e; // non-retryable: bubble up immediately
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("glm call failed");
}

export async function route(
  transcript: string,
  history: Turn[],
  workspaces: string[] = [],
): Promise<Decision> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(workspaces) },
    ...history.slice(-10),
    { role: "user", content: transcript },
  ];

  // Phase 15-v10 P0-3: single-shot. Previously this looped twice on bad
  // JSON, which meant a +800/1600ms backoff retry that rarely succeeded —
  // when GLM emits non-JSON it's almost always upstream throttling, not
  // prompt confusion. Fail fast and let the caller fall back to direct
  // task dispatch (which the surrounding try/catch in runOneCmd already
  // handles).
  const raw = await callGlm(messages);
  const candidate = extractJson(raw);
  try {
    const parsed = Decision.safeParse(JSON.parse(candidate));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through to fallback
  }
  return { action: "task", task: transcript, reply: "好的。", workspace: "" };
}
