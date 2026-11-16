# ============================================================
# MiniCoze 本地一键发布（Windows PowerShell 版）
# 用法：
#   pnpm run deploy:upload root@101.200.30.115
#   或
#   powershell -ExecutionPolicy Bypass -File deploy/upload.ps1 root@101.200.30.115
#
# 不用 bash：直接用 Windows 自带的 tar + OpenSSH 的 scp/ssh
# ============================================================
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Target
)

$ErrorActionPreference = 'Stop'
$RemoteDir = '/var/www/minicoze'
$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

function Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Assert-Ok($what) {
    if ($LASTEXITCODE -ne 0) {
        throw "$what 失败（退出码 $LASTEXITCODE）"
    }
}

# ---------- 1. 构建前端 ----------
Step "[1/4] 本地构建前端"
& pnpm build:web
Assert-Ok "前端构建"

# ---------- 2. 构建后端 ----------
Step "[2/4] 本地构建后端"
& pnpm --filter backend build
Assert-Ok "后端构建"

# ---------- 3. 打包 ----------
Step "[3/4] 打包"
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$tarball = Join-Path $env:TEMP "minicoze-release-$stamp.tar.gz"
if (Test-Path $tarball) { Remove-Item $tarball -Force }

# *.env* 会排除 .env / .env.production / .env.bak 等，避免把密钥传上去
# 注意：deploy/env.production.example 不含 ".env" 子串，不会被排除
& tar -czf $tarball `
    --exclude=node_modules `
    --exclude=.git `
    --exclude=*.env* `
    --exclude=storage/uploads `
    --exclude=*.dump `
    deploy package.json pnpm-lock.yaml pnpm-workspace.yaml apps/backend apps/web/dist packages
Assert-Ok "打包"
Write-Host ("    包大小：" + [math]::Round((Get-Item $tarball).Length / 1MB, 2) + " MB")

# ---------- 4. 上传 + 远程发布 ----------
Step "[4/4] 上传并发布到 $Target"

$scp = (Get-Command scp -ErrorAction SilentlyContinue).Source
if (-not $scp) { $scp = 'C:\Windows\System32\OpenSSH\scp.exe' }
if (-not (Test-Path $scp) -and -not (Get-Command $scp -ErrorAction SilentlyContinue)) {
    throw "找不到 scp，请确认 Windows 已安装 OpenSSH 客户端"
}

& $scp $tarball "${Target}:/tmp/minicoze-release.tar.gz"
Assert-Ok "上传"

$remoteCmd = "set -e; mkdir -p $RemoteDir; tar -xzf /tmp/minicoze-release.tar.gz -C $RemoteDir; rm -f /tmp/minicoze-release.tar.gz; cd $RemoteDir; bash deploy/10-release.sh"
& ssh -t $Target $remoteCmd
Assert-Ok "远程发布"

Remove-Item $tarball -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "🎉 发布完成，打开 http://$($Target.Split('@')[-1]) 查看" -ForegroundColor Green
