# 部署

## Phase C: VPS（relay + ntfy + 自动 TLS）

前置：一台 VPS（建议境内，WSS 443 体验最好）+ 一个域名，`relay.<域名>` 和 `ntfy.<域名>` 两条 A 记录指向 VPS。

```bash
# VPS 上
git clone <repo> jarvis && cd jarvis/deploy
echo "DOMAIN=example.com" > .env
docker compose up -d --build
curl https://relay.example.com/healthz   # → ok
```

Mac 端切换 relay：`JARVIS_RELAY_URL=wss://relay.example.com` 重启 daemon。
手机端重新扫码配对一次（二维码里带新 relayUrl）。

## Mac 防睡眠（daemon 单点死穴）

```bash
sudo pmset -a sleep 0 displaysleep 10   # 永不系统休眠，仅熄屏
# 或临时: caffeinate -is &
```

## daemon 开机自启

见 `com.poincare.jarvis.daemon.plist` 头部注释。
