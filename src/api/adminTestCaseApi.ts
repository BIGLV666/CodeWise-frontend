import request, { unwrap } from './request'

/** 测试点实体（service-question test_case 表）。 */
export interface TestCaseItem {
  caseId?: number
  questionId?: number
  inputData: string
  expectedOutput: string
  /** 1-样例用例 0-隐藏用例 */
  isSample?: number
  /** 1-隐藏 0-对用户可见 */
  isHidden?: number
  sortOrder?: number
  scoreWeight?: number
  timeLimit?: number | null
  memoryLimit?: number | null
  createTime?: string | null
  updateTime?: string | null
}

/** 测试点表单载荷（新增/更新共用，与后端 InsertTestCaseDto 字段一致）。 */
export interface TestCasePayload {
  inputData: string
  expectedOutput: string
  isSample: number
  isHidden: number
  sortOrder: number
  scoreWeight: number
  timeLimit?: number | null
  memoryLimit?: number | null
}

/** 题目测试点数量概览行。 */
export interface QuestionOverviewItem {
  questionId: number
  count: number
}

const adminTestCaseApi = {
  /** 全量题目测试点概览：后端返回若干 {question_id, count} 行 + 末尾 {total, questions} 汇总行。 */
  async getQuestionOverview(): Promise<{ items: QuestionOverviewItem[]; total: number }> {
    const response = await request.get('/question/getallquestion')
    const rows = unwrap<Record<string, unknown>[]>(response, [])
    const items: QuestionOverviewItem[] = []
    let total = 0
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row && row.total !== undefined) {
        total = Number(row.total) || 0
        continue
      }
      items.push({ questionId: Number(row.question_id), count: Number(row.count) || 0 })
    }
    return { items, total }
  },

  /** 按题目查询测试点列表。 */
  async listByQuestion(questionId: number): Promise<TestCaseItem[]> {
    const response = await request.get('/question/gettestcasesbyquestionid', { params: { questionId } })
    const records = unwrap<TestCaseItem[]>(response, [])
    return Array.isArray(records) ? records : []
  },

  /** 按 ID 查询单个测试点。 */
  async getTestCase(caseId: number): Promise<TestCaseItem | null> {
    const response = await request.get('/question/gettestcasebyid', { params: { caseId } })
    return unwrap<TestCaseItem | null>(response, null)
  },

  /** 新增测试点。 */
  add(questionId: number, payload: TestCasePayload) {
    return request.post('/question/addtestcase', { questionId, ...payload })
  },

  /** 更新测试点（caseId 走 query，字段体与新增一致）。 */
  update(caseId: number, payload: TestCasePayload) {
    return request.put('/question/updatetestcase', payload, { params: { caseId } })
  },

  /** 删除测试点。 */
  remove(caseId: number) {
    return request.delete('/question/deletetestcase', { params: { caseId } })
  },
}

export default adminTestCaseApi
