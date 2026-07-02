#!/usr/bin/env bash
# daemon-health-check.sh — Phase 1 verification script
#
# Verifies Jarvis desktop daemon can serve the mobile app:
#   1. Sparsebundle mounted at /Volumes/JarvisBuild
#   2. pnpm workspace installed (tsx available)
#   3. Daemon listening on 8788
#   4. ASR sidecar listening on 8898
#
# If any check fails, prints the remediation step and exits non-zero.
# Run before each coding session, or whenever the desktop app reports
# it cannot reach the daemon.

set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'
ok() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

EXIT_CODE=0

# §1 Sparsebundle
if mount | grep -q "/Volumes/JarvisBuild"; then
  ok "sparsebundle mounted at /Volumes/JarvisBuild"
else
  fail "sparsebundle not mounted"
  echo "  → Fix: hdiutil attach /Volumes/金阳/jarvis-build-sparsebundle.dmg"
  EXIT_CODE=1
fi

# §2 tsx binary
TSX_BIN="/Volumes/JarvisBuild/node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/loader.mjs"
if [ -f "$TSX_BIN" ]; then
  ok "tsx installed at /Volumes/JarvisBuild/node_modules"
else
  fail "tsx not found"
  echo "  → Fix: cd /Volumes/金阳/jarvis && CI=true pnpm install"
  EXIT_CODE=1
fi

# §3 daemon port 8788
if lsof -i :8788 -sTCP:LISTEN >/dev/null 2>&1; then
  DAEMON_PID=$(lsof -ti :8788 -sTCP:LISTEN | head -1)
  DAEMON_UPTIME=$(ps -p $DAEMON_PID -o etime= 2>/dev/null | tr -d ' ' || echo "?")
  ok "daemon on 8788 (PID $DAEMON_PID, uptime $DAEMON_UPTIME)"
else
  fail "daemon not listening on 8788"
  echo "  → Fix: cd /Volumes/金阳/jarvis/packages/daemon && pnpm start"
  EXIT_CODE=1
fi

# §4 ASR port 8898
if lsof -i :8898 -sTCP:LISTEN >/dev/null 2>&1; then
  ASR_PID=$(lsof -ti :8898 -sTCP:LISTEN | head -1)
  ok "ASR sidecar on 8898 (PID $ASR_PID)"
  # Probe health
  if curl -sS --max-time 2 -o /dev/null http://127.0.0.1:8898/; then
    ok "ASR HTTP responds"
  else
    warn "ASR port open but HTTP probe failed"
  fi
else
  fail "ASR not listening on 8898"
  echo "  → ASR is a daemon child process; restart daemon if missing"
  EXIT_CODE=1
fi

# §5 agents.sqlite
if [ -f ~/.jarvis/agents.sqlite ]; then
  SIZE=$(stat -f %z ~/.jarvis/agents.sqlite 2>/dev/null || stat -c %s ~/.jarvis/agents.sqlite 2>/dev/null)
  ok "~/.jarvis/agents.sqlite exists (${SIZE} bytes)"
else
  fail "~/.jarvis/agents.sqlite missing"
  EXIT_CODE=1
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}=== ALL CHECKS PASSED ===${NC}"
else
  echo -e "${RED}=== SOME CHECKS FAILED (see above for fixes) ===${NC}"
fi
exit $EXIT_CODE
