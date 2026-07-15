import request from './request'
import type { FavoriteCollection, FavoriteQuestionDto } from '@/types/FavoriteProblem'

export interface ReviewQuestionDto extends FavoriteQuestionDto {
  tags?: string
  totalSubmit?: number
  totalAc?: number
}

export interface ReviewRecord {
  reviewRecordId?: string
  userId?: string
  pendingReviewQuestionIds?: Array<string | number>
  completedReviewQuestionIds?: Array<string | number>
  acQuestionIds?: Array<string | number>
  reviewDays?: number
  reviewDate?: string
  createTime?: string
}

export interface ReviewRecordDetail extends ReviewRecord {
  allQuestionIds?: Array<string | number>
  allQuestionTitles?: Record<string, string>
}

export interface ReviewPlan {
  reviewId: string
  userId?: string
  questionId: string
  questionTitle?: string
  weight?: 0 | 1
  easinessFactor?: number | string
  repetitions?: number
  intervalDays?: number
  lastQuality?: number
  lastReviewTime?: string
  nextReviewTime?: string
  reviewCount?: number
  status?: 0 | 1 | 2
  createTime?: string
  updateTime?: string
}

export interface UpdateReviewPayload {
  status: 0 | 2
  weight: 0 | 1
  nextReviewData: string
}

export interface TodayReviewResponse {
  reviewRecord?: ReviewRecord
  questions?: ReviewQuestionDto[]
}

export interface ReviewConfig {
  reviewConfigId?: string
  userId?: string
  reviewCount?: number
  enableAutoReview?: number
  countCompileError?: number
  minEasinessFactor?: number
  initialEasinessFactor?: number
  masteredIntervalDays?: number
  createTime?: string
  updateTime?: string
}

export type ReviewConfigPayload = Partial<
  Pick<
    ReviewConfig,
    | 'reviewCount'
    | 'enableAutoReview'
    | 'countCompileError'
    | 'minEasinessFactor'
    | 'initialEasinessFactor'
    | 'masteredIntervalDays'
  >
>

export interface UpdateFavoritePayload {
  favoritesId: string
  favoritesName?: string
  favoritesContent?: string
  favoritesType?: string
  questionIds?: number[]
}

const reviewApi = {
  listFavorites() {
    return request.get<FavoriteCollection[]>('/review/favorites/list')
  },

  getFavoriteQuestions(favoriteId: string) {
    return request.get<FavoriteQuestionDto[]>('/review/favorites/questions', {
      params: { favoriteId },
    })
  },

  getCreateRequestId() {
    return request.get<string>('/review/favorites/requestId')
  },

  createFavorite(favoritesName: string, requestId: string) {
    return request.post<void>('/review/favorites', null, {
      params: { favoritesName, requestId },
    })
  },

  addQuestion(questionId: string, favoriteId: string) {
    return request.post<string>('/review/favorites/question', null, {
      params: { questionId, favoriteId },
    })
  },

  removeQuestion(questionId: string, favoriteId: string) {
    return request.delete<string>('/review/favorites/question', {
      params: { questionId, favoriteId },
    })
  },

  deleteFavorite(favoriteId: string) {
    return request.delete<string>('/review/favorites', {
      params: { favoriteId },
    })
  },

  updateFavorite(data: UpdateFavoritePayload) {
    return request.put<string>('/review/favorites', data)
  },
  addQuestionToReview(questionId: string) {
    return request.post<string>('/review/review/addquestiontoreview', null, {
      params: { questionId },
    })
  },

  getTodayReview() {
    return request.get<TodayReviewResponse | ReviewQuestionDto[]>('/review/review/today')
  },

  getReviewConfig() {
    return request.get<ReviewConfig>('/review/review/config')
  },

  updateReviewConfig(data: ReviewConfigPayload) {
    return request.put<ReviewConfig>('/review/review/config', data)
  },

  getAllReviewRecords() {
    return request.get<ReviewRecord[]>('/review/review/allrecord')
  },

  getReviewRecordDetail(reviewRecordId: string) {
    return request.get<ReviewRecordDetail>(`/review/review/record/${reviewRecordId}`, {
      params: { reviewRecordId },
    })
  },

  getAllReviewPlans() {
    return request.get<ReviewPlan[]>('/review/review/allreview')
  },

  updateReviewPlan(reviewId: string, data: UpdateReviewPayload) {
    return request.put<ReviewPlan>(`/review/review/review/${reviewId}`, data)
  },
}

export default reviewApi
