export type FavoriteDifficulty = 'Easy' | 'Medium' | 'Hard'

export interface FavoriteProblem {
  id: string
  title: string
  acceptance: string
  difficulty: FavoriteDifficulty
  solved: boolean
  status: number
}

export interface FavoriteCollection {
  favoritesId: string
  favoritesName: string
  favoritesType?: string
  favoritesContent?: string
  userId?: string
  questionIds?: number[]
  createTime?: string
  updateTime?: string
}

export interface FavoriteQuestionDto {
  questionId: string
  title: string
  questionTitle?: string
  difficulty?: number
  passRate?: number | string
  totalSubmit?: number
  totalAc?: number
  status?: number
}
