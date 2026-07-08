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
  }
}

export default reviewApi
