import request, { unwrap } from './request'
import type UserDto from '@/types/UserDto'

/** 被审核内容的类型，与后端 PostType 枚举一致。 */
export type ModerationTargetType = 'POST' | 'COMMENT' | 'SOLUTION'

/** 内容状态：0-待审核 1-正常 2-下架。 */
export const CONTENT_STATUS = {
  PENDING: 0,
  NORMAL: 1,
  TAKE_DOWN: 2,
  // 兼容旧详情页使用的状态名称。
  APPROVED: 1,
  REJECTED: 2,
  REMOVED: 2,
} as const

/** 审核台内容详情，帖子/评论/题解共用一个结构。 */
export interface CheckDetail {
  targetId: string
  type: ModerationTargetType
  title: string | null
  content: string
  userId: string | null
  userName?: string | null
  userDto: UserDto | null
  status: number
  tags: string[] | null
  /** 评论所属的帖子或题解 ID。 */
  postId: string | null
  rootCommentId: string | null
  /** 题解所属题目 ID。 */
  questionId: string | null
  likeCount: number
  commentCount: number
  createTime: string
  updateTime: string
}

/** 后端 ID 游标分页结构（实际返回）。 */
export interface CursorPage<T> {
  list: T[]
  records: T[]
  hasMore: boolean
  hasNext: boolean
  nextCursor: string | number | null
  total: number
}

/** 待审核帖子列表项，字段来自 HomePostVo。 */
export interface PendingPost {
  postId: string
  postTitle: string
  postContent?: string
  userId: string
  userName?: string
  avatarUrl?: string
  tags?: string[]
  status?: number
  likeCount?: number
  commentCount?: number
  createTime?: string
}

/** 待审核题解列表项，字段来自 HomeSolutionVo。 */
export interface PendingSolution {
  solutionId: string
  solutionTitle: string
  solutionContent?: string
  questionId?: string
  userId?: string
  solutionUserId?: string
  userName?: string
  avatarUrl?: string
  status?: number
  likeCount?: number
  createTime?: string
}

/** 已发布评论列表项，字段来自 CommentVo。 */
export interface PendingComment {
  commentId: string
  comment: string
  postId?: string
  rootCommentId?: string
  userId?: string
  userName?: string
  avatarUrl?: string
  status?: number
  likeCount?: number
  createTime?: string
}

interface CursorParams {
  lastId?: string | number | null
  pageSize?: number
}


function normalizePage<T>(response: unknown): CursorPage<T> {
  const page = unwrap<any>(response, {})
  const records = Array.isArray(page.records) ? page.records : (Array.isArray(page.list) ? page.list : [])
  return {
    list: records,
    records,
    hasMore: Boolean(page.hasNext ?? page.hasMore),
    hasNext: Boolean(page.hasNext ?? page.hasMore),
    nextCursor: page.nextCursor ?? null,
    total: Number(page.total ?? records.length),
  }
}

async function getPage<T>(url: string, params: object) {
  return normalizePage<T>(await request.get(url, { params }))
}

async function getDetail(url: string, params: object) {
  return unwrap<CheckDetail | null>(await request.get(url, { params }), null)
}

const adminModerationApi = {
  // ============ 帖子 ============

  listPendingPosts(params: CursorParams) {
    return getPage<PendingPost>('/community/check/post/list', params)
  },

  getPostDetail(postId: string | number) {
    return getDetail('/community/check/post/detail', { postId })
  },

  /** 审核待审核帖子：status 1-通过 2-拒绝。 */
  checkPost(postId: string | number, status: number, reason?: string) {
    return request.post('/community/check/post', null, { params: { postId, status, reason } })
  },

  /** 通过帖子审核 */
  approvePost(postId: string | number) {
    return request.post('/community/check/post', null, { params: { postId, status: 1 } })
  },

  /** 拒绝帖子审核 */
  rejectPost(postId: string | number, reason: string) {
    return request.post('/community/check/post', null, { params: { postId, status: 2, reason } })
  },

  /** 对已发布帖子下架或恢复：status 2-下架 1-恢复。 */
  updatePostStatus(postId: string | number, status: number, reason?: string) {
    return request.post('/community/check/post/status', null, { params: { postId, status, reason } })
  },

  // ============ 题解 ============

  listPendingSolutions(params: CursorParams) {
    return getPage<PendingSolution>('/community/check/solution/list', params)
  },

  getSolutionDetail(solutionId: string | number) {
    return getDetail('/community/check/solution/detail', { solutionId })
  },

  /** 审核待审核题解：status 1-通过 2-拒绝。 */
  checkSolution(solutionId: string | number, status: number, reason?: string) {
    return request.post('/community/check/solution', null, { params: { solutionId, status, reason } })
  },

  /** 通过题解审核 */
  approveSolution(solutionId: string | number) {
    return request.post('/community/check/solution', null, { params: { solutionId, status: 1 } })
  },

  /** 拒绝题解审核 */
  rejectSolution(solutionId: string | number, reason: string) {
    return request.post('/community/check/solution', null, { params: { solutionId, status: 2, reason } })
  },

  /** 对已发布题解下架或恢复：status 2-下架 1-恢复。 */
  updateSolutionStatus(solutionId: string | number, status: number, reason?: string) {
    return request.post('/community/check/solution/status', null, {
      params: { solutionId, status, reason },
    })
  },

  // ============ 评论 ============

  /**
   * 评论采用即时发布，没有待审核态，
   * 这里列出的是已发布评论，供管理员下架违规内容。
   */
  listComments(params: CursorParams & { rootCommentId?: string | number | null; type?: ModerationTargetType }) {
    return getPage<PendingComment>('/community/check/comment/list', params)
  },

  getCommentDetail(commentId: string | number) {
    return getDetail('/community/check/comment/detail', { commentId })
  },

  /** 对评论下架或恢复：status 2-下架 1-恢复。 */
  updateCommentStatus(commentId: string | number, status: number, reason?: string) {
    return request.post('/community/check/comment/status', null, { params: { commentId, status, reason } })
  },

  // ============ 通用 ============

  getDetail(type: ModerationTargetType, targetId: string | number) {
    return getDetail('/community/check/detail', { type, targetId })
  },
}

export default adminModerationApi
