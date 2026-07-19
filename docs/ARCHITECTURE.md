# Jarvis 系统架构深度分析

> 分析日期：2026-07-18  
> 分析范围：桌面端（jarvis-control）、手机端（packages/app）、守护进程（packages/daemon）、中继（packages/relay）、协议层（packages/protocol）

---

## 1. 项目总览

Jarvis 是一个"用手机语音远程控制 Mac 上 AI Agent"的系统，包含：

| 组件 | 本地路径 | 技术栈 | 职责 |
|---|---|---|---|
| **桌面控制端** | `~/jarvis-control-src` | Tauri 2 + React 19 + TypeScript + Rust | daemon 控制台：启停、配对、设备管理、任务流查看 |
| **手机 App** | `/Volumes/金阳/jarvis/packages/app` | React Native / Expo | 语音遥控器：唤醒、录音、审批、聊天 |
| **守护进程** | `/Volumes/金阳/jarvis/packages/daemon` | Node.js / TypeScript | 运行在 Mac 上，处理语音、路由意图、执行 Claude Code/Codex |
| **中继服务器** | `/Volumes/金阳/jarvis/packages/relay` | Node.js + WebSocket + SQLite | 零知识转发加密信封 |
| **协议层** | `/Volumes/金阳/jarvis/packages/protocol` | TypeScript + libsodium | E2E 加密、信封格式、可靠传输 |
| **ASR 边车** | `/Volumes/金阳/jarvis/packages/voiced` | Python (faster-whisper) | 本地语音识别服务 |

---

## 2. 系统架构与数据流

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────────┐
│   手机 App      │◄────►│   Relay 中继    │◄────►│   Daemon (Mac)          │
│  React Native   │  WS  │  ws://...:8787  │  WS  │  ~/.jarvis-build/...    │
└─────────────────┘      └─────────────────┘      └───────────┬─────────────┘
                                                               │
                                                    ┌──────────┴──────────┐
                                                    ▼                     ▼
                                           ┌─────────────┐        ┌──────────────┐
                                           │ ASR sidecar │        │ Claude Code  │
                                           │  :8898      │        │ / Codex      │
                                           └─────────────┘        └──────────────┘
                                                               │
                                                    ┌──────────┴──────────┐
                                                    ▼                     ▼
                                           ┌─────────────┐        ┌──────────────┐
                                           │ Qwen TTS    │        │  bigmodel    │
                                           │  :8888      │        │  Anthropic   │
                                           └─────────────┘        │  facade      │
                                                                  └──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         桌面端 Jarvis Control (Tauri)                        │
│     管理 daemon 生命周期 / 生成配对二维码 / 查看任务流 / 管理字典和记忆        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**一句话总结**：手机通过加密中继向 Mac 发语音/命令；Mac 上的 daemon 识别语音、路由意图、调用 Claude Code/Codex 在沙箱目录执行；结果通过 TTS 读回手机。桌面端是 daemon 的本地控制面板。

---

## 3. 桌面端深度分析（jarvis-control-src）

### 3.1 技术栈
- **前端**：React 19 + Vite 7 + TypeScript 5.8 + Tailwind CSS v4 + framer-motion
- **后端**：Tauri 2（Rust）
- **状态**：纯 React `useState` + 自定义 hooks
- **通信**：Tauri `invoke` API（前端 ↔ Rust）

### 3.2 前端结构

`src/App.tsx` 是单页应用，左侧 Sidebar 切换 9 个视图：

| 视图 | 文件 | 功能 |
|---|---|---|
| 控制台 | `DashboardView.tsx` | daemon 启停大按钮、状态呼吸环、日志 tail |
| 会话 | `AgentView.tsx` | 多 agent 会话列表、创建 agent、发送消息、查看历史 |
| 任务流 | `TaskStreamView.tsx` | 实时任务事件时间线 |
| 配对 | `PairView.tsx` | 生成/刷新配对二维码、管理已配对设备 |
| 工作空间 | `WorkspaceView.tsx` | 配置 workspace 的 mode/engine/tmux target |
| 字典 | `DictView.tsx` | Brain router 的识别字典 |
| 记忆 | `MemoryView.tsx` | Jarvis 长期记忆键值对 |
| 我的画像 | `ProfileView.tsx` | 任务历史画像 |
| 设置 | `SettingsView.tsx` | 自动启动、关闭到托盘、主题 |

### 3.3 核心 hooks

- `useDaemonStatus`：每 2 秒轮询 daemon `/status`，每 1.5 秒 tail 日志
- `usePairToken`：每 5 分钟刷新一次配对 token，10 秒前自动续期
- `useDict` / `useMemory`：读写 `~/.jarvis/dict.json` 和 `~/.jarvis/memory.json`

### 3.4 Rust 后端（src-tauri/src）

| 模块 | 职责 |
|---|---|
| `daemon.rs` | daemon 生命周期：检测 `http://127.0.0.1:8788/status`、用 `nohup tsx src/index.ts` 启动、用 `pkill -9 -f .../src/index` 停止 |
| `pair.rs` | 调用 daemon admin `/pair` 获取配对信息；调用 `/status` 获取状态 |
| `launchd.rs` | 注册/卸载 macOS LaunchAgent (`com.poincare.jarvis-daemon`)，实现开机自启 |
| `jarvis_fs.rs` | 读写 `~/.jarvis/*.json`：dict、memory、daemon state、control config |
| `workspace_config.rs` | 读写 workspace 配置（spawn/tmux 模式、claude/codex 引擎） |
| `scanner.rs` | 扫描 `~/.claude/projects` 生成用户画像 |
| `tasks.rs` / `db.rs` | 读写 `~/.jarvis/tasks.sqlite`，管理任务事件流 |
| `agents_reader.rs` | 读取 `~/.jarvis/agents.sqlite`，并可通过 HTTP 向 daemon 创建/停止/删除 agent |
| `commands.rs` | 所有 Tauri IPC 命令入口，共 30+ 个命令 |

### 3.5 桌面端关键发现

1. **桌面端不直接参与手机通信**——它只管理 daemon；真正的手机↔Mac 链路走 relay + daemon。
2. **daemon 启动做了大量 PATH 处理**：Tauri GUI 从 launchd 继承的 PATH 很小，代码里硬编码了 `/opt/homebrew/bin`、`/usr/local/bin` 和 daemon 本地 `node_modules/.bin`。
3. **配对二维码由 daemon 生成**：桌面端只是代理调用 `http://127.0.0.1:8788/pair`。
4. **任务流数据来自 SQLite**：Rust 后端直连 `~/.jarvis/tasks.sqlite` 读取事件，前端用后端推送（`tasks://new-events`）而非轮询。
5. **Agent 写操作走 HTTP**：创建、发消息、停止、删除 agent 通过 `agents_reader.rs` 调用 daemon 的 HTTP admin 端点。

---

## 4. 手机端深度分析（/Volumes/金阳/jarvis）

### 4.1 技术栈
- **框架**：React Native + Expo（custom dev client / prebuild）
- **状态**：Zustand（`session-store`、`workspace-store`、`input-store`、`ui-store`、`settings-store`）
- **持久化**：`expo-secure-store`（phone 密钥状态）、`AsyncStorage`（设置、workspace、最后会话）
- **权限**：相机（QR 扫描）、录音（语音输入）
- **原生模块**：
  - `@picovoice/react-native-voice-processor`：录音
  - `expo-audio`：TTS 播放
  - 自定义 `SherpaWake` 模块（Kotlin）：离线唤醒词

### 4.2 App 入口与启动流程

`packages/app/App.tsx`：

1. `ensureCrypto()`：初始化 libsodium
2. `ensureCorePermissions()`：Android 请求 CAMERA + RECORD_AUDIO
3. 从 SecureStore 加载 `PhoneState`、设置、workspace
4. `restoreLastAgent()`：恢复最后会话
5. 若未配对 → `LoginScreen`；否则 → `MainScreen`

### 4.3 登录/配对流程

`login-screen.tsx`：

1. 用户扫描二维码或粘贴 JSON
2. JSON 包含：`relayUrl`、`room`、`daemonDeviceId`、`daemonBoxPub`、`token`
3. 调用 `pairWithDaemon(info, "android-phone")`
4. 手机生成自己的 box/sign 密钥对
5. 用 daemon 的 box 公钥做 `crypto_box_seal` 加密配对请求
6. 通过 relay 发送 `kind: "pair"` 信封
7. daemon 验证 token 后，将手机加入 `state.devices`
8. 手机保存 `PhoneState` 到 SecureStore

### 4.4 主界面与业务 hook

`main-screen.tsx` 挂载 `useJarvis(state)`，这是手机端的核心业务钩子：

- 创建 `JarvisClient`，管理 WebSocket 连接
- 处理回调：`onTaskEvent`、`onPermRequest`、`onAsrFinal`、`onTtsReady`
- 语音录音：按压/点击/自动三种模式
- 审批响应：通过 UI store 注册全局回调
- 自动拉取历史：切换 agent 时发送 `/history <agentId>`

### 4.5 核心客户端（client.ts）

`JarvisClient`：

- 用 `RelayClient` 连接 relay
- 连接成功后发送 `hello`，带 `resumeFrom` 实现断线续传
- 命令通过 `cmd.submit` 发送，`cmdId` 格式为 `sessionId::randomSuffix`
- 语音通过 `voice.start` / `voice.chunk` / `voice.end` 发送，`kind:"voice"`，不走可靠通道
- 审批响应通过 `perm.response` 发送

### 4.6 语音处理

`voice.ts`：

- 录音：16kHz mono int16，每 10 帧（~320ms）一个 chunk base64
- 简单 VAD：RMS 能量门限，1.4 秒静音自动结束，最长 15 秒
- 播放：合并 TTS chunk → 写入 cache → `expo-audio` 播放

`wakeword.ts`：

- 使用自定义 `SherpaWake` 原生模块
- 离线唤醒词模型放在 `packages/app/modules/sherpa-wake/android/src/main/assets/`
- 唤醒后触发 `autoListen()` 进入语音输入

---

## 5. 守护进程深度分析（packages/daemon）

### 5.1 入口与初始化

`packages/daemon/src/index.ts`：

1. 加载 `~/.jarvis/env`
2. 读取/生成 daemon 身份（box/sign 密钥对、roomSecret）
3. 初始化 `TaskStore`（`~/.jarvis/tasks.sqlite`）
4. 初始化 `agents.sqlite` 消息表
5. 启动 ASR sidecar
6. 连接 relay
7. 启动 admin HTTP server（`127.0.0.1:8788`）

### 5.2 核心状态

```typescript
interface DaemonState {
  deviceId: string;
  boxPub: string; boxPriv: string;   // X25519 加密密钥
  signPub: string; signPriv: string; // Ed25519 签名密钥（relay 认证）
  roomSecret: string;
  relayUrl: string;
  workdir: string;
  devices: PairedDevice[];
  pairToken: { token: string; expiresAt: number } | null;
  channelSeqs?: Record<string, number>;
}
```

### 5.3 消息路由（handlePayload）

| Payload 类型 | 处理 |
|---|---|
| `voice.start/chunk/end` | 收集音频，结束后转文字 |
| `hello` | 断线续传：重放 outbox 中未确认的消息 |
| `ack` | 确认收到，清理 outbox |
| `cmd.submit` | 入队执行；`/xxx` 走本地 slash 处理 |
| `task.stop` | 停止任务或清空队列 |
| `perm.response` | 审批门 settle |
| `task.list` | 返回任务摘要 |

### 5.4 语音处理链路

1. 收集 `voice.chunk` → PCM16
2. `pcm16ToWav` → WAV
3. `transcribeAny`：
   - 优先本地 `http://127.0.0.1:8898/asr`（faster-whisper）
   - 失败 fallback 到 GLM-ASR
4. 发送 `asr.final` 给手机显示
5. `route(text, history)`：GLM-5.1 意图路由
6. 根据决策：
   - `answer/clarify`：直接回复 + TTS
   - `task`：确认语 + 入队执行
   - `workspace`：切换工作空间

### 5.5 意图路由（brain/router.ts）

- 调用 GLM-5.1（coding-plan endpoint，关闭 thinking）
- 单次调用同时完成：清洗 ASR 错字、决定 action、生成口语回复
- 输出 JSON schema：`{ action, reply, task, workspace }`
- 失败 fallback：把原文当 task 直接执行

### 5.6 任务执行（runOneCmd）

1. 判断是否为简单命令（`git status`、`ls` 等），跳过 brain
2. 否则走 brain router
3. `classifyCommand(finalText, wd)`：Tier 分级
4. **审批门**：
   - brain 路由过的任务 → Tier 2 审批
   - Tier 3 危险命令 → Tier 3 审批
   - 简单 Tier 1/2 直接执行
5. `runClaudeCode(...)`：spawn Claude Code headless
6. 解析 NDJSON stream，转成 `task.event`
7. 完成后根据 `voiceReply` 选项用 TTS 播报结果

### 5.7 Claude Code 执行器

`executors/claude-code.ts`：

- 找 Claude Code 入口：优先 `~/.claude-cli-local/.../cli.js` 用 `node` 运行（规避 Sequoia SIGKILL）
- fallback 到 `claude` 二进制
- 参数：`-p <prompt> --output-format stream-json --verbose --dangerously-skip-permissions`
- 支持 `--resume <sessionId>`
- 环境变量注入 `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL`（默认 `https://open.bigmodel.cn/api/anthropic`）
- 通过 `JSONL` 流解析事件

### 5.8 审批门（approval.ts + classifyCommand）

`ApprovalBroker`：

```typescript
class ApprovalBroker {
  wait(reqId, timeoutSec): Promise<boolean>  // 超时默认拒绝
  settle(reqId, allowed): boolean
}
```

危险命令分类器 `classifyCommand` 识别：
- Tier 3（需审批）：`rm -rf`、`sudo`、出沙箱路径、发送到微信等
- Tier 2（通知）：较危险但仍可自动执行
- Tier 1（直接执行）：安全只读操作

### 5.9 TTS 链路（voice/local.ts）

分层 fallback（冗余安全原则）：

1. Qwen3-TTS 本地服务 `http://127.0.0.1:8888/say`
2. macOS `say -v Tingting` + `afconvert` 转 WAV
3. GLM-TTS 云端

### 5.10 ASR 链路（voice/local.ts + voiced/asr_server.py）

1. 优先本地 faster-whisper sidecar（端口 8898）
2. 失败 fallback GLM-ASR

---

## 6. 中继服务器深度分析（packages/relay）

`packages/relay/src/server.ts`：

- 零知识转发：只看见 `room`、`from`、`to`、`kind`、加密 blob
- 认证流程：
  1. 服务器发送 challenge（随机 nonce）
  2. 客户端用 Ed25519 私钥签名
  3. 服务器用 `signPub` 验证，绑定 `deviceId`
- 路由：同一 room 内按 `to` 或广播（`to: "*"`）
- 离线队列：`msg` / `pair` 类型入 SQLite 队列，72h TTL，每 room 5MB 上限；`voice` 直接丢弃
- 在线状态广播：`presence` frame

---

## 7. 协议与加密深度分析（packages/protocol）

### 7.1 密钥体系

- 每个设备一对 X25519 box 密钥（加密）+ 一对 Ed25519 sign 密钥（relay 认证）
- 配对时手机用 daemon 的 box 公钥做 `crypto_box_seal` 发送配对请求
- 配对成功后双方用 `crypto_box_easy` 进行端到端加密通信

### 7.2 信封格式

```typescript
interface Envelope {
  v: 1;
  id: string;
  room: string;
  from: string;
  to: string;
  kind: "msg" | "voice" | "presence" | "pair";
  nonce: string;  // base64
  box: string;    // base64 加密 payload
}
```

### 7.3 可靠传输

- 每个设备对有独立的 `Outbox` / `Inbox`
- 每条 `msg` 带单调递增 `seq`
- 接收方回复 `ack` 确认
- 断线重连后发送 `hello` 带 `resumeFrom`，对端重放未确认消息
- `voice` 系列 bypass 可靠通道，fire-and-forget

### 7.4 Payload 类型

`hello`、`cmd.submit`、`task.event`、`perm.request`、`perm.response`、`task.list`、`task.stop`、`task.state`、`ack`、`pair.accept`、`voice.start/chunk/end`、`asr.final`、`tts.start/chunk/end`

---

## 8. 关键发现与潜在风险

### 8.1 架构优势

1. **真正的 E2E 加密**：relay 无法解密，符合"零知识"宣传
2. **本地优先**：ASR、TTS 优先本地，fallback 云端，响应快且隐私好
3. **断线续传可靠**：seq/ack/outbox 设计成熟
4. **审批门合理**：危险操作必须手机确认
5. **多层冗余**：TTS/ASR 都有 fallback，符合冗余安全原则
6. **桌面端与手机端解耦**：桌面端只是 daemon 管理器，手机可独立使用

### 8.2 潜在风险与问题

| 风险 | 位置 | 说明 |
|---|---|---|
| **硬编码绝对路径** | `daemon.rs`, `launchd.rs`, `voice/local.ts`, `brain/router.ts` | 大量依赖 `/Volumes/金阳/...`、`/opt/homebrew/bin`、`~/.jarvis-build`、`~/.claude-cli-local`，换机器或磁盘挂载变化会崩 |
| **Sequoia SIGKILL 规避 hack** | `executors/claude-code.ts` | 用 `node cli.js` 绕过 macOS 对 unsigned `claude.exe` 的 SIGKILL，依赖特定 npm 安装路径 |
| **Claude Code 凭证注入** | `executors/claude-code.ts` | 用 `ZHIPU_API_KEY` 充当 `ANTHROPIC_API_KEY`，通过 bigmodel facade 访问 GLM，存在配置混淆风险 |
| **审批超时默认拒绝** | `approval.ts` | 合理，但用户可能因未及时看手机导致任务失败 |
| **任务序列化执行** | `index.ts` `drainQueue` | 一次只执行一个任务，长任务会阻塞后续命令 |
| **手机端 task.state 处理被注释** | `use-jarvis.ts` | 因 daemon 的 `TaskSummary.title` 是命令前缀而非 agent id，导致 sidebar 被污染，当前已 NO-OP，任务列表未正确映射到 agent |
| **slash 命令本地 stub** | `index.ts` `handleSlash` | `/rename`、`/delete`、`/workspace.create` 等只是记录日志或返回占位消息，daemon 没有真正的工作空间注册表 |
| **VAD 简陋** | `voice.ts` | 纯 RMS 能量门限，嘈杂环境会误触发或漏触发 |
| **桌面端 task_kill 可能误杀** | `tasks.rs` | 用 `pkill` / `pgrep` 匹配工作目录和 session id，精确度依赖字符串匹配 |
| **relay 默认 ws 明文** | `relay/src/server.ts` | 生产需 TLS terminator，本地 dev 用明文 |

### 8.3 代码质量观察

- **注释非常充分**：大量 inline 注释解释"为什么这样写"，对维护友好
- **Phase 标记**：代码里有 "Phase 14"、"Phase 15-v11" 等迭代标记，说明项目处于快速迭代中
- **fallback 文化**：到处可见 try/catch + fallback，符合项目"冗余安全"原则
- **类型安全较好**：大量使用 zod 校验协议 payload

---

## 9. 优化建议

### 9.1 高优先级

1. **消除硬编码路径**
   - 把 `/Volumes/金阳/hey_jarvis/config.py`、`.jarvis-build`、`.claude-cli-local` 等路径改为配置项或搜索策略
   - 这在换 Mac 或重新安装时会是最大绊脚石

2. **完成工作空间/Agent 协议**
   - 当前 `/workspace.create`、`/rename`、`/delete` 是 stub
   - 建议新增正式 payload 类型：`workspace.create/rename/delete`、`agent.rename/delete`
   - 让 daemon 成为 workspace 的 source of truth，手机端只做展示

3. **修复 task.state → agent 映射**
   - daemon 的 `TaskSummary` 应带 `sessionId` / `agentId` 字段
   - 手机端恢复 `onTaskState` 处理，正确更新 sidebar

### 9.2 中优先级

4. **并行任务执行**
   - 当前是单队列串行，不同 session 的任务可以并行
   - 按 `sessionId` 分队列，避免一个长任务阻塞其他会话

5. **改进 VAD**
   - 用 Sherpa-VAD 或更鲁棒的 VAD 替代 RMS 能量门限
   - 项目里已经有 `modules/sherpa-vad`，但未在 `voice.ts` 中使用

6. **统一配置源**
   - 当前配置分散在：`~/.jarvis/env`、`~/.jarvis/control-config.json`、daemon 环境变量、硬编码 fallback
   - 建议统一到一个 schema 化的配置文件

### 9.3 低优先级 / 工程债

7. **减少 `seq: 0` 的 voice 与可靠通道混用**
   - `voice` 系列 bypass 可靠通道是对的，但要确保 `voice.end` 后的 `asr.final`/`tts.*` 不依赖 voice seq

8. **Claude Code 执行器抽象**
   - 当前 codex 支持只有 workspace config 层面，实际执行器只有 claude-code.ts
   - 若未来要支持 codex，需抽象 `Executor` 接口

9. **桌面端任务流优化**
   - 当前任务流靠后端 2 秒轮询 `MAX(events.id)` 推送
   - 若任务事件非常频繁，可考虑 SQLite WAL + 触发器通知

---

## 10. 总结

Jarvis 是一个架构清晰、安全设计到位的"语音远程控制 AI Agent"系统。核心亮点是 **端到端加密 + 本地优先语音 + 手机审批门**。目前代码处于快速迭代期（Phase 14/15），手机端和 daemon 的协议逐渐成型，但**工作空间/Agent 管理仍是 stub，硬编码路径较多**，这是接下来最需要补齐的地方。

桌面端作为 daemon 的本地控制面板，职责单一但完整；手机端作为"瘦客户端"语音入口，状态管理和 UI 已经比较成熟。整体而言，这是一个有产品化潜力的个人自动化系统。
