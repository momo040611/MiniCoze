import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';
  const apiProxyPrefix = env.VITE_API_PROXY_PREFIX || '/api';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        [apiProxyPrefix]: {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
    build: {
      rollupOptions: {
        output: {
          // 只把路由库固定成稳定 chunk；其余交给 Rollup 按真实引用关系分包。
          // 不要写 `if (id.includes('node_modules')) return 'vendor'`：
          // 那会把只有懒加载页面才用的 flowgram / katex / highlight.js
          // 一起塞进首屏必下的 vendor 块（实测 2.6 MB）。
          manualChunks(id) {
            if (id.includes('react-router')) return 'router';
          },
        },
      },
    },
  };
});
