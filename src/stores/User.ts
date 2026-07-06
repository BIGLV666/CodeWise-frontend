// src/stores/user.ts
import { defineStore } from 'pinia'
import type userDto  from '@/types/UserDto'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userDto: null as userDto | null,
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
      localStorage.setItem('userName',data.userDto.userName)
    },
    
    logout() {
      this.token = ''
      this.userDto = null
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('userName')
    },
    
    updateUser(data: Partial<userDto>) {
      if (this.userDto) {
        Object.assign(this.userDto, data)
      }
    },
  },
})
