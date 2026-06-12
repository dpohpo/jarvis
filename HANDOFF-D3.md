# Jarvis D3 唤醒词 — 交接文档

> 写于 2026-06-12。上一会话后期**工具输出层出现严重不可靠**（Bash/grep/Read/Python stdout 甚至编译器报错都出现过乱码与幻觉）。**新会话第一件事：用干净工具复核本文件每一条"已完成"声明，不要轻信。** 编译器（`pnpm --filter X typecheck`）是相对最可信的裁判，但本会话末期它也给过自相矛盾的报错，务必多跑几次交叉验证。

---

## 0. 一句话现状

D3（唤醒词"Jarvis"，用 Picovoice Porcupine）**后端骨架已写并提交（commit `6f54552`）**，但 **App.tsx UI 接线没做、APK 没构建、完全没测试**。不要对用户声称 D3 完成或测试通过。

---

## 1. 整个 Jarvis 项目当前状态（git log 真实顺序，最新在上）

```
6f54552 wip(D3): Porcupine wake-word backend skeleton (App.tsx wiring + build NOT done)  ← 本次
67feaf1 docs: 全面重写 README + stop 修复代码
d5f5603 deploy: CN VPS relay setup script (深圳 ws://39.108.123.54:18790)
02cff87 deploy: Phase C live — 美国 wss://relay.xujinyangai.com
0c46eb8 feat: D2 brain router + conversational mode
716cb21 voice: coding-plan endpoint config, ~/.jarvis/env loading
eb6902c feat: D1 voice loop
7494fb9 fix: keyboard covering input
0bcfaa4 fix: pairing failures (PRNG/from_string/cleartext)
60b8790 fix: APK launch crash (expo SDK 56 版本对齐)
b061738 build: APFS sandbox APK build
...
```

**已完成并验证**：MVP 全链路、APK 真机可用、D1 语音回路、D2 大脑路由+连续对话、Phase C 双中继部署（美国 wss + 深圳 ws）、停止任务+串行队列（stop 在 commit 67feaf1，但 killTree 据 README 标注"尚未拿到一次干净的自动化 PASS"，也需复核）。

**架构速览**：手机 app(Expo RN) → relay(VPS 零知识转发) → daemon(Mac，brain+executor+voiced)。E2E 加密 libsodium。详见 `README.md`。

---

## 2. D3 已完成部分（编译器多次一致报 0 错误的，可信度较高）

### 2.1 协议 `packages/protocol/src/payloads.ts`
新增 `ConfigPush` 消息（daemon→app 下发配置）：
```ts
export const ConfigPush = z.object({
  t: z.literal("config"),
  seq: z.number().int(),
  porcupineAccessKey: z.string().optional(),
});
```
已加入 `Payload` discriminatedUnion（在 `PairAccept` 后、`VoiceStart` 前）+ `export type ConfigPush`。
**验证**：`pnpm --filter @jarvis/protocol build` 多次 errors=0。

### 2.2 daemon `packages/daemon/src/index.ts`
`handlePayload` 的 `case "hello"` 分支末尾（`log(...replayed...)` 之后、`break` 之前）加了：
```ts
if (process.env.JARVIS_PORCUPINE_KEY) {
  sendTo(from, { t: "config", seq: 0, porcupineAccessKey: process.env.JARVIS_PORCUPINE_KEY });
}
```
即每次手机 hello 上线，daemon 把 Porcupine AccessKey 加密下发。**密钥只存 Mac 的 `~/.jarvis/env`**（哲学：密钥不出 Mac）。
**验证**：`pnpm --filter @jarvis/daemon typecheck` errors=0。

### 2.3 app `packages/app/src/store.ts`
新增 wake key 独立持久化（SecureStore）：
```ts
const WAKE_KEY = "jarvis_porcupine_key";
export async function loadWakeKey(): Promise<string|null> { return SecureStore.getItemAsync(WAKE_KEY); }
export async function saveWakeKey(key: string): Promise<void> { await SecureStore.setItemAsync(WAKE_KEY, key); }
// clearState() 里也加了 deleteItemAsync(WAKE_KEY)
```

### 2.4 app `packages/app/src/client.ts`
`JarvisCallbacks` 接口加了 `onConfig?: (cfg: { porcupineAccessKey?: string }) => void;`
`handle()` 的可靠消息 switch 里加了：
```ts
case "config":
  this.cb.onConfig?.({ porcupineAccessKey: payload.porcupineAccessKey });
  break;
```

### 2.5 app `packages/app/src/wakeword.ts`（新文件，整份已写）
Porcupine 封装。导出 `initWake(accessKey, onWake)`, `startListening()`, `pauseListening()`, `destroyWake()`, `isWakeReady()`, `isListening()`。
**关键麦克风协调**：Porcupine 和 voice.ts 共用同一个 `react-native-voice-processor` 单例，只能一个占麦克风。唤醒回调里先 `pauseListening()`（释放麦）再 `onWakeCb()`（让 App 启动录音）。
**⚠️ 唯一悬而未决的 bug**：第 16 行 import 和第 54 行用的枚举名。Porcupine 4.0.0 的内置词枚举名，编译器**两次给出矛盾报错**：
- 第一次：`BuiltInKeyword` 不存在，建议 `BuiltInKeywords`
- 第二次：`BuiltInKeywords` 不存在，建议 `BuiltInKeyword`

**新会话必做**：用干净工具确定真实导出名。可靠方法：
```bash
# 找到真实包路径
find /Volumes/金阳/jarvis/node_modules -name porcupine.tsx -path "*porcupine-react-native*"
# 直接看 enum 定义（用 cat，别信 grep 乱码）
cat <上面路径> | grep -i builtin
```
独立证据倾向 **`BuiltInKeywords`（复数）**：① 第一次编译器建议它 ② 早期真实 grep 看到工厂方法参数类型是 `keywords: BuiltInKeywords[]`。但务必亲自核实。内置词成员是 `JARVIS`（值 `'jarvis'`，早期真实 GitHub API 列出 android 内置 .ppn 含 jarvis，可信）。

API 真实签名（早期可靠确认）：
```ts
PorcupineManager.fromBuiltInKeywords(
  accessKey: string,
  keywords: BuiltInKeywords[],   // 或 BuiltInKeyword[]，待定
  detectionCallback: (keywordIndex: number) => void,
  processErrorCallback?: (e) => void,
  modelPath?: string,
)
// 实例: manager.start() / manager.stop() / manager.delete()
```

### 2.6 已装依赖
`packages/app/package.json` 有 `"@picovoice/porcupine-react-native": "^4.0.0"`（真实装了，pnpm 路径带 voice-processor@1.2.3 依赖 hash）。voice-processor 1.2.3 和我们 D1 已装的一致，兼容。

---

## 3. D3 未完成 — 新会话要做的（精确步骤）

### 步骤 1：修 wakeword.ts 的 import 名（见 2.5），typecheck 到 0 错误
```bash
cd /Volumes/金阳/jarvis && pnpm --filter @jarvis/app typecheck   # 必须 0 error
```

### 步骤 2：App.tsx UI 接线（最后的核心工作，**未做**）
文件 `packages/app/App.tsx`（Read 在本会话返回乱码，新会话先确认能干净读取）。需要加：

1. **import**（文件顶部，约 25 行后）：
```ts
import { loadWakeKey, saveWakeKey, /*既有*/ clearState, loadState, saveState } from "./src/store";
import { initWake, startListening, pauseListening, destroyWake, isWakeReady } from "./src/wakeword";
```
2. **state**（Main 组件内，约 58 行附近，busy 那批后面）：
```ts
const [wakeKey, setWakeKey] = useState<string | null>(null);
const [wakeOn, setWakeOn] = useState(false);
const wakeOnRef = useRef(false); wakeOnRef.current = wakeOn;
```
3. **boot useEffect**（约 71 行，`setState(await loadState())` 旁边）加：
```ts
setWakeKey(await loadWakeKey());
```
4. **connect callbacks**（约 82 行 `new JarvisClient(state, {...})`）加：
```ts
onConfig: (cfg) => {
  if (cfg.porcupineAccessKey) { void saveWakeKey(cfg.porcupineAccessKey); setWakeKey(cfg.porcupineAccessKey); }
},
```
5. **唤醒回调 + 开关函数**（组件内，参考已有的 autoListen/beginRecording。⚠️ 本会话没能确认 autoListen/beginRecording 的真实存在与签名——D2 应该加了连续对话，但 Python 探针没找到 `autoListen`/`convModeRef`，存疑，新会话先 grep 确认 App.tsx 里录音相关函数的真实名字）：
```ts
const handleWake = useCallback(() => {
  // 唤醒命中：播个提示音(可选) + 开始录一段语音指令（复用现有录音流程）
  // 录音结束后必须 startListening() 恢复唤醒监听（在录音结束回调里判断 wakeOnRef.current）
}, []);
const toggleWake = useCallback(async () => {
  if (wakeOn) { await destroyWake(); setWakeOn(false); return; }
  if (!wakeKey) { /* 提示：还没收到 daemon 下发的 key */ return; }
  const ok = await initWake(wakeKey, handleWake);
  if (ok) { await startListening(); setWakeOn(true); }
}, [wakeOn, wakeKey, handleWake]);
```
6. **录音结束恢复监听**：找到现有录音结束的地方（finishRecording / onAutoEnd），录完后 `if (wakeOnRef.current) void startListening();`
7. **UI 开关**：header 里加个"唤醒"按钮（参考已有的"对话"开关），`onPress={toggleWake}`，wakeOn 时高亮；wakeKey 为 null 时禁用/提示。
8. 每步 `pnpm --filter @jarvis/app typecheck` 验证。

### 步骤 3：AccessKey 配置（需要用户）
用户要去 https://console.picovoice.ai/ 注册免费账号拿 AccessKey。拿到后：
```bash
echo 'JARVIS_PORCUPINE_KEY=<用户的key>' >> ~/.jarvis/env && chmod 600 ~/.jarvis/env
# 重启 daemon 使其加载
```
内置词"Jarvis"是**英文发音**。中文"贾维斯"需在 Picovoice Console 训练自定义 .ppn（用 `fromKeywordPaths` 而非 `fromBuiltInKeywords`），第一版先用英文 Jarvis。

### 步骤 4：构建 APK
```bash
bash scripts/build-apk.sh   # 注意会重新 expo prebuild（porcupine 是新原生模块，必须重新生成 android 工程）
# 输出 dist-apk/jarvis-<时间>.apk，约 8 分钟（新模块可能更久）
```

### 步骤 5：模拟器验证（注意物理限制）
```bash
export PATH=/opt/homebrew/share/android-commandlinetools/platform-tools:/opt/homebrew/share/android-commandlinetools/emulator:$PATH
emulator -avd jarvis-test -no-snapshot -no-audio ... &   # AVD 名 jarvis-test 已存在
adb install -r dist-apk/<最新>.apk
adb shell am start -n com.poincare.jarvis/.MainActivity
adb exec-out screencap -p > /tmp/s.png   # 用 Read 看截图
```
**模拟器能测**：装机/启动/不崩溃、麦克风权限弹窗、唤醒开关 UI、收到 daemon 下发 key 后 initWake 不报错、Porcupine 服务能 start。
**模拟器测不了**：真实喊"Jarvis"触发——我无法对模拟器说话。**这一步必须用户真机测**。对用户要诚实说明这个物理限制（上一会话已对用户讲过，他知道）。

---

## 4. ⚠️ 关键警告与环境备忘

- **工具可靠性**：上一会话后期 Bash/grep/Read/Python stdout 反复乱码、重复、幻觉，甚至编译器报错自相矛盾。**新会话先做可靠性自检**：跑几个已知结果的简单命令（如 `git log --oneline -1` 应为 6f54552），确认工具恢复正常再动手精细编辑。若仍不稳定，停止并告知用户。
- **绝不幻觉式声称完成**：上一会话犯过一次——曾声称 stop 修复"已验证、已提交、APK 已构建"，但 git 历史证明那个 commit 不存在（是假输出）。用户的全局铁律最高优先级是诚信。任何"完成/测试通过"必须有真实工具结果支撑，且要复核。
- **仓库在 exFAT 卷** `/Volumes/金阳/jarvis`：会产生 `._*` AppleDouble 垃圾（已在 .gitignore）；APK 构建必须走 `scripts/build-apk.sh` 的 APFS 沙箱（脚本已处理）。
- **daemon 当前连的中继**：本会话调试时临时切到了本地 `ws://127.0.0.1:8787`。给用户真机用前要切回深圳 `ws://39.108.123.54:18790`（改 `~/.jarvis/env` 的 `JARVIS_RELAY_URL` 重启 daemon），并重新出配对码让用户扫。
- **deploy 现状**：深圳 relay（systemd `jarvis-relay`，端口 18790）+ 美国 relay（docker compose，wss://relay.xujinyangai.com）都在线。
- **GLM key**：`~/.jarvis/env` 的 `JARVIS_ZHIPU_KEY=b0ad824b6ff747198082ce9f60e4f3c2.qyu6xzVI81jAAD8G`，coding plan 端点覆盖 chat（brain 用）但不覆盖音频（ASR/TTS 走本地）。

---

## 5. 关键命令速查

```bash
cd /Volumes/金阳/jarvis
pnpm --filter @jarvis/protocol build       # 改协议后必跑
pnpm --filter @jarvis/{daemon,app} typecheck
# 本地全链路测试（不用真手机）：见 README.md「开发与构建」
bash scripts/build-apk.sh                  # 构建 APK
pnpm --filter @jarvis/daemon pair          # 出配对二维码
```

记忆文件：`~/.claude/projects/-Volumes----jarvis/memory/jarvis-project-architecture.md`（含全部历史决策与踩坑）。
完整文档：`README.md`。
