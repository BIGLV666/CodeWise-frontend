import axios, { type AxiosError } from 'axios'

export interface AgentCallPayload {
  user_config_id: number
  question: string
  conversation_id: number
  model_name?: string
}

export interface AgentCallResult {
  conversation_id: number
  content: string
}

/** 一次工具调用开始（dsh tool/call 会话事件）。 */
export interface AgentToolCallEvent {
  callId: string
  name: string
  argsText: string
}

/** 一次工具调用结束（dsh tool/result 会话事件）。 */
export interface AgentToolResultEvent {
  callId: string
  isError: boolean
  /** 工具输出的首段文本预览（可能被 dsh 截断），用于展开卡片的 OUT 区。 */
  preview: string
}

/**
 * SSE 流处理器。
 *
 * 事件契约与 dsh 会话事件词汇对齐（透传）：
 * - `session.event`：`{conversation_id, event: {type, data}}`，前端按 type 渲染；
 * - `done`：`{conversation_id, finish_reason, content}`，content 为最终回答全文；
 * - `error`：`{conversation_id, message}`。
 */
interface AgentStreamHandlers {
  /** 回答文本增量（dsh assistant/chunk 的 text-delta）。 */
  onTextDelta: (text: string) => void
  onToolCall?: (event: AgentToolCallEvent) => void
  onToolResult?: (event: AgentToolResultEvent) => void
  /** 轮次级状态提示（turn/start 等）。 */
  onStatus?: (message: string) => void
}

export interface AgentStreamResult {
  content: string
  finishReason: string | null
}

export interface AgentConversation {
  agent_conversation_id: number
  user_id: string
  agent_conversation_name: string
  create_time?: string
  update_time?: string
}

export interface AgentMessage {
  agent_message_id: number
  agent_conversation_id: number
  user_id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  create_time?: string
  update_time?: string
}

interface AgentResponse<T> {
  code: number
  message: string
  data: T
}

const agentRequest = axios.create({
  baseURL: import.meta.env.VITE_AGENT_BASE_URL || 'http://localhost:8000',
  timeout: 120_000,
})
const agentBaseUrl = import.meta.env.VITE_AGENT_BASE_URL || 'http://localhost:8000'

agentRequest.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

agentRequest.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    const detail = error.response?.data?.detail
    return Promise.reject(new Error(detail || (error.code === 'ECONNABORTED' ? 'Agent 响应超时' : 'Agent 服务连接失败')))
  },
)

const agentApi = {
  async listConversations() {
    const response = await agentRequest.get<AgentResponse<AgentConversation[]>>('/api/agent/agent_conversation')
    return unwrapResponse(response.data)
  },

  async createConversation() {
    const response = await agentRequest.post<AgentResponse<AgentConversation>>('/api/agent/conversation')
    return unwrapResponse(response.data)
  },

  async renameConversation(conversationId: number, newName: string) {
    const response = await agentRequest.put<AgentResponse<void>>(
      `/api/agent/conversation/${conversationId}/name`,
      null,
      { params: { new_name: newName } },
    )
    return response.data
  },

  async deleteConversation(conversationId: number) {
    const response = await agentRequest.delete<AgentResponse<void>>(`/api/agent/conversation/${conversationId}`)
    return response.data
  },

  async getMessages(conversationId: number) {
    const response = await agentRequest.get<AgentResponse<AgentMessage[]>>(`/api/agent/messages/${conversationId}`)
    return unwrapResponse(response.data)
  },

  async call(payload: AgentCallPayload) {
    const response = await agentRequest.post<AgentResponse<AgentCallResult>>('/api/agent/call', payload)
    if (response.data.code !== 200) throw new Error(response.data.message || 'Agent 调用失败')
    return response.data.data
  },

  async stream(
    payload: AgentCallPayload,
    handlers: AgentStreamHandlers,
  ): Promise<AgentStreamResult> {
    const token = localStorage.getItem('token')
    const response = await fetch(`${agentBaseUrl}/api/agent/stream`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok || !response.body) {
      let message = `Agent 调用失败 (${response.status})`
      try {
        const error = await response.json()
        message = error.detail || message
      } catch {
        // Keep the status-based message when the response is not JSON.
      }
      throw new Error(message)
    }

    let final: AgentStreamResult = { content: '', finishReason: null }

    const handleSessionEvent = (event: any) => {
      // dsh 会话事件形状：{type, data: {...}}，业务字段都在 data 下。
      const type: string = event?.type || ''
      if (type === 'assistant/chunk') {
        const chunk = event?.data?.chunk
        if (chunk?.type === 'text-delta' && typeof chunk.text === 'string' && chunk.text) {
          handlers.onTextDelta(chunk.text)
        }
        return
      }
      if (type === 'tool/call') {
        handlers.onToolCall?.({
          callId: String(event?.data?.callId || ''),
          name: String(event?.data?.name || 'unknown_tool'),
          argsText:
            typeof event?.data?.arguments === 'string'
              ? event.data.arguments
              : JSON.stringify(event?.data?.arguments ?? {}),
        })
        return
      }
      if (type === 'tool/result') {
        // dsh tool/result 数据形状：message.content[0] 为 tool-result 块，
        // callId 同时出现在 message.source.callId 与块的 toolCallId。
        const message = event?.data?.message || {}
        const blocks = Array.isArray(message.content) ? message.content : []
        const first = blocks[0] || {}
        const resultBlocks = Array.isArray(first?.content) ? first.content : []
        const preview = resultBlocks
          .filter((block: any) => typeof block?.text === 'string')
          .map((block: any) => block.text)
          .join('\n')
        handlers.onToolResult?.({
          callId: String(message?.source?.callId || first?.toolCallId || ''),
          isError: Boolean(first?.isError),
          preview,
        })
        return
      }
      if (type === 'turn/start') handlers.onStatus?.('正在思考')
      // 其余事件（step/*、agent/inbox/*、session/title 等）前端暂不渲染。
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let eventName = 'message'
    let dataLines: string[] = []

    const dispatch = () => {
      if (!dataLines.length) return
      const raw = dataLines.join('\n')
      dataLines = []
      const data = JSON.parse(raw)
      if (eventName === 'session.event') handleSessionEvent(data.event)
      else if (eventName === 'done') final = { content: data.content || '', finishReason: data.finish_reason ?? null }
      else if (eventName === 'error') throw new Error(data.message || 'Agent 调用失败')
      eventName = 'message'
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line) dispatch()
          else if (line.startsWith('event:')) eventName = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
        }
        if (done) break
      }
      dispatch()
    } finally {
      reader.releaseLock()
    }
    return final
  },
}

function unwrapResponse<T>(response: AgentResponse<T>) {
  if (response.code !== 200) throw new Error(response.message || 'Agent 请求失败')
  return response.data
}

export default agentApi
