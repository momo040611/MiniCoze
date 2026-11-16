#!/usr/bin/env bash
# ============================================================
# MiniCoze 服务器初始化脚本（Ubuntu 22.04 / 24.04）
# 用法：在服务器上以 root 执行
#   bash 00-init-server.sh
# 作用：装 Node20 + pnpm9 + PostgreSQL + Redis + Nginx + pm2，加 2G swap
# 幂等：可以重复执行，不会重复安装
# ============================================================
set -euo pipefail

APP_DIR="/var/www/minicoze"
LOG_DIR="/var/log/minicoze"
DB_NAME="minicoze"
DB_USER="minicoze"

echo "==> [1/7] 系统更新 & 基础工具"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git build-essential nginx postgresql postgresql-contrib redis-server openssl

echo "==> [2/7] 安装 Node.js 20"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> [3/7] 启用 pnpm 9（corepack）+ 国内镜像"
corepack enable
corepack prepare pnpm@9.0.0 --activate || npm i -g pnpm@9
pnpm config set registry https://registry.npmmirror.com
pnpm -v

echo "==> [4/7] 安装 pm2"
command -v pm2 >/dev/null 2>&1 || npm i -g pm2

echo "==> [5/7] 创建 2G swap（2G 内存机型必做，防 OOM）"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi
free -h

echo "==> [6/7] 初始化 PostgreSQL（库 + 用户 + 随机密码）"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
systemctl enable --now postgresql
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" >/dev/null

echo "==> [6.1/7] 安装 pgvector（知识库 RAG 的 embedding 字段依赖它，缺了迁移会直接失败）"
PG_VER="$(ls /etc/postgresql | head -1)"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_available_extensions WHERE name='vector'" | grep -q 1; then
  # 方案 A：Ubuntu 自带包（24.04 有，22.04 通常没有）
  # 注意：不要去加 PGDG 官方源，国内拉取只有几 KB/s，会把这条流程卡死；
  # 镜像站的 pgdg 路径经常变动（清华是 /postgresql/repos/apt，可能 404）。
  apt-get install -y "postgresql-${PG_VER}-pgvector" >/dev/null 2>&1 || {
    echo "    Ubuntu 源没有 pgvector，改源码编译（约 1 分钟）..."
    apt-get install -y "postgresql-server-dev-${PG_VER}" build-essential git
    rm -rf /tmp/pgvector
    git clone --depth 1 --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector \
      || git clone --depth 1 --branch v0.8.0 https://gitee.com/mirrors/pgvector.git /tmp/pgvector
    ( cd /tmp/pgvector && make -j2 && make install )
  }
fi
# 用超级用户预先建好扩展：迁移脚本里的 CREATE EXTENSION 需要超权，业务账号执行会 permission denied
sudo -u postgres psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null
echo "    pgvector 版本：$(sudo -u postgres psql -tAc "SELECT extversion FROM pg_extension WHERE extname='vector'" -d ${DB_NAME})"

# 本机 TCP 访问需要密码（scram），外网无法直连，安全
PG_CONF="$(ls /etc/postgresql/*/main/pg_hba.conf | head -1)"
grep -q "^host    all             all             127.0.0.1/32            scram-sha-256" "$PG_CONF" \
  || sed -i 's/^host\s*all\s*all\s*127.0.0.1\/32\s*.*/host    all             all             127.0.0.1\/32            scram-sha-256/' "$PG_CONF"
systemctl restart postgresql

echo "==> [7/7] 启动 Redis / Nginx、放开防火墙、建目录"
systemctl enable --now redis-server
systemctl enable --now nginx
mkdir -p "$APP_DIR" "$LOG_DIR" "$APP_DIR/apps/backend/storage/uploads"

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null || true
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
fi

JWT_SECRET_GEN="$(openssl rand -hex 32)"
CRED_FILE="/root/minicoze-credentials.txt"

cat > "$CRED_FILE" <<EOF
========================= MiniCoze 部署凭据（请自行保存后删除）=========================
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"
JWT_SECRET="${JWT_SECRET_GEN}"
生成时间：$(date '+%Y-%m-%d %H:%M:%S')
EOF
chmod 600 "$CRED_FILE"

echo ""
echo "==================== 初始化完成 ===================="
echo "数据库连接串和 JWT_SECRET 已写入：${CRED_FILE}"
echo "执行 cat ${CRED_FILE} 查看，粘贴到 apps/backend/.env 里"
echo ""
echo "注意：还要去【阿里云控制台 → 安全组】放行 22 / 80 / 443 端口"
echo "下一步：执行 deploy/10-release.sh"
echo "===================================================="
