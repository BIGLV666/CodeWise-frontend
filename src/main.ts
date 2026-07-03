import { createApp } from 'vue'
import { createPinia } from 'pinia'  // ← 添加
import App from './App.vue'
import router from './router'

import 'element-plus/dist/index.css'

// Markdown 相关
// @ts-ignore
import VMdEditor from '@kangc/v-md-editor'
// @ts-ignore
import '@kangc/v-md-editor/lib/style/base-editor.css'
// @ts-ignore
import vuepressTheme from '@kangc/v-md-editor/lib/theme/vuepress'
// @ts-ignore
import '@kangc/v-md-editor/lib/theme/style/vuepress.css'

// 代码高亮
// @ts-ignore
import Prism from 'prismjs'
import 'prismjs/themes/prism.css'

// @ts-ignore
VMdEditor.use(vuepressTheme, {
  Prism,
})

const app = createApp(App)

// ====== 创建 Pinia 实例并挂载 ======
const pinia = createPinia()
app.use(pinia)  // ← 必须先 use
app.use(router)

app.use(VMdEditor)

app.mount('#app')