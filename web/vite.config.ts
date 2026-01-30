import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    proxy: {
      // 代理远程资源请求到COS，避免CORS问题
      // 注意：这个规则必须在/SCVI和/LZA之前定义，以确保优先匹配
      "/remote-assets": {
        target: "https://pokemon-model-1400264169.cos.ap-beijing.myqcloud.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/remote-assets/, ""),
      },
      "/icons": {
        target: "http://localhost:5002",
        changeOrigin: true,
      },
      "/model-index": {
        target: "http://localhost:5002",
        changeOrigin: true,
      },
      "/models": {
        target: "http://localhost:5002",
        changeOrigin: true,
      },
    },
  },
}));
