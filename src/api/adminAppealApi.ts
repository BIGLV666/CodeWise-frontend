import request, { unwrap } from './request'

/** 申诉状态：0-待处理 1-已拒绝 2-已通过 */
export const APPEAL_STATUS = {
  PENDING: 0,
  REJECTED: 1,
  APPROVED: 2,
} as const

/** 内容类型，与社区服务的 PostType 枚举一致。 */
export type AppealRootType = 'POST' | 'COMMENT' | 'SOLUTION'

/** 管理端使用的申诉列表项。 */
export interface AppealItem {
  appealId: number
  userId: string
  userName?: string
  rootType: AppealRootType
  rootId: string
  rootCommentId?: string
  questionId?: string
  title?: string | null
  reason: string
  takeDownReason?: string | null
  adminReason?: string
  handlerId?: string
  handledAt?: string
  status: number
  createTime: string
  updateTime?: string
}

/** 社区服务实际返回的游标分页结构。 */
interface BackendAppealItem {
  appealId: number
  postId: number
  postType: AppealRootType
  title?: string | null
  reason: string
  takeDownReason?: string | null
  status: number
  user?: { userId?: string; userName?: string } | null
  createTime: string
  updateTime?: string
}

interface BackendCursorPage<T> {
  records: T[]
  nextCursor: number | null
  hasNext: boolean
  total: number
}

export interface CursorPage<T> {
  list: T[]
  hasMore: boolean
  total: number
}

interface ListAppealsParams {
  lastId?: string | number | null
  pageSize?: number
  status?: number | null
}

interface HandleAppealParams {
  appealId: string | number
  pass: boolean
  adminReason?: string
}

function mapBackendAppeal(item: BackendAppealItem): AppealItem {
  return {
    appealId: item.appealId,
    userId: item.user?.userId ?? '',
    userName: item.user?.userName,
    rootType: item.postType,
    rootId: String(item.postId),
    title: item.title,
    reason: item.reason,
    takeDownReason: item.takeDownReason,
    status: item.status,
    createTime: item.createTime,
    updateTime: item.updateTime,
  }
}

function normalizeAppealPage(response: unknown): CursorPage<AppealItem> {
  const page = unwrap<BackendCursorPage<BackendAppealItem>>(response, {
    records: [],
    nextCursor: null,
    hasNext: false,
    total: 0,
  })

  return {
    list: (page.records ?? []).map(mapBackendAppeal),
    hasMore: Boolean(page.hasNext),
    total: page.total ?? 0,
  }
}

const adminAppealApi = {
  /** 获取申诉列表（管理员） */
  async listAppeals(params: ListAppealsParams): Promise<CursorPage<AppealItem>> {
    const response = await request.get('/community/appeal-admin/list', { params })
    return normalizeAppealPage(response)
  },

  /** 处理申诉（管理员） */
  handleAppeal(data: HandleAppealParams) {
    return request.post('/community/appeal-admin/handle', null, { params: data })
  },

  /** 查看我的申诉历史（用户，游标分页，后端按登录身份过滤） */
  async myAppeals(params: { lastId?: string | number | null; pageSize?: number }): Promise<CursorPage<AppealItem>> {
    const response = await request.get('/community/appeal/my', { params })
    return normalizeAppealPage(response)
  },

  /** 查看申诉详情（仅申诉发起人可查看） */
  async getAppealDetail(appealId: string | number): Promise<AppealItem> {
    const response = await request.get(`/community/appeal/${encodeURIComponent(String(appealId))}`)
    const item = unwrap<BackendAppealItem>(response, null as unknown as BackendAppealItem)
    if (!item || item.appealId === undefined) {
      throw new Error('申诉详情为空')
    }
    return mapBackendAppeal(item)
  },
}

export default adminAppealApi
