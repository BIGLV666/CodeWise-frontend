export type FavoriteDifficulty = 'Easy' | 'Medium' | 'Hard'

export interface FavoriteProblem {
  id: number
  title: string
  acceptance: string
  difficulty: FavoriteDifficulty
  solved: boolean
}
