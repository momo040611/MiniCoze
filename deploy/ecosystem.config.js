// pm2 进程配置
// 用法：pm2 start deploy/ecosystem.config.js
// 2G 内存机器：固定单实例 fork 模式，别开 cluster，否则内存翻倍
module.exports = {
  apps: [
    {
      name: 'minicoze-api',
      cwd: '/var/www/minicoze/apps/backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      // 超过 700M 自动重启，防止 2G 小机器被吃爆
      max_memory_restart: '700M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/minicoze/error.log',
      out_file: '/var/log/minicoze/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
