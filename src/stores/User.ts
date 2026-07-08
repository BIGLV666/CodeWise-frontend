// src/stores/user.ts
import { defineStore } from 'pinia'
import type userDto  from '@/types/UserDto'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userDto: {
      userId: localStorage.getItem('userId') || '',
      userName: localStorage.getItem('userName') || '',
      avatarUrl: localStorage.getItem('avatarUrl') || '',
    } as userDto | null,
  }),
  
  getters: {
    isLoggedIn: (state) => !!state.token,
    getUserId: (state) => state.userDto?.userId,
    getUsername: (state) => state.userDto?.userName,
    getAvatarUrl: (state) => state.userDto?.avatarUrl,
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
    },
    
    logout() {
      this.token = ''
      this.userDto = null
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('userName')
      localStorage.removeItem('avatarUrl')
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
    },
  },
})
