import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  publicDir: mode === 'production' ? false : 'public',
  server: {
    host: '0.0.0.0',
    proxy:
      mode === 'development'
        ? {
            '/pokemon': {
              target: 'http://localhost:5002',
              changeOrigin: true,
            },
            // 如果 pokemon_name.json 在根路径,也要代理
            '/pokemon_name.json': {
              target: 'http://localhost:5002',
              changeOrigin: true,
            },
          }
        : undefined,
  },
}));
