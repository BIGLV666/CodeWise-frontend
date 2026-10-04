import request from './request'

export interface CommunityPostPayload {
  postTitle: string
  postContent: string
  tags: string[]
  userId?: string
  userName?: string
}

export interface CommunityCommentPayload {
  comment: string
  postId: string
  rootCommentId?: string | number
  replyUserId?: string | number
  replyUserName?: string
  type?: 'POST' | 'SOLUTION'
}

export interface SolutionPayload {
  questionId: number
  solutionTitle: string
  solutionContent: string
  tags: string[]
}

export type MyContentType = 'POST' | 'SOLUTION' | 'COMMENT'

export interface MyContentItem {
  targetId: string
  type: MyContentType
  title?: string | null
  content?: string
  status: number
  tags?: string[]
  rootId?: string | null
  rootType?: 'POST' | 'SOLUTION' | null
  questionId?: string | null
  createTime?: string
  updateTime?: string
  rejectReason?: string | null
  checkReason?: string | null
}

export interface MyContentCursorPage {
  records: MyContentItem[]
  list?: MyContentItem[]
  nextCursor?: string | null
  hasNext: boolean
  hasMore?: boolean
}

const communityApi = {
  listMyContent(params: {
    type: MyContentType
    pageSize: number
    lastId?: string | number | null
  }) {
    return request.get<MyContentCursorPage>('/community/mine', { params })
  },

  getRequestId() {
    return request.get<string>('/community/request-id')
  },

  listPosts(params: { pageSize: number; lastId?: string | number | null }) {
    return request.get('/community/posts', { params })
  },

  hotPosts() {
    return request.get('/community/posts/hot')
  },

  searchPosts(params: { keyword: string; limit?: number }) {
    return request.get('/community/posts/search', { params })
  },

  postsByTag(params: { tag: string; limit?: number }) {
    return request.get('/community/posts/tag', { params })
  },

  createPost(data: CommunityPostPayload, requestId: string) {
    return request.post('/community/posts', data, { params: { requestId } })
  },

  getPost(postId: string | number) {
    return request.get(`/community/posts/${postId}`)
  },

  updatePost(postId: string | number, data: CommunityPostPayload) {
    return request.put(`/community/posts/${postId}`, data)
  },

  deletePost(postId: string | number) {
    return request.delete(`/community/posts/${postId}`)
  },

  listComments(params: {
    postId: string | number
    type?: 'POST' | 'SOLUTION'
    rootCommentId?: string | number
    pageSize: number
    lastId?: string | number | null
  }) {
    return request.get('/community/comments', { params })
  },

  createComment(data: CommunityCommentPayload, requestId: string) {
    return request.post('/community/comments', data, { params: { requestId } })
  },

  deleteComment(commentId: string | number) {
    return request.delete(`/community/comments/${commentId}`)
  },

  togglePostLike(postId: string | number) {
    return request.put<boolean>(`/community/likes/posts/${postId}`)
  },

  toggleCommentLike(commentId: string | number) {
    return request.put<boolean>(`/community/likes/comments/${commentId}`)
  },

  toggleSolutionLike(solutionId: string | number) {
    return request.put<boolean>(`/community/likes/solution/${solutionId}`)
  },

  listSolutions(params: { questionId: string | number; pageSize: number; lastId?: string | number | null }) {
    return request.get('/community/solutions', { params })
  },

  getSolution(solutionId: string | number) {
    return request.get(`/community/solutions/${solutionId}`)
  },

  createSolution(data: SolutionPayload, requestId: string) {
    return request.post('/community/solutions', data, { params: { requestId } })
  },

  updateSolution(solutionId: string | number, data: SolutionPayload) {
    return request.put(`/community/solutions/${solutionId}`, data)
  },

  deleteSolution(solutionId: string | number) {
    return request.delete(`/community/solutions/${solutionId}`)
  },
}

export default communityApi
