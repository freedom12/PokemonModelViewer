import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue()
  ],
  server: {
    host: '0.0.0.0',
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
  }
}));
