/**
 * `pnpm --filter @jarvis/daemon pair` — ask the running daemon for a one-time
 * pairing token and render it as a QR code for the phone to scan.
 */
import qrcode from "qrcode-terminal";

const ADMIN_PORT = Number(process.env.JARVIS_ADMIN_PORT ?? 8788);

const res = await fetch(`http://127.0.0.1:${ADMIN_PORT}/pair`, { method: "POST" });
if (!res.ok) {
  console.error(`daemon admin returned ${res.status} — is the daemon running?`);
  process.exit(1);
}
const info = (await res.json()) as Record<string, string>;
const qrPayload = JSON.stringify(info);

console.log("\n用手机 Jarvis App 扫描下方二维码（5 分钟内有效，一次性）：\n");
qrcode.generate(qrPayload, { small: true }, (q: string) => console.log(q));
console.log(`\n或手动输入配对信息:\n${qrPayload}\n`);
