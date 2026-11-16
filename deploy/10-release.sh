#!/usr/bin/env bash
# ============================================================
# MiniCoze 发布脚本（在服务器上执行，由 upload.sh 自动调用）
# 前提：代码已解压到 /var/www/minicoze，且 apps/backend/.env 已配置
# 用法：bash deploy/10-release.sh
# ============================================================
set -euo pipefail

APP_DIR="/var/www/minicoze"
WEB_ROOT="/var/www/minicoze-web"
BACKEND_DIR="$APP_DIR/apps/backend"

cd "$APP_DIR"

echo "==> [1/6] 检查后端环境变量"
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "❌ 缺少 $BACKEND_DIR/.env"
  echo "   请先执行：cp deploy/env.production.example $BACKEND_DIR/.env 然后填入真实值"
  exit 1
fi

echo "==> [2/6] 安装后端依赖（只装 backend，跳过前端）"
pnpm install --frozen-lockfile --filter backend

# Prisma 引擎默认从 binaries.prisma.sh（海外）下载，国内会超时；
# 换 npmmirror 镜像，并允许校验文件缺失时跳过校验
export PRISMA_ENGINES_MIRROR="${PRISMA_ENGINES_MIRROR:-https://registry.npmmirror.com/-/binary/prisma}"
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING="${PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING:-1}"

echo "==> [3/6] 生成 Prisma Client（引擎走 npmmirror 镜像）"
pnpm --filter backend exec prisma generate

echo "==> [4/6] 执行数据库迁移"
pnpm --filter backend exec prisma migrate deploy

echo "==> [5/6] 发布前端静态文件到 $WEB_ROOT"
if [ ! -d "$APP_DIR/apps/web/dist" ]; then
  echo "❌ 缺少 apps/web/dist，请先在本地执行 npm run build:web 再上传"
  exit 1
fi
mkdir -p "$WEB_ROOT"
rm -rf "$WEB_ROOT"/*
cp -r "$APP_DIR/apps/web/dist/." "$WEB_ROOT"/
chown -R www-data:www-data "$WEB_ROOT"

echo "==> [6/6] 重启后端进程 + 重载 Nginx"
mkdir -p /var/log/minicoze
if pm2 describe minicoze-api >/dev/null 2>&1; then
  pm2 reload "$APP_DIR/deploy/ecosystem.config.js" --update-env
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.js"
  pm2 save
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
fi
nginx -t && systemctl reload nginx

echo ""
echo "✅ 发布完成"
echo "   后端状态：pm2 status"
echo "   后端日志：pm2 logs minicoze-api --lines 100"
echo "   健康检查：curl -I http://127.0.0.1:3000/api"
