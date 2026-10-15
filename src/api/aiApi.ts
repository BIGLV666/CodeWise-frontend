import request from './request'

export type AiRole = 'USER' | 'ASSISTANT' | 'SYSTEM'

export interface AiConversation {
  conversationId: string | number
  questionId: string | number
  userId: string
  conversationName?: string
}

export interface AiMessage {
  messageId: string | number
  conversationId: string | number
  content: string
  userId?: string
  currentCode?: string
  role: AiRole
  createTime?: string
}

export interface AiMessageCursorPage {
  items: AiMessage[]
  nextCursor?: string | number | null
  hasMore: boolean
}

export interface AiAdvicePush {
  eventId?: string
  messageId: string | number
  conversationId: string | number
  submitId?: string | number
  questionId: string
  judgeStatus?: string
  aiResponse: string
}

export interface RealtimeAnalysisChange {
  rangeOffset: number
  rangeLength: number
  text: string
  version: number
  createTime: string
}

export interface RealtimeAnalysisTask {
  rootId?: string
  userId: string
  questionId: number
  code: string
  changes: RealtimeAnalysisChange[]
}

export interface RealtimeAnalysisPush {
  advice: string
  questionId: string | number
  type: 'AITASKADVICE'
}

export interface UserAiConfigSummary {
  userConfigId: number
  groupName: string
  modelNames: string[]
}

export interface UserAiConfigDetail {
  userAiConfigId: number
  groupName: string
  modelNames: string[]
  aiUrl: string
  apiKey?: string
  createTime?: string
  updateTime?: string
}

export interface UserAiConfigPayload {
  groupName: string
  modelNames: string[]
  aiUrl: string
  apiKey?: string
}

const aiApi = {
  listConversations() {
    return request.get<AiConversation[]>('/ai/advice')
  },

  getMessages(conversationId: string, params?: { cursor?: string | null; size?: number }) {
    return request.get<AiMessageCursorPage>(`/ai/advice/${conversationId}/messages`, { params })
  },

  reportRealtimeAnalysis(payload: RealtimeAnalysisTask) {
    return request.post<string>('/ai/advice/task', payload)
  },

  getRealtimeAdvices(questionId: string | number) {
    return request.get<unknown[]>('/ai/advice/task', { params: { questionId } })
  },

  async askStream(
    payload: {
      conversationId: string
      question: string
      code: string
      userAiConfigId?: number
      modelName?: string
    },
    handlers: { onChunk: (chunk: string) => void },
  ): Promise<AiMessage | null> {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/ai/advice/ask', {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    if (!response.ok || !response.body) {
      throw new Error(`AI 请求失败 (${response.status})`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let eventName = 'message'
    let dataLines: string[] = []
    let answer: AiMessage | null = null

    const dispatch = () => {
      if (!dataLines.length) return
      const data = dataLines.join('\n')
      dataLines = []

      if (eventName === 'chunk') {
        handlers.onChunk(parseSseString(data))
      } else if (eventName === 'answer') {
        answer = JSON.parse(data) as AiMessage
      } else if (eventName === 'error') {
        throw new Error(parseSseString(data) || 'AI 生成失败')
      }
      eventName = 'message'
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line) {
            dispatch()
          } else if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
          }
        }

        if (done) break
      }
      if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).trimStart())
      dispatch()
      return answer
    } finally {
      reader.releaseLock()
    }
  },

  listConfigs() {
    return request.get<UserAiConfigSummary[]>('/ai/configs')
  },

  getConfig(configId: number) {
    return request.get<UserAiConfigDetail>(`/ai/configs/${configId}`)
  },

  createConfig(payload: UserAiConfigPayload) {
    return request.post<UserAiConfigDetail>('/ai/configs', payload)
  },

  updateConfig(configId: number, payload: UserAiConfigPayload) {
    return request.put<UserAiConfigDetail>(`/ai/configs/${configId}`, payload)
  },

  deleteConfig(configId: number) {
    return request.delete<void>(`/ai/configs/${configId}`)
  },

  fetchModels(payload: { baseUrl: string; apiKey: string }) {
    return request.post<string[]>('/ai/configs/models', payload, { timeout: 25_000 })
  },

  /**
   * 平台当前可选的模型名（去重、已排序），用于模型选择器里的「平台模型」一节。
   *
   * 与 {@link fetchModels} 不是一回事：那个是拿用户填的地址去探它有哪些模型，
   * 这个是平台自己能提供什么。服务商信息不下发——用户看到的是"用哪个模型"。
   *
   * silent：拿不到（未配置端点 → 后端没有该路由，或某次抖动）就整节隐藏，
   * 不该因为一个可选的目录接口给用户弹错误提示。
   */
  listPlatformModels() {
    return request.get<string[]>('/ai/models', { silent: true })
  },
}

function parseSseString(value: string) {
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : value
  } catch {
    return value
  }
}

export default aiApi
