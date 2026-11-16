#!/usr/bin/env bash
# ============================================================
# 本地一键发布（Windows Git Bash / macOS / Linux 都可用）
# 用法：
#   bash deploy/upload.sh root@1.2.3.4
# 做的事：
#   1. 本地构建前端 + 后端（服务器只有 2G 内存，不在服务器编译）
#   2. 打包源码 + 构建产物（排除 node_modules / .env / storage）
#   3. 传到服务器 /var/www/minicoze 并解压
#   4. 远程执行 10-release.sh（装依赖 → migrate → pm2 重启 → nginx reload）
# ============================================================
set -euo pipefail

SSH_TARGET="${1:-}"
REMOTE_DIR="/var/www/minicoze"

if [ -z "$SSH_TARGET" ]; then
  echo "用法：bash deploy/upload.sh root@服务器IP"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> [1/4] 本地构建前端"
pnpm build:web

echo "==> [2/4] 本地构建后端"
pnpm --filter backend build

echo "==> [3/4] 打包并上传到 $SSH_TARGET:$REMOTE_DIR"
TARBALL="/tmp/minicoze-release-$(date +%Y%m%d%H%M%S).tar.gz"
tar -czf "$TARBALL" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='storage/uploads' \
  --exclude='*.dump' \
  deploy package.json pnpm-lock.yaml pnpm-workspace.yaml \
  apps/backend apps/web/dist packages

echo "    包大小：$(du -h "$TARBALL" | cut -f1)"
ssh "$SSH_TARGET" "mkdir -p $REMOTE_DIR"
scp "$TARBALL" "$SSH_TARGET:/tmp/minicoze-release.tar.gz"
ssh "$SSH_TARGET" "tar -xzf /tmp/minicoze-release.tar.gz -C $REMOTE_DIR && rm -f /tmp/minicoze-release.tar.gz"

echo "==> [4/4] 远程发布"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && bash deploy/10-release.sh"

rm -f "$TARBALL"
echo ""
echo "🎉 全部完成，浏览器打开 http://$SSH_TARGET 的 IP 即可访问"
