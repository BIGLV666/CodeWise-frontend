import request from './request'

/** 申诉内容类型，与后端 PostType 枚举一致 */
export type AppealPostType = 'POST' | 'COMMENT' | 'SOLUTION'

/** 提交申诉的请求体 */
export interface AppealSubmitPayload {
  /** 社区服务 AppealDto 使用的字段名。 */
  postType: AppealPostType
  postId: number
  reason: string
}

const appealApi = {
  /** 用户提交申诉（申诉历史走 adminAppealApi.myAppeals）。 */
  submitAppeal(data: AppealSubmitPayload) {
    return request.post('/community/appeal/submit', data)
  },
}

export default appealApi
