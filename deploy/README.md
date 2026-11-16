# MiniCoze 上线部署手册

面向：阿里云 ECS 轻量级实例（2核2G，Ubuntu 22.04/24.04），单机部署
架构：Nginx（静态站 + 反代）→ Node/NestJS（pm2 守护，3000 端口）→ PostgreSQL + Redis（同机）

```
浏览器 ──▶ Nginx :80 ──┬── /            → /var/www/minicoze-web （Vite 构建产物）
                       └── /api/  /api-docs → 127.0.0.1:3000 （NestJS）
                                                  └── PostgreSQL / Redis（仅本机）
```

---

## 一、买完服务器后的 4 件事（在阿里云控制台做）

1. **安全组放行端口**：实例 → 安全组 → 配置规则 → 入方向添加
   - 22（SSH）、80（HTTP）、443（HTTPS）
   - ⚠️ 5432 / 6379 **不要**放行，数据库只允许本机访问
2. **重置实例密码**：实例 → 更多 → 密码/密钥 → 重置实例密码（重启生效）
3. **记下公网 IP**
4. （可选，之后做）域名解析 A 记录指向 IP + ICP 备案

## 二、登录服务器并初始化环境

本地终端执行（Windows 用 Git Bash / PowerShell 都行）：

```bash
ssh root@你的公网IP
```

登录后，把项目里的 `deploy/00-init-server.sh` 传上去执行。**最省事的做法**是先在你本地把脚本内容复制，服务器上 `nano init.sh` 粘贴保存，再 `bash init.sh`。

脚本会装好：Node 20、pnpm 9、PostgreSQL、Redis、Nginx、pm2，并创建 2G swap（2G 内存机型必做）。

> **pgvector 必须装**：知识库的 `embedding vector(1024)` 字段和 HNSW 索引都依赖它，缺了 `prisma migrate deploy` 会直接报 `type "vector" does not exist`。脚本里已自动处理（Ubuntu 自带包 → 源码编译兜底），并用**超级用户预先建好扩展**（业务账号执行 `CREATE EXTENSION` 会 permission denied）。
>
> ⚠️ 踩坑记录：**别用 PGDG 官方源加镜像源的方式装**。apt.postgresql.org 国内只有几 KB/s；清华镜像的 pgdg 路径是 `mirrors.tuna.tsinghua.edu.cn/postgresql/repos/apt`（注意不是 `/pub/repos/apt`），且容易 404。源码编译最快。

结束后会打印凭据文件路径：

```bash
cat /root/minicoze-credentials.txt
```

里面是 `DATABASE_URL` 和 `JWT_SECRET`，下一步要用。**保存好后删掉这个文件。**

## 三、配置后端环境变量

```bash
cd /var/www/minicoze
mkdir -p apps/backend
nano apps/backend/.env
```

把 `deploy/env.production.example` 的内容粘进去，替换这 3 处：

| 变量 | 取值 |
|------|------|
| `DATABASE_URL` | 用凭据文件里那条 |
| `JWT_SECRET` | 用凭据文件里那条（**必须 ≥32 位**，否则启动直接报错） |
| `CORS_ORIGIN` | `http://你的域名` 或 `http://服务器IP` |
| `DEEPSEEK_API_KEY` / `EMBEDDING_API_KEY` | 你自己的 key |

> 文件在第一次上传代码后才存在于 `/var/www/minicoze`，所以顺序是：**先跑第二节的初始化 → 先上传一次代码 → 再建 .env**。或者直接 `cp deploy/env.production.example apps/backend/.env` 修改。

## 四、配置 Nginx

```bash
cp /var/www/minicoze/deploy/nginx/minicoze.conf /etc/nginx/conf.d/minicoze.conf
# 有域名就改 server_name 和 CORS_ORIGIN
nano /etc/nginx/conf.d/minicoze.conf
nginx -t && systemctl reload nginx
```

## 五、本地一键发布

在**你自己的电脑**上，项目根目录执行：

```bash
bash deploy/upload.sh root@你的公网IP

# 或者用 npm script（注意必须带 run，pnpm deploy 是 pnpm 内置命令，会报
# ERR_PNPM_NOTHING_TO_DEPLOY）
pnpm run deploy:upload root@你的公网IP
```

这条命令会自动：本地构建前后端 → 打包上传 → 服务器装依赖 → Prisma 迁移 → pm2 启动 → Nginx 重载。

完成后浏览器打开 `http://你的公网IP` 就能看到页面。

> **为什么不在服务器上构建？** 2G 内存跑 `tsc` 很容易 OOM。所以编译在本地做，服务器只负责运行。

## 六、后续每次发版

改完代码，重新执行同一条命令即可：

```bash
bash deploy/upload.sh root@你的公网IP
```

服务器上的 `.env` 和 `storage/uploads` 不会被覆盖（打包时已排除）。

## 七、常用运维命令

```bash
pm2 status                        # 进程状态
pm2 logs minicoze-api --lines 100 # 后端日志
pm2 restart minicoze-api          # 手动重启
pm2 monit                         # 实时 CPU/内存
tail -f /var/log/nginx/error.log  # Nginx 错误
systemctl restart postgresql redis-server nginx
free -h && df -h                  # 内存 / 磁盘
```

## 八、验收清单

- [ ] `http://IP` 打开是登录页，不是 502/404 白屏
- [ ] 能注册 + 登录（说明 API 通、数据库通、JWT 正常）
- [ ] 创建一个 Agent 并对话，**回复是逐字流式出现**（说明 SSE 没被 Nginx 缓冲）
- [ ] 上传一个图片/文档成功（说明 60m 上传限制和 storage 目录正常）
- [ ] `pm2 status` 里 `minicoze-api` 是 `online` 且重启次数不涨
- [ ] `curl http://127.0.0.1:3000/api` 有响应（后端存活）

## 九、常见问题

**502 Bad Gateway**：后端没起来。`pm2 logs minicoze-api` 看报错，最常见是 `.env` 缺变量（比如 JWT_SECRET 太短）或 `DATABASE_URL` 密码错。

**对话回复一次性蹦出来**：Nginx 少了 `proxy_buffering off`，检查第四节配置是否生效。

**上传大文件报 413**：`client_max_body_size` 没改或没 reload。

**内存打满进程被杀**：`free -h` 看 swap 有没有生效；`pm2 monit` 看是不是有内存泄漏。2G 机型建议后续把文件存储切到 COS（`FILE_STORAGE_DRIVER=cos`）。

**数据库连不上**：`systemctl status postgresql`；确认 `pg_hba.conf` 里 127.0.0.1 是 `scram-sha-256`。

**启动即崩循环（pm2 显示 `↺ 151` 次重启、3000 端口无监听）**：先手动跑 `cd apps/backend && node dist/main.js` 看真实堆栈。最常见是缺 `SECRET_ENCRYPTION_KEY`：

```
BusinessException: SECRET_ENCRYPTION_KEY is required in production
```

补上即可（**这个 key 一旦设定别改**，它用于解密库里存的模型凭证）：

```bash
cd /var/www/minicoze/apps/backend
echo "SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
pm2 restart minicoze-api
```

**prisma generate 报 `request to https://binaries.prisma.sh/... failed`**：Prisma 引擎在海外，国内拉不动。发布脚本已默认加镜像，手动执行时补上这两个变量：

```bash
export PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
pnpm --filter backend exec prisma generate
```

**迁移报 `type "vector" does not exist`**：pgvector 没装好。**不要去加 PGDG 官方源或镜像源**（国内拉取几 KB/s，镜像路径还经常变），直接源码编译：

```bash
apt install -y postgresql-server-dev-14 build-essential git
git clone --depth 1 --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector
cd /tmp/pgvector && make && make install
sudo -u postgres psql -d minicoze -c "CREATE EXTENSION IF NOT EXISTS vector;"
```
（PG_VER 用 `ls /etc/postgresql` 看，22.04 是 14，24.04 是 16）

## 十、备份（建议第二天就做）

```bash
# 数据库每日备份
mkdir -p /root/backup
cat > /root/backup/db.sh <<'EOF'
#!/bin/bash
pg_dump -h 127.0.0.1 -U minicoze minicoze | gzip > /root/backup/minicoze-$(date +%F).sql.gz
find /root/backup -name '*.sql.gz' -mtime +7 -delete
EOF
chmod +x /root/backup/db.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /root/backup/db.sh") | crontab -
```

上传的文件在 `apps/backend/storage/uploads`，也需要定期打包备份（或直接切 COS）。
