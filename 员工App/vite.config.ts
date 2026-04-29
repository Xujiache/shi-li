import { defineConfig } from 'vite'
import uniModule from '@dcloudio/vite-plugin-uni'

// 兼容 ESM/CJS 互操作：默认导出可能是 .default
const uni: any = (uniModule as any).default || uniModule

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'es2015',
    chunkSizeWarningLimit: 1500
  }
})
