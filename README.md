# Jarvis

用手机控制全部电脑 agent 的个人系统。**手机是遥控器，VPS 是哑管道，Mac 是身体也是大脑。**

```
jarvis-app (Android) ◄─WSS(E2E加密blob)─► jarvis-relay (VPS,零知识) ◄─WSS─► jarvis-daemon (Mac)
                                                                            ├─ brain (意图路由, v1)
                                                                            └─ executors: Claude Code / Codex / shell / browser
```

- 端到端加密（libsodium crypto_box），relay 只见密文，密钥不出设备
- 审批分级：Tier 1 自动 / Tier 2 通知 / Tier 3 手机确认（超时默认拒绝），**确定性代码守门，不交 LLM 判断**
- 断线续传：seq + resume + relay 离线队列（TTL 72h）
- 完整计划: `~/.claude/plans/hi-i-used-to-reflective-ocean.md`

## 包结构

| 包 | 作用 |
|---|---|
| `packages/protocol` | 三端共享：zod schema、信封编解码、libsodium 封装、Outbox/Inbox 续传 |
| `packages/relay` | 零知识转发器（~250 行）：challenge-sign 鉴权、room 路由、SQLite 离线队列 |
| `packages/daemon` | Mac 守护进程：配对、加密通道、Claude Code headless 执行器、任务库、审批门 |
| `packages/phone-sim` | 手机模拟器（协议层与未来 APK 完全一致），用于测试 |

## 快速开始（本机全链路）

```bash
pnpm install && pnpm build

# 1. 起 relay（生产环境部署到 VPS，放在 caddy/nginx 443 后面）
PORT=8787 pnpm --filter @jarvis/relay start

# 2. 起 daemon
JARVIS_RELAY_URL=ws://127.0.0.1:8787 pnpm --filter @jarvis/daemon start

# 3. 配对（生成一次性 token + 二维码，5 分钟有效）
pnpm --filter @jarvis/daemon pair
# 模拟手机端: cd packages/phone-sim && npx tsx src/index.ts pair '<上面输出的json>'

# 4. 发指令
cd packages/phone-sim
npx tsx src/index.ts cmd "创建一个 hello.py 并运行它"
npx tsx src/index.ts cmd-approve "需要 Tier3 审批的指令（自动批准，测试用）"
npx tsx src/index.ts tasks   # 任务列表 + 补收离线事件
```

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `JARVIS_RELAY_URL` | `ws://127.0.0.1:8787` | relay 地址（生产: `wss://your.domain`） |
| `JARVIS_WORKDIR` | `~/JarvisRemoteControl` | 远程任务沙箱目录 |
| `JARVIS_CLAUDE_BIN` | 自动探测 | claude 二进制路径 |
| `JARVIS_ADMIN_PORT` | `8788` | daemon 本地管理端口（仅 127.0.0.1） |
| `PORT` / `DB_PATH` | `8787` / `relay.sqlite` | relay 监听端口 / 离线队列库 |

状态文件: `~/.jarvis/daemon.json`（密钥+设备, 0600）、`~/.jarvis/tasks.sqlite`（任务+事件）。

## 已验证（2026-06-11 E2E 实测）

- ✅ 配对: sealed box + 一次性 token
- ✅ 手机指令 → relay → daemon → Claude Code 执行 → 流式输出回手机
- ✅ Tier-3 审批: 拒绝→任务暂停；批准→执行
- ✅ 零知识: relay SQLite 中仅有密文 blob
- ✅ 离线队列: 手机断线期间事件排队，重连补收
- ✅ 任务持久化: daemon 重启后任务历史可查，孤儿任务标记 paused

## 路线图

- **v1**: 语音双向管线（手机 PCM → whisper.cpp → Typeless 式 LLM 清洗；Qwen3-TTS 回程）、brain 意图路由（spawn_agent/browser/shell/immortal-agent）、Expo APK（扫码配对 + Kotlin 前台服务保活 + notifee）、LAN 直连、ntfy 推送兜底
- **v2**: 唤醒词、多设备、定时任务、immortal-agent 进度树、截屏回传
