import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    ...(mode === 'production'
      ? [
          viteStaticCopy({
            targets: [
              {
                src: 'public/SCVI/pm0001/**/*',
                dest: 'SCVI/pm0001',
              },
              {
                src: 'public/SCVI/index.json',
                dest: 'SCVI',
              },
              {
                src: 'public/LZA/pm0001/**/*',
                dest: 'LZA/pm0001',
              },
              {
                src: 'public/LZA/index.json',
                dest: 'LZA',
              },
              {
                src: 'public/pokemon_name.json',
                dest: '',
              },
            ],
          }),
        ]
      : []),
  ],
  publicDir: mode === 'production' ? false : 'public',
  server: {
    host: '0.0.0.0',
    // 优化开发服务器性能
    fs: {
      // 允许访问项目根目录以外的文件
      allow: ['..'],
    },
    proxy: {
      '/SCVI': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
      '/LZA': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
      '/pokemon_name.json': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
    },
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['vue', 'three', '@vue/runtime-core', '@vue/runtime-dom'],
  },
  // 启用构建缓存
  build: {
    // 增加 chunk 大小警告限制
    chunkSizeWarningLimit: 1000,
  },
}));
