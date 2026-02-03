import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import serveStatic from 'serve-static';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/pmv/',
  plugins: [
    vue(),
    {
      name: 'local-assets',
      configureServer(server) {
        server.middlewares.use(
          '/pmv/local',
          serveStatic(path.resolve(__dirname, '../assets/local'))
        );
      },
    },
  ],
  server: {
    fs: {
      allow: ['..'],
    },
    host: '0.0.0.0',
    proxy: {
      // 代理远程资源请求到COS，避免CORS问题
      // 注意：这个规则必须在/SCVI和/LZA之前定义，以确保优先匹配
      '/remote-cos': {
        target: 'https://pokemon-model-1400264169.cos.ap-beijing.myqcloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/remote-cos/, ''),
      },
      '/remote': {
        target: 'http://localhost:5003',
        changeOrigin: true,
      },
    },
  },
}));
