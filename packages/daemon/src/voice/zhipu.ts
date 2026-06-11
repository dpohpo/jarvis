/**
 * Zhipu GLM ASR/TTS client — TypeScript port of the proven calls in
 * /Volumes/金阳/hey_jarvis (agent_client.py transcribe, tts_router.py _glm_tts).
 *
 * ASR: POST multipart {model, file(wav), stream:false} → {"text": ...}
 * TTS: POST JSON {model, input, voice} → WAV binary
 */
import { readFileSync, existsSync } from "node:fs";

// Coding-plan subscribers must use the coding base, NOT the standard paas base
// (the standard base bills the pay-as-you-go account → 1113 欠费 even when the
// coding plan has quota). Override with JARVIS_ZHIPU_BASE if needed.
const BASE =
  process.env.JARVIS_ZHIPU_BASE ?? "https://open.bigmodel.cn/api/coding/paas/v4";
const ASR_URL = `${BASE}/audio/transcriptions`;
const ASR_MODEL = "glm-asr-2512";
const TTS_URL = `${BASE}/audio/speech`;
const TTS_MODEL = "glm-tts";
const TTS_VOICE = "tongtong";
const TTS_MAX_CHARS = 1024;

let cachedKey: string | null = null;

/** env JARVIS_ZHIPU_KEY first; falls back to the key in hey_jarvis/config.py. */
export function zhipuKey(): string {
  if (cachedKey) return cachedKey;
  const fromEnv = process.env.JARVIS_ZHIPU_KEY;
  if (fromEnv) return (cachedKey = fromEnv);
  const configPy = "/Volumes/金阳/hey_jarvis/config.py";
  if (existsSync(configPy)) {
    const m = readFileSync(configPy, "utf8").match(/ZHIPU_API_KEY\s*=\s*"([^"]+)"/);
    if (m?.[1]) return (cachedKey = m[1]);
  }
  throw new Error("no Zhipu API key: set JARVIS_ZHIPU_KEY");
}

export async function transcribe(wavBytes: Uint8Array, timeoutMs = 15000): Promise<string> {
  const form = new FormData();
  form.append("model", ASR_MODEL);
  form.append(
    "file",
    new Blob([Buffer.from(wavBytes)], { type: "audio/wav" }),
    "audio.wav",
  );
  form.append("stream", "false");

  const res = await fetch(ASR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${zhipuKey()}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`GLM-ASR ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

/** Strip markdown noise so TTS doesn't read asterisks aloud (mirrors tts_router). */
export function cleanForTts(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "（代码略）")
    .replace(/[*_`#>|-]+/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "链接")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TTS_MAX_CHARS);
}

export async function synthesize(text: string, timeoutMs = 15000): Promise<Uint8Array | null> {
  const cleaned = cleanForTts(text);
  if (!cleaned) return null;
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${zhipuKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: TTS_MODEL, input: cleaned, voice: TTS_VOICE }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    console.error(`[tts] GLM-TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf.length > 44 ? buf : null;
}
