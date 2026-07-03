declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 如果还有其他模块需要声明
declare module '*.json' {
  const value: any
  export default value
}
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// ====== 添加 v-md-editor 类型声明 ======
declare module '@kangc/v-md-editor' {
  const VMdEditor: any
  export default VMdEditor
}

declare module '@kangc/v-md-editor/lib/theme/vuepress' {
  const vuepressTheme: any
  export default vuepressTheme
}

declare module 'prismjs' {
  const Prism: any
  export default Prism
}