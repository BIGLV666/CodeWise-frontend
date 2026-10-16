import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { installGlobalErrorHandlers } from '@/utils/globalErrorHandler'

import 'element-plus/dist/index.css'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/responsive.css'
import '@/styles/element-theme.css'

const app = createApp(App)
const pinia = createPinia()

// 先装兜底，保证挂载阶段抛出的异常也有统一出口
installGlobalErrorHandlers(app)

app.use(pinia)
app.use(router)
app.mount('#app')
