// src/utils/request.ts

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/User'
import router from '@/router'

// 创建 axios 实例
const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  withCredentials: true,
})

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * 静默请求：失败时不弹全局错误提示。
     * 用于后台轮询（未读数、状态轮询）——它们失败用户无感，不该反复打扰。
     */
    silent?: boolean
  }
}

let handlingUnauthorized = false

/**
 * 同一文案的静默窗口：并发请求同时失败时只弹一条，避免弹幕式刷屏。
 * 后端整体不可用（连不上/5xx）时用更长的窗口，让一屏请求塌缩成一条提示。
 */
const DUPLICATE_WINDOW_MS = 3000
const SERVICE_DOWN_WINDOW_MS = 10000

let lastNotice = { text: '', at: 0 }

function notifyError(text: string, windowMs = DUPLICATE_WINDOW_MS) {
  const now = Date.now()
  if (lastNotice.text === text && now - lastNotice.at < windowMs) return
  lastNotice = { text, at: now }
  ElMessage.error(text)
}

/** 把 HTTP/网络层错误翻译成面向用户的提示。 */
function resolveErrorNotice(error: AxiosError): { text: string; serviceDown: boolean } {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return { text: '请求超时，请稍后重试', serviceDown: false }
  }
  if (!error.response) {
    // 没有响应 = 服务连不上（后端未启动、网络断开、被网关拦截）
    return { text: '服务暂时无法连接，请稍后重试', serviceDown: true }
  }

  const status = error.response.status
  switch (status) {
    case 400:
      return { text: '请求有误，请检查后重试', serviceDown: false }
    case 403:
      return { text: '没有权限执行该操作', serviceDown: false }
    case 404:
      return { text: '请求的内容不存在或已被删除', serviceDown: false }
    case 408:
      return { text: '请求超时，请稍后重试', serviceDown: false }
    case 429:
      return { text: '操作太频繁，请稍后再试', serviceDown: false }
    case 500:
      return { text: '服务出了点问题，请稍后重试', serviceDown: true }
    case 502:
    case 503:
    case 504:
      return { text: '服务正在升级或维护，请稍后重试', serviceDown: true }
    default:
      return { text: '请求失败，请稍后重试', serviceDown: status >= 500 }
  }
}

// 请求拦截器
request.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    if (!config.headers) {
      config.headers = {}
    }

    const userStore = useUserStore()
    const token = userStore.token

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config as any
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
 (response: AxiosResponse) => {
    const res = response.data
    if (res.code !== 200) {
      const message = res.message || '操作失败，请稍后重试'
      if (!response.config?.silent) notifyError(message)
      // 把业务码一并挂到错误上，便于调用方按码分支（如 AI 实时分析的
      // CODE_CHANGE_RANGE_INVALID 需要重建快照，而不是盲目重试）。
      const bizError = new Error(message) as Error & { bizCode?: number }
      bizError.bizCode = res.code
      return Promise.reject(bizError)
    }
    return res
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (!handlingUnauthorized) {
        handlingUnauthorized = true
        const userStore = useUserStore()
        userStore.logout()
        ElMessage.closeAll()
        ElMessage.warning('登录状态已失效，请重新登录')
        router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
          .finally(() => window.setTimeout(() => { handlingUnauthorized = false }, 1000))
      }
      return Promise.reject(error)
    }

    if (!error.config?.silent) {
      const { text, serviceDown } = resolveErrorNotice(error)
      notifyError(text, serviceDown ? SERVICE_DOWN_WINDOW_MS : DUPLICATE_WINDOW_MS)
    }
    return Promise.reject(error)
  }
)

export default request

/**
 * 后端统一响应信封。
 * 注意：响应拦截器返回的是整个信封而非 data，
 * 所以 request.get<T>() 的实际结果是 ApiResult<T>，需要用 unwrap 取值。
 */
export interface ApiResult<T = any> {
  code: number
  message: string
  data: T
}

/** 从响应信封中取业务数据，兼容个别已被上游解包的返回。 */
export const unwrap = <T,>(response: any, fallback: T): T =>
  (response?.data ?? response ?? fallback) as T

/**
 * 从任意错误里取面向用户的文案。
 * 优先后端返回的 message（本身就是写给用户看的），
 * axios 自带的英文技术信息（"Request failed with status code 502" 等）一律丢弃，用兜底文案代替。
 */
export function errorText(error: unknown, fallback: string): string {
  const dataMessage = (error as AxiosError<any>)?.response?.data?.message
  if (typeof dataMessage === 'string' && dataMessage.trim()) return dataMessage

  if (error instanceof Error && !(error as AxiosError).isAxiosError) {
    const text = error.message?.trim()
    if (text) return text
  }
  return fallback
}

/**
 * 这个错误是「本地逻辑失败」还是「请求失败」。
 *
 * 非 silent 的请求失败一律由响应拦截器弹提示，页面在 catch 里再弹就是一次失败两条提示。
 * 但页面自己 `throw new Error(...)` 的分支（例如拿不到 requestId）**不经过拦截器**，
 * 必须由页面负责提示，否则用户什么都看不到 —— 这正是历史上被静默吞掉的那一类。
 *
 * 判定依据：业务码失败是带 `bizCode` 的 Error，网络失败是带 `isAxiosError` 的 AxiosError，
 * 两者都不带才当成本地失败。
 */
export function isLocalFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return true
  const candidate = error as { bizCode?: unknown; isAxiosError?: unknown; response?: unknown }
  if (candidate.isAxiosError) return false
  if (candidate.bizCode !== undefined) return false
  if (candidate.response !== undefined) return false
  return true
}

// 导出常用请求方法
export const get = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return request.get(url, config)
}

export const post = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return request.post(url, data, config)
}

export const put = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return request.put(url, data, config)
}

export const del = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return request.delete(url, config)
}

export const patch = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return request.patch(url, data, config)
}
