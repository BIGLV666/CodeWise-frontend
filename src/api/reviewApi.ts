import request from './request'
import type { FavoriteCollection, FavoriteQuestionDto } from '@/types/FavoriteProblem'

export interface UpdateFavoritePayload {
  favoritesId: string
  favoritesName?: string
  favoritesContent?: string
  favoritesType?: string
  questionIds?: string[]
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
}

export default reviewApi
