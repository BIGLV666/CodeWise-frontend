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
}

const communityApi = {
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
}

export default communityApi
