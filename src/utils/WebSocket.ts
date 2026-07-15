import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'

type Listener = (data: any) => void

interface RequestedSubscription {
  destination: string
}

class WebSocketService {
  private client: Client | null = null
  private connectionKey = ''
  private listeners = new Map<string, Set<Listener>>()
  private requestedSubscriptions = new Map<string, RequestedSubscription>()
  private subscriptions = new Map<string, StompSubscription>()

  async connect(url: string, token: string) {
    const connectionKey = `${url}|${token}`
    if (this.client?.active && this.connectionKey === connectionKey) return

    await this.disconnect(false)

    const client = new Client({
      brokerURL: url,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: import.meta.env.DEV ? (message) => console.debug('STOMP:', message) : () => undefined,
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })

    this.client = client
    this.connectionKey = connectionKey

    client.onConnect = () => {
      if (this.client !== client) return
      this.requestedSubscriptions.forEach((_, event) => this.activateSubscription(event))
    }

    client.onStompError = (frame) => {
      console.error('STOMP 连接错误:', frame.headers.message || frame.body)
    }

    client.onWebSocketError = (error) => {
      console.error('WebSocket 连接错误:', error)
    }

    client.onWebSocketClose = () => {
      if (this.client === client) this.subscriptions.clear()
    }

    client.activate()
  }

  subscribe(event: string, destination: string) {
    const current = this.requestedSubscriptions.get(event)
    if (current?.destination === destination && this.subscriptions.has(event)) return

    this.requestedSubscriptions.set(event, { destination })
    if (this.client?.connected) this.activateSubscription(event)
  }

  unsubscribe(event: string) {
    this.requestedSubscriptions.delete(event)
    this.unsubscribeActive(event)
  }

  on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
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

  async disconnect(clearRequestedSubscriptions = true) {
    this.subscriptions.forEach((_, event) => this.unsubscribeActive(event))
    this.subscriptions.clear()
    if (clearRequestedSubscriptions) this.requestedSubscriptions.clear()

    const client = this.client
    this.client = null
    this.connectionKey = ''
    if (client?.active) await client.deactivate()
  }

  isConnected() {
    return Boolean(this.client?.connected)
  }

  private activateSubscription(event: string) {
    const requested = this.requestedSubscriptions.get(event)
    if (!requested || !this.client?.connected) return

    this.unsubscribeActive(event)
    const subscription = this.client.subscribe(requested.destination, (message) => {
      this.parseAndEmit(event, message)
    })
    this.subscriptions.set(event, subscription)
  }

  private unsubscribeActive(event: string) {
    const subscription = this.subscriptions.get(event)
    this.subscriptions.delete(event)
    if (!subscription) return

    try {
      subscription.unsubscribe()
    } catch {
      // A closed STOMP connection has already discarded its server subscription.
    }
  }

  private parseAndEmit(event: string, message: IMessage) {
    try {
      this.emit(event, JSON.parse(message.body))
    } catch (error) {
      console.error(`WebSocket 消息解析失败 (${event}):`, error)
    }
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((callback) => callback(data))
  }
}

export default new WebSocketService()
