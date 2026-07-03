import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver({
        importStyle: 'css',
      })],
    }),
    Components({
      resolvers: [ElementPlusResolver({
        importStyle: 'css',
      })],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8082',  // 后端服务地址
        changeOrigin: true,
        // 如果需要去掉 /api 前缀，取消注释
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})