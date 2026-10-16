// src/stores/user.ts
import { defineStore } from 'pinia'
import type userDto  from '@/types/UserDto'
import { logWarn } from '@/utils/logger'

/** 管理员角色：0 为 root，2 为管理员。仅用于前端访问引导。 */
export const ADMIN_ROLE_ID = 2
export function isAdminRole(roleId: unknown): boolean {
  if (typeof roleId !== 'number' && typeof roleId !== 'string') return false
  if (typeof roleId === 'string' && !roleId.trim()) return false
  return Number(roleId) === 0 || Number(roleId) === ADMIN_ROLE_ID
}

function readStoredRoleId(): number | undefined {
  const raw = localStorage.getItem('roleId')
  if (raw === null || raw === '') return undefined
  const parsed = Number(raw)
  return Number.isNaN(parsed) ? undefined : parsed
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userDto: {
      userId: localStorage.getItem('userId') || '',
      userName: localStorage.getItem('userName') || '',
      avatarUrl: localStorage.getItem('avatarUrl') || '',
      roleId: readStoredRoleId(),
    } as userDto | null,
  }),
  
  getters: {
    isLoggedIn: (state) => !!state.token,
    getUserId: (state) => state.userDto?.userId,
    getUsername: (state) => state.userDto?.userName,
    getAvatarUrl: (state) => state.userDto?.avatarUrl,
    getRoleId: (state) => state.userDto?.roleId,
    /**
     * 是否管理员。仅用于界面展示，真正的权限校验在后端 @RequireAdmin。
     * roleId 尚未加载时返回 false。
     */
    isAdmin: (state) => isAdminRole(state.userDto?.roleId),
  },
  
  actions: {
    setLoginData(data: { token: string; userDto: userDto }) {
      this.token = data.token
      this.userDto = data.userDto
      localStorage.setItem('token', data.token)
      localStorage.setItem('userId', String(data.userDto.userId))
      localStorage.setItem('userName', data.userDto.userName || '')
      if (data.userDto.avatarUrl) {
        localStorage.setItem('avatarUrl', data.userDto.avatarUrl)
      } else {
        localStorage.removeItem('avatarUrl')
      }
      if (data.userDto.roleId !== undefined && data.userDto.roleId !== null) {
        localStorage.setItem('roleId', String(data.userDto.roleId))
      } else {
        localStorage.removeItem('roleId')
      }
    },
    
    logout() {
      this.token = ''
      this.userDto = null
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('userName')
      localStorage.removeItem('avatarUrl')
      localStorage.removeItem('roleId')
    },

    /**
     * 用户主动退出登录。
     *
     * 顺序很重要：**先**通知后端拉黑 token，**再**清本地状态 ——
     * 请求拦截器要从 store 里取 token 放进 Authorization 头，反过来就没凭证了。
     *
     * 后端调用失败不阻断登出：本地凭证照清、页面照跳登录页。
     * 让用户因为一次网络抖动被困在「点了退出却还在登录态」里，比留下一个
     * 未拉黑的 token 更糟；失败只记开发期日志，不弹提示（用户无法处理）。
     *
     * 只用于用户主动退出。401 失效与账号冻结/注销不调这个：
     * 前者的 token 本已无效，后者不是登出（账号状态变更），
     * 此时再发一次登出请求失败只会多弹一条无意义的错误提示。
     */
    async logoutWithServer() {
      if (this.token) {
        try {
          const { default: userApi } = await import('@/api/userApi')
          await userApi.logout()
        } catch (error) {
          logWarn('通知后端登出失败，仅清理本地登录态:', error)
        }
      }
      this.logout()
      // 与改动前的退出行为保持一致：清掉本机残留（草稿、界面偏好等），
      // 避免换人登录后看到上一位用户的内容。
      localStorage.clear()
    },

    updateUser(data: Partial<userDto>) {
      if (this.userDto) {
        Object.assign(this.userDto, data)
      }
      if (data.userName !== undefined) {
        localStorage.setItem('userName', data.userName || '')
      }
      if (data.avatarUrl !== undefined) {
        if (data.avatarUrl) {
          localStorage.setItem('avatarUrl', data.avatarUrl)
        } else {
          localStorage.removeItem('avatarUrl')
        }
      }
      if (data.roleId !== undefined) {
        localStorage.setItem('roleId', String(data.roleId))
      }
    },

    /**
     * 确保 roleId 已就绪。
     * 刷新页面后若本地没有缓存角色，则回源查询当前用户一次。
     */
    async ensureRoleId() {
      if (!this.token) return undefined
      if (this.userDto?.roleId !== undefined && this.userDto?.roleId !== null) {
        return this.userDto.roleId
      }
      try {
        const { default: userApi } = await import('@/api/userApi')
        const response: any = await userApi.getCurrentUser()
        const user = response?.data ?? response
        if (user?.roleId !== undefined) {
          this.updateUser({ roleId: Number(user.roleId) })
          return Number(user.roleId)
        }
      } catch (error) {
        logWarn('获取用户角色失败:', error)
      }
      return undefined
    },
  },
})
