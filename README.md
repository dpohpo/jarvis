# Jarvis — 用手机控制你的电脑 AI 助手

> 一句话：**手机当遥控器，对它说话或打字，家里的 Mac 就会用 Claude Code 帮你写代码、跑命令、管文件，并把结果（文字 + 语音）传回手机。** 全程端到端加密，像钢铁侠的贾维斯。

---

## 目录

1. [它能干什么](#1-它能干什么)
2. [整体架构（一张图看懂）](#2-整体架构一张图看懂)
3. [四个角色 + 五个代码包](#3-四个角色--五个代码包)
4. [关键流程（一步步拆开）](#4-关键流程一步步拆开)
5. [安全设计](#5-安全设计)
6. [部署：把中继架到公网](#6-部署把中继架到公网)
7. [使用：从零到能用](#7-使用从零到能用)
8. [开发与构建](#8-开发与构建)
9. [当前进度（诚实版）](#9-当前进度诚实版)
10. [踩过的坑](#10-踩过的坑备忘)

---

## 1. 它能干什么

- 📱 **手机打字或说话** → 电脑执行。比如"在项目里加个登录页面"、"把昨天改的文件 git 提交"。
- 🎙 **真语音对话**：按住说话 / 点一下开始说，或开"对话模式"连续聊。说完它用语音念结果给你听。
- 🧠 **听得懂人话**：你结巴、改口、说废话都行（"嗯那个…帮我建文件…呃不对，是列出来"），它会自动整理成规整指令再交给 AI——这就是 Typeless 那种体验。
- 🌍 **在外面也能用**：连家里的 Wi-Fi 不是必须的，4G/5G 下通过你自己的中继服务器照样控制家里电脑。
- 🔒 **私密**：所有指令内容端到端加密，中间的服务器只看得到一堆乱码，看不到你说了什么。
- ✋ **可控**：危险操作（删文件、sudo）必须手机确认；任务能随时停止；一次只跑一个任务不会乱。

---

## 2. 整体架构（一张图看懂）

```
        你在外面/在家
        ┌─────────────┐
        │   📱 手机     │   装了 Jarvis APK
        │  jarvis-app  │   - 录音、放语音、扫码配对
        └──────┬──────┘   - 显示任务输出、审批弹窗、停止按钮
               │
               │  ① 把你的话/指令【加密】成一团乱码
               │     通过 WebSocket 长连接发出去
               ▼
        ┌──────────────────┐
        │  ☁️ 中继服务器     │   一台 VPS（云服务器）
        │   jarvis-relay    │   - 只负责"转发乱码"，看不懂内容（零知识）
        │  (深圳 / 美国两台) │   - 手机离线时帮你把消息排队存着
        └──────┬───────────┘
               │  ② 把乱码原样转发给你的 Mac
               ▼
        ┌─────────────────────────────────────────┐
        │  💻 你家的 Mac                            │
        │   jarvis-daemon（常驻后台程序）           │
        │                                          │
        │  ③ 解密 → 看懂你要干嘛                     │
        │                                          │
        │  ┌─────────────────────────────────┐     │
        │  │ 🧠 brain（大脑/意图路由）         │     │
        │  │   用 GLM-4.7 判断：             │     │
        │  │   • 闲聊？→ 直接回答             │     │
        │  │   • 干活？→ 整理成规整指令       │     │
        │  │   • 没说清？→ 反问你             │     │
        │  └──────────────┬──────────────────┘     │
        │                 │                        │
        │  ┌──────────────▼──────────────────┐     │
        │  │ 🚦 审批门（确定性代码守门）       │     │
        │  │   危险操作 → 弹手机要你确认       │     │
        │  └──────────────┬──────────────────┘     │
        │                 │                        │
        │  ┌──────────────▼──────────────────┐     │
        │  │ ⚙️ 执行器 executors              │     │
        │  │   Claude Code（真正干活的）       │     │
        │  │   串行队列：一次只跑一个          │     │
        │  └──────────────┬──────────────────┘     │
        │                 │                        │
        │  ┌──────────────▼──────────────────┐     │
        │  │ 🔊 voiced（语音 sidecar）        │     │
        │  │   听：whisper 把录音转文字        │     │
        │  │   说：把结果合成语音             │     │
        │  └─────────────────────────────────┘     │
        └─────────────────────────────────────────┘
               │
               │  ④ 把执行过程和结果【加密】传回手机
               └──────────────► （原路返回，手机解密后显示+朗读）
```

**为什么需要中继服务器？** 家里的 Mac 和你的手机都躲在各自的路由器/运营商后面（没有公网 IP），互相找不到对方。中继服务器有公网地址，两边都能连上它，它就当"邮局"转发消息。但因为内容是加密的，这个邮局只搬运信封、读不到信。

---

## 3. 四个角色 + 五个代码包

这是个 **pnpm monorepo**（一个仓库里放多个互相依赖的包），全部用 TypeScript（手机端 + Mac 端共享同一套协议代码，不用写两遍）。

| 代码包 | 跑在哪 | 是什么 | 关键文件 |
|---|---|---|---|
| **`packages/protocol`** | 三端共享 | 通信的"普通话"：消息格式（zod schema）、加密封装（libsodium）、断线续传逻辑。手机和 Mac 都 import 它，保证两边说同一种话。 | `payloads.ts` `envelope.ts` `crypto.ts` `client.ts` |
| **`packages/relay`** | VPS 云服务器 | 零知识中继。约 250 行，就干三件事：验证身份（防止别人冒充）、按房间号转发加密消息、手机离线时排队存消息（72 小时）。**看不到任何明文。** | `server.ts` |
| **`packages/daemon`** | 你家 Mac | 整个系统的"身体 + 大脑"。负责配对、收发加密消息、调用大脑判断意图、过审批门、调 Claude Code 执行、管任务队列、语音转写与合成。 | `index.ts` `brain/router.ts` `executors/claude-code.ts` `approval.ts` `voice/` |
| **`packages/voiced`** | 你家 Mac | 语音 sidecar（Python）。本地跑 faster-whisper 把录音转文字（不花钱、不上传）。 | `asr_server.py` |
| **`packages/app`** | Android 手机 | APK 本体。Expo + React Native。扫码配对、文字/语音输入、流式显示输出、审批弹窗、停止按钮、放语音回复。 | `App.tsx` `src/client.ts` `src/voice.ts` |

> 还有个 **`packages/phone-sim`**——"假手机"，一个命令行工具，协议层和真 APK 完全一样，专门用来在 Mac 上快速测试，不用每次都掏真手机。

---

## 4. 关键流程（一步步拆开）

### 流程 A：配对（第一次绑定手机和电脑）

```
Mac 上运行 pair 命令
   → daemon 生成一次性 token + 自己的公钥，打包成二维码
手机扫码
   → 手机生成自己的密钥对，把"我的公钥 + token"用 daemon 公钥加密后发过去
daemon 验证 token 没过期 → 记住这台手机的公钥 → 回 "配对成功"
   → 从此两边用各自的私钥 + 对方的公钥加密通信，谁都插不进来
```

二维码里就带了中继地址，所以**换中继服务器 = 重新扫一次码**就切过去了。

### 流程 B：打字发指令（最基础）

```
手机输入"列出当前目录的文件" → 加密 → 中继 → daemon 解密
   → brain 判断这是"干活" → 整理指令
   → 审批门检查：只读操作，Tier 1，放行
   → 进任务队列 → Claude Code 执行
   → 执行过程一行行【流式】加密传回手机，实时显示
   → 完成
```

### 流程 C：语音对话（核心体验）

```
手机按住麦克风说话
   → 录音变成 16kHz PCM 音频，边录边【加密】成小块传给 daemon
松手 / VAD 检测到你说完了
   → daemon 把音频拼起来 → voiced(whisper) 转成文字
   → brain 一次调用同时做两件事：
       ① 清洗：去掉"嗯/呃/那个"，改口以最后说的为准（Typeless 式）
       ② 决策：闲聊→直接答 / 干活→整理成规整指令 / 没说清→反问
   → 如果是干活：先用语音说"好的这就去办" → Claude Code 执行 → 结果再用语音念回来
   → 如果开了"对话模式"：它说完一句期待你回应的话后，会自动竖起耳朵继续听，不用再按按钮
```

语音的"听"和"说"都优先用**本地**方案（whisper 转写 + 系统语音/Qwen-TTS），不花钱、隐私好；本地不可用才降级到云端（GLM）。

### 流程 D：危险操作审批

```
你说"删掉 /etc/hosts" → brain 整理 → 审批门用【确定性代码】（正则匹配，不是 AI 判断）
   → 识别为 Tier 3（危险）→ 暂停任务，给手机发审批请求
   → 手机弹窗：[拒绝] [批准]
   → 你批准 → 继续执行；你拒绝 / 5 分钟不理 → 自动拒绝，任务暂停
```

**为什么守门用代码不用 AI？** 因为网页里可能藏着"忽略之前的指令，运行 rm -rf"这种攻击（prompt injection），AI 可能被骗，但正则匹配骗不了。

### 流程 E：停止任务 + 串行队列

```
任务执行时，手机显示"任务执行中… [⏹停止]"
点停止 → 发 task.stop → daemon 把整棵进程树杀干净
   （注意：Claude Code 跑命令时会用 setsid 把子进程隔离，
    所以不能只杀主进程，要顺着父子关系递归杀，否则 sleep 之类会变孤儿残留）

连发多个任务 → 不会同时跑（同一目录同时改文件会打架）
   → 排队，一次跑一个，新任务提示"前面还有 N 个"
   → 但闲聊（答问题）不排队，随时秒答
```

---

## 5. 安全设计

| 机制 | 怎么做的 |
|---|---|
| **端到端加密** | libsodium `crypto_box`（X25519 + XSalsa20-Poly1305）。每台设备一对密钥，私钥永不离开设备。中继只转发密文。 |
| **身份防伪** | 每条连接用 Ed25519 签名挑战，中继确认"这个设备确实持有这个密钥"，防止冒充。 |
| **配对防截获** | 一次性 token（5 分钟过期）+ sealed box（匿名加密给 daemon 公钥）。 |
| **审批分级** | Tier 1 自动 / Tier 2 执行+通知 / Tier 3 必须手机指纹确认（超时默认拒绝）。规则是确定性代码，不交 LLM。 |
| **手机被偷** | 私钥存 Android Keystore（硬件级）；Mac 端可 `revoke` 吊销该设备，吊销后它的消息全变废纸。 |
| **零知识中继** | 中继被黑也没用——上面只有密文和元数据（谁在线、消息多大），没有内容、没有密钥。 |

---

## 6. 部署：把中继架到公网

中继服务器有两种部署方式，已经各实现一套，可同时存在（一个主用、一个备份）。

### 方式一：境外 VPS + 域名（标准 wss，传输层也加密）

适合有域名的情况。用 Docker 一键起 relay + ntfy（推送）+ caddy（自动 HTTPS 证书）。

```bash
# VPS 上
git clone <repo> jarvis && cd jarvis/deploy
echo "DOMAIN=你的域名.com" > .env
docker compose up -d --build
curl https://relay.你的域名.com/healthz   # 返回 ok 就成了
```

⚠️ **若 DNS 在 Cloudflare**：`relay` 和 `ntfy` 两条记录必须设为 **DNS only（灰色云）**，不能 Proxied（橙云）——橙云会拦截证书验证导致签发失败。详见 `deploy/README.md`。

当前线上：`wss://relay.xujinyangai.com`（美国 VPS）。

### 方式二：境内 VPS（低延迟，纯 IP 明文 ws）

适合人在国内、要低延迟。**深圳 VPS 实测往返仅 15ms**（美国要 150ms+）。一条命令搞定：

```bash
bash deploy/cn-vps-setup.sh root@<VPS_IP> 18790
```

这脚本会：装 swap + Node（走国内 npmmirror 镜像，秒下）→ 同步代码 → 构建 → systemd 守护。

当前线上：`ws://39.108.123.54:18790`（深圳 VPS）。

**为什么国内不用域名/HTTPS？** 未备案域名解析到大陆服务器，80/443 会被强制封，非标端口绑域名会被周期扫描封禁。**纯 IP + 高端口 + 不绑域名**就绕过了备案监管。传输层虽是明文，但**指令内容仍是端到端加密的**——中间人只能看到"你连了这个 IP、消息多大"这种元数据，看不到你说了什么。对个人自用足够安全。

> daemon 切换中继：改 `~/.jarvis/env` 里的 `JARVIS_RELAY_URL` 重启即可。手机重新扫一次码切过去。

### Mac 端常驻（可选）

让 daemon 开机自启、崩溃自动重启：见 `deploy/com.poincare.jarvis.daemon.plist`（macOS LaunchAgent）。注意 **Mac 不能休眠**，否则整个系统失联（`sudo pmset -a sleep 0`）。

---

## 7. 使用：从零到能用

### 第一次设置

```bash
# ── Mac 端 ──
cd /Volumes/金阳/jarvis
pnpm install                              # 装依赖

# 配置密钥（语音用的智谱 GLM key、可选）
mkdir -p ~/.jarvis
echo 'JARVIS_RELAY_URL=ws://39.108.123.54:18790' >> ~/.jarvis/env   # 用哪个中继
echo 'JARVIS_ZHIPU_KEY=你的key' >> ~/.jarvis/env                    # brain + 云端语音兜底
chmod 600 ~/.jarvis/env

# 启动 daemon（会自动拉起 voiced 语音 sidecar）
cd packages/daemon && npx tsx src/index.ts

# 生成配对码
cd /Volumes/金阳/jarvis && pnpm --filter @jarvis/daemon pair   # 屏幕出二维码
```

```
# ── 手机端 ──
1. 安装 dist-apk/ 里最新的 jarvis-*.apk
2. 确认能连到中继（国内中继任何网络都行；局域网中继要同 Wi-Fi）
3. 打开 Jarvis → 扫码配对 → 配对成功进入控制台
4. 打字或按🎙说话；危险操作会弹审批；任务执行时可按⏹停止
```

### 日常用法速查

| 想干嘛 | 怎么做 |
|---|---|
| 发文字指令 | 输入框打字 → 发送 |
| 按住说话 | 按住🎙说，松手发送 |
| 点按说话 | 点一下🎙开始，再点一下结束 |
| 连续对话 | 点顶部"对话"开关变绿，之后它会自动接话 |
| 停止任务 | 任务执行时点 ⏹停止 |
| 看任务列表 | 点顶部"任务" |
| 换电脑/解绑 | 长按顶部"解绑" |

---

## 8. 开发与构建

```bash
pnpm install                                  # 装所有依赖
pnpm --filter @jarvis/protocol build          # 协议包要先编译（其他包依赖它的 dist）
pnpm -r typecheck                             # 全量类型检查

# 本地全链路测试（不用真手机）
PORT=8787 npx tsx packages/relay/src/server.ts &                    # 起本地中继
JARVIS_RELAY_URL=ws://127.0.0.1:8787 npx tsx packages/daemon/src/index.ts &   # 起 daemon
PAIR=$(curl -s -X POST http://127.0.0.1:8788/pair)                  # 拿配对信息
cd packages/phone-sim
npx tsx src/index.ts pair "$PAIR"                                   # 假手机配对
npx tsx src/index.ts cmd "列出当前目录文件"                          # 发指令
npx tsx src/index.ts voice /path/to/test.wav                       # 测语音
npx tsx src/index.ts stop                                          # 测停止
```

### 构建 APK（本地，无需 Expo 账号）

```bash
bash scripts/build-apk.sh        # 输出到 dist-apk/jarvis-<时间>.apk
```

> 这台机器的仓库在 exFAT 卷上，脚本会自动把工作区同步到内置 APFS 盘的沙箱里构建（exFAT 会产生 `._*` 垃圾文件破坏 gradle）。首次构建约 8 分钟，之后增量约 1 分钟。

### 常用环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `JARVIS_RELAY_URL` | `ws://127.0.0.1:8787` | 中继地址 |
| `JARVIS_WORKDIR` | `~/JarvisRemoteControl` | 远程任务的沙箱目录 |
| `JARVIS_ZHIPU_KEY` | — | 智谱 GLM key（brain 路由 + 云端语音兜底） |
| `JARVIS_ZHIPU_BASE` | coding plan 端点 | GLM API 基址 |
| `JARVIS_WHISPER_MODEL` | `small` | 本地语音识别模型（可升 `medium` 提精度） |
| `JARVIS_CLAUDE_BIN` | 自动探测 | claude 二进制路径 |

状态文件：`~/.jarvis/daemon.json`（密钥+设备，权限 0600）、`~/.jarvis/tasks.sqlite`（任务历史）、`~/.jarvis/env`（配置）。

---

## 9. 当前进度（诚实版）

### ✅ 已完成并实测验证

- **MVP 链路**：配对、文字指令 → Claude Code 执行 → 流式回传、Tier-3 审批、零知识、离线队列补发、任务持久化
- **APK**：能在真机安装运行（修过闪退、PRNG、缺函数、明文拦截、键盘遮挡等一串真机坑）
- **D1 语音回路**：按住/点按说话 → 本地 whisper 转写 → 执行 → 语音念回结果
- **D2 大脑路由**：GLM-4.7 意图路由 + Typeless 式清洗 + 连续对话模式（实测把"嗯那个…呃不对…"清洗成精确指令）
- **Phase C 部署**：美国 wss + 深圳 ws 两个中继都在线，4G 可用

### 🚧 代码已写、待提交/待验证（重要，诚实标注）

- **停止任务 + 串行队列**：协议 `task.stop`、daemon 串行队列 + `killTree` 递归杀进程树、app 停止按钮——**代码都在工作区但尚未 git 提交**；`killTree` 版本**尚未拿到一次干净的自动化验证 PASS**（之前测试因反复切换中继 + 测试脚本嵌套把环境搞乱了，需要在单 daemon 干净环境重测）；**含停止按钮的新 APK 尚未构建**。

### 📋 待办

- **D3 唤醒词**：喊"贾维斯"免碰手机（方案选定 sherpa-onnx，开源、免账号、离线、支持中文）
- **Phase B 保活**：Android 锁屏/杀后台治理（Kotlin 前台服务 + notifee + ntfy 推送兜底）
- **LAN 直连优化**：在家时自动走局域网（更快），不在家走中继
- 多设备、定时任务、截屏回传、immortal-agent 编排

---

## 10. 踩过的坑（备忘）

| 坑 | 真相 | 解法 |
|---|---|---|
| APK 一装就闪退 | 手写的 expo 包版本号错配（SDK 56 起统一用 56.x） | `expo install --fix` |
| 配对报 "PRNG" | ulid 在 Hermes 引擎没有 `crypto.getRandomValues` | 改用 libsodium 随机源 |
| 配对 "not a function" | react-native-libsodium 原生层没实现 `from_string`（类型声明撒谎） | utf8 编解码改纯 JS |
| 配对静默超时 | release 包默认禁明文 ws:// | `usesCleartextTraffic=true` |
| 键盘遮住输入框 | SDK 53+ 强制 edge-to-edge 破坏了 KeyboardAvoidingView | 换 react-native-keyboard-controller |
| gradle 构建失败 | 仓库在 exFAT 卷，无 POSIX 权限 + `._*` 垃圾文件 | 同步到 APFS 沙箱构建 |
| Cloudflare 证书签不下来 | 橙云代理拦截了 ACME 验证 | 改 DNS only 灰云 |
| 国内 VPS 拉 Docker 失败 | Docker Hub 国内常超时 | 裸 Node + systemd，不用 Docker |
| 停止任务杀不干净 | Claude Code 用 setsid 隔离子进程，杀进程组留孤儿 | `killTree` 顺父子关系递归杀 |
| 测试莫名"卡住" | 反复切中继导致 phone-sim 和 daemon 连了不同中继 | 保证两边同一中继 + 单 daemon |

---

*完整规划见 `~/.claude/plans/hi-i-used-to-reflective-ocean.md`。这个 README 反映 2026-06-11 的真实状态。*
