import request from './request'

export interface ContainerPoolStatus {
  language: string
  total: number
  idle: number
  busy: number
  waiting: number
  configuredCapacity: number
  idleContainerIds: string[]
  busyContainerIds: string[]
}

const adminContainerApi = {
  /**
   * silent：后台每 8s 自动刷新时不能因为一次抖动就弹全局提示。
   * 手动刷新与首次加载仍需要用户可见的错误反馈，所以由调用方决定，
   * 这里只透传配置。
   */
  getPools(options?: { silent?: boolean }) {
    return request.get<ContainerPoolStatus[]>('/judge/containers', options)
  },

  addContainer(language: string) {
    return request.post<void>(`/judge/containers/${encodeURIComponent(language)}`)
  },

  removeContainer(language: string, containerId: string) {
    return request.delete<void>(
      `/judge/containers/${encodeURIComponent(language)}/${encodeURIComponent(containerId)}`,
    )
  },
}

export default adminContainerApi
