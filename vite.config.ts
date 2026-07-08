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
  // ✅ define 放在 plugins 外面，和 resolve 同级
  define: {
    global: 'window',      // 修复 global is not defined
    'process.env': {},     // 修复其他 Node.js 变量
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // ✅ 强制使用浏览器版本
      'sockjs-client': 'sockjs-client/dist/sockjs.min.js',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/uploads': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      }
    }
  }
})
