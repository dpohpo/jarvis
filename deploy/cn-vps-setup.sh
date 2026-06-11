#!/usr/bin/env bash
# 国内 VPS 部署 Jarvis relay（裸 Node + systemd，不用 Docker）。
#
# 为什么不用 Docker / 域名 / TLS：
#   - 国内拉 Docker Hub 镜像慢/常失败 → 裸 Node 进程更稳
#   - 未备案域名解析到大陆服务器，80/443 被强制封；非标端口绑域名会被周期
#     扫描封 24-72h → 纯 IP + 高端口，不绑域名，不触发备案监管
#   - 传输层用明文 ws://，但 envelope 是 libsodium crypto_box 端到端加密的，
#     relay 零知识，中间人只能看到密文 + 连接元数据（IP/大小/时序）
#
# 用法：在本地仓库根目录运行  bash deploy/cn-vps-setup.sh root@<VPS_IP> [PORT]
set -euo pipefail

TARGET="${1:?用法: cn-vps-setup.sh root@<VPS_IP> [PORT]}"
PORT="${2:-18790}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> [1/5] 远端环境：swap + Node22(npmmirror) + pnpm + rsync"
ssh "$TARGET" 'set -e
  if ! swapon --show | grep -q swapfile; then
    fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024
    chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
    grep -q swapfile /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
  fi
  command -v rsync >/dev/null || { apt-get update -qq; apt-get install -y -qq rsync build-essential python3; }
  if ! /opt/node/bin/node -v 2>/dev/null | grep -qE "v22\.(1[3-9]|[2-9][0-9])"; then
    VER=$(curl -fsSL https://registry.npmmirror.com/-/binary/node/ | grep -oE "v22\.[0-9]+\.[0-9]+/" | tr -d "/" | sort -V | tail -1)
    cd /opt && curl -fsSL "https://registry.npmmirror.com/-/binary/node/$VER/node-$VER-linux-x64.tar.xz" -o node.tar.xz
    tar xf node.tar.xz && rm -f node.tar.xz && rm -rf node && mv "node-$VER-linux-x64" node
    ln -sf /opt/node/bin/node /usr/local/bin/node
    /opt/node/bin/npm config set registry https://registry.npmmirror.com
    /opt/node/bin/npm i -g pnpm@11.5.3
    ln -sf /opt/node/bin/pnpm /usr/local/bin/pnpm
  fi
  node -v && pnpm -v'

echo "==> [2/5] 同步 protocol + relay 源码"
rsync -az --delete -e ssh --exclude node_modules --exclude dist --exclude "*.tsbuildinfo" --exclude "._*" \
  "$REPO/package.json" "$REPO/pnpm-workspace.yaml" "$REPO/pnpm-lock.yaml" "$REPO/tsconfig.base.json" "$TARGET:/opt/jarvis/"
rsync -az --delete -e ssh --exclude node_modules --exclude dist --exclude "*.tsbuildinfo" --exclude "._*" \
  "$REPO/packages/protocol" "$REPO/packages/relay" "$TARGET:/opt/jarvis/packages/"

echo "==> [3/5] 远端构建"
ssh "$TARGET" 'cd /opt/jarvis && export PATH=/opt/node/bin:$PATH &&
  pnpm install --filter @jarvis/protocol --filter @jarvis/relay --frozen-lockfile &&
  pnpm --filter @jarvis/protocol build && pnpm --filter @jarvis/relay build'

echo "==> [4/5] systemd 守护 (端口 $PORT)"
ssh "$TARGET" "cat > /etc/systemd/system/jarvis-relay.service <<EOF
[Unit]
Description=Jarvis zero-knowledge relay
After=network.target
[Service]
Type=simple
WorkingDirectory=/opt/jarvis
Environment=PORT=$PORT
Environment=DB_PATH=/opt/jarvis/relay.sqlite
ExecStart=/opt/node/bin/node /opt/jarvis/packages/relay/dist/server.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now jarvis-relay && sleep 2 && systemctl is-active jarvis-relay"

echo "==> [5/5] 验证"
ssh "$TARGET" "curl -s http://127.0.0.1:$PORT/healthz" && echo " <-- relay healthz"
echo ""
echo "✅ 完成。记得在云厂商控制台防火墙放行 TCP $PORT。"
echo "   daemon 切换:  JARVIS_RELAY_URL=ws://<VPS_IP>:$PORT"
