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
  getPools() {
    return request.get<ContainerPoolStatus[]>('/judge/containers')
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
