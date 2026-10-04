import request, { unwrap } from './request'

/** 失败提交状态：0-待操作 1-重试中 2-重试成功 3-重试失败 */
export const FAILURE_SUBMIT_STATUS = {
  PENDING: 0,
  RETRYING: 1,
  SUCCESS: 2,
  FAILURE: 3,
} as const

export type FailureSubmitStatus =
  (typeof FAILURE_SUBMIT_STATUS)[keyof typeof FAILURE_SUBMIT_STATUS]

export interface FailureSubmit {
  failureSubmitId: number
  submitRecordId: number
  status: FailureSubmitStatus
  retryCount: number
  lastError?: string | null
  createTime?: string | null
  retryTime?: string | null
}

const adminFailureSubmitApi = {
  /** 按状态获取失败提交记录。 */
  async list(status: FailureSubmitStatus): Promise<FailureSubmit[]> {
    const response = await request.get(`/judge/failure/${status}/list`)
    const records = unwrap<FailureSubmit[]>(response, [])
    return Array.isArray(records) ? records : []
  },

  /** 重试待操作记录，后端会再次校验记录状态。 */
  retry(id: number) {
    return request.post(`/judge/failure/retry/${id}`)
  },
}

export default adminFailureSubmitApi
