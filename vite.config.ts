import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    ...(mode === 'production' ? [
      viteStaticCopy({
        targets: [
          {
            src: 'public/SCVI/**/*',
            dest: 'SCVI'
          },
          {
            src: 'public/pokemon_name.json',
            dest: ''
          }
        ]
      })
    ] : [])
  ],
  publicDir: mode === 'production' ? false : 'public',
  server: {
    host: '0.0.0.0'
  }
}))
