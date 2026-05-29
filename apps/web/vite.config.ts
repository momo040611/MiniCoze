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
          manualChunks(id) {
            if (id.includes('react-router')) return 'router';
            if (id.includes('node_modules')) return 'vendor';
          },
        },
      },
    },
  };
});
