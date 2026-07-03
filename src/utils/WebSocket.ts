// src/utils/websocket.ts
import { Client } from '@stomp/stompjs'

class WebSocketService {
  private client: Client | null = null
  private listeners: Map<string, Function[]> = new Map()

  connect(url: string, token: string) {
    const userId = localStorage.getItem('userId')
    const queueName = `/queue/judge-result-${userId}`
    
    console.log('🔌 WebSocket 连接中...')
    console.log('📡 订阅队列:', queueName)

    this.client = new Client({
      brokerURL: url,
      connectHeaders: {
        'Authorization': `Bearer ${token}`
      },
      debug: (str) => console.log('📡', str),  // ✅ 临时开启 debug
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })

    this.client.onConnect = () => {
      console.log('✅ WebSocket 连接成功')
      
      // ✅ 订阅
      this.client?.subscribe(queueName, (message) => {
        console.log('📩📩📩 收到消息！')
        console.log('📩 消息体:', message.body)
        try {
          const data = JSON.parse(message.body)
          console.log('📩 解析后:', data)
          this.emit('judge-result', data)
        } catch (e) {
          console.error('解析消息失败:', e)
        }
      })
    }

    this.client.onStompError = (frame) => {
      console.error('❌ STOMP 错误:', frame)
    }

    this.client.onWebSocketError = (error) => {
      console.error('❌ WebSocket 错误:', error)
    }

    this.client.activate()
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  private emit(event: string, data: any) {
    console.log('📤 emit 触发:', event, data)  // ✅ 加日志
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(cb => cb(data))
    } else {
      console.warn('⚠️ 没有监听器 for event:', event)
    }
  }

  disconnect() {
    if (this.client) {
      this.client.deactivate()
      this.client = null
    }
  }

  isConnected(): boolean {
    return this.client?.connected || false
  }
}

export default new WebSocketService()