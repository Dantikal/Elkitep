import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// В режиме разработки запросы /api проксируются на Django, поэтому CORS не нужен.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': { target: env.BACKEND_URL || 'http://127.0.0.1:8000', changeOrigin: true } },
    },
  };
});
