// src/utils/websocket.ts
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'

type Listener = (data: any) => void

class WebSocketService {
  private client: Client | null = null
  private listeners: Map<string, Set<Listener>> = new Map()
  private subscriptions: Map<string, StompSubscription> = new Map()

  connect(url: string, token: string) {
    const userId = localStorage.getItem('userId')
    const judgeQueue = `/queue/judge-result-${userId}`
    const debugQueue = `/queue/debug-judge-result-${userId}`

    if (this.client?.active) {
      return
    }

    console.log('WebSocket connecting...')
    console.log('Subscribe judge queue:', judgeQueue)
    console.log('Subscribe debug queue:', debugQueue)

    this.client = new Client({
      brokerURL: url,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (str) => console.log('STOMP:', str),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })

    this.client.onConnect = () => {
      console.log('WebSocket connected')
      this.subscribeOnce('judge-result', judgeQueue, (message) => {
        console.log('Received judge result:', message.body)
        this.parseAndEmit('judge-result', message)
      })
      this.subscribeOnce('debug-judge-result', debugQueue, (message) => {
        console.log('Received debug result:', message.body)
        this.parseAndEmit('debug-judge-result', message)
      })
    }

    this.client.onStompError = (frame) => {
      console.error('STOMP error:', frame)
    }

    this.client.onWebSocketError = (error) => {
      console.error('WebSocket error:', error)
    }

    this.client.activate()
  }

  on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    return () => this.off(event, callback)
  }

  off(event: string, callback: Listener) {
    this.listeners.get(event)?.delete(callback)
  }

  clearListeners(event?: string) {
    if (event) {
      this.listeners.delete(event)
      return
    }
    this.listeners.clear()
  }

  private subscribeOnce(key: string, destination: string, callback: (message: IMessage) => void) {
    this.subscriptions.get(key)?.unsubscribe()
    const subscription = this.client?.subscribe(destination, callback)
    if (subscription) {
      this.subscriptions.set(key, subscription)
    }
  }

  private parseAndEmit(event: string, message: IMessage) {
    try {
      this.emit(event, JSON.parse(message.body))
    } catch (error) {
      console.error('Failed to parse websocket message:', error)
    }
  }

  private emit(event: string, data: any) {
    console.log('emit:', event, data)
    const callbacks = this.listeners.get(event)
    if (!callbacks?.size) {
      console.warn('No listener for event:', event)
      return
    }
    callbacks.forEach((callback) => callback(data))
  }

  disconnect() {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe())
    this.subscriptions.clear()
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
