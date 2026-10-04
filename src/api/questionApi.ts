import request from "./request";
export interface JudgeRequest {
  code: string
  language: string
  questionTitle:string
  questionId: number
  submitScene?: 'REVIEW' | string
}
// types/debug.ts
export interface DebugTestCase {
  input: string
  output: string
  result?: DebugResult | null
}

export interface DebugResult {
  input: string
  expectedOutput: string
  actualOutput: string
  passed: boolean | null  // null 表示没填期望输出，不判断
  exitCode: number
  errorMsg: string
  timeUsed: number
  memoryUsed: number
}
export interface JudgeResult {
  submitRecordId: number
  status: 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'PENDING'
  message: string
  time: number
  memory: number
  testCases?: Array<{
    input: string
    expectedOutput: string
    actualOutput: string
    passed: boolean
  }>
}

export interface FunctionTestCasePayload {
  input: string
  output: string
}

export interface FunctionTestCaseGenerationTask {
  taskId: string
  questionId: number
  userId?: string | number
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string
  requestedCount: number
  generatedCount: number
  seed?: string | number
  errorMessage?: string
  createTime?: string
  finishTime?: string
}

export interface LeetCodeArtifactTask {
  taskId: string
  titleSlug: string
  questionId?: number
  userId?: string | number
  status: 'PENDING' | 'FETCHING' | 'GENERATING' | 'VALIDATING' | 'SAVING' | 'SUCCESS' | 'MANUAL_REVIEW' | string
  generatedCount?: number
  artifactDirectory?: string
  errorMessage?: string
  createTime?: string
  finishTime?: string
}

const questionApi={
    cursorquestions(params:any){
        return request.get('/question/cursorquestions', { params })
    },
    getTotal(){
        return request.get('/question/total')
    },
    getQuestionById(questionId:number){
        return request.get('/question/getquestionbyid',{params:{questionId}})
    },
    submitCode(data: JudgeRequest) {
        return request.post<number>('/question/judge', data)
      },
       getSubmitRecord(questionId:number){
      return request.get('/question/getsubmitrecordsbyquestionid',{params:{questionId}})
    },
    getUserSubmitRecords(params: { pageSize: number; lastId?: string | number | null }) {
      return request.get('/question/getsubmitrecordsbyuserid', { params })
    },
    debug(data: { userId: string; code: string; language: string; questionId: number; tests: DebugTestCase[] }) {
      return request.post('/question/debug', data)
    },
    addFunctionTestCases(questionId: number, testCases: FunctionTestCasePayload[]) {
      return request.post('/question/function/test-cases/batch', testCases, {
        params: { questionId },
      })
    },
    generateFunctionTestCases(data: {
      questionId: number
      language: 'java'
      standardAnswer: string
      count?: number
      seed?: string
    }) {
      return request.post<FunctionTestCaseGenerationTask>('/question/function/test-cases/generate', data)
    },
    getFunctionTestCaseGenerationStatus(taskId: string) {
      return request.get<FunctionTestCaseGenerationTask>('/question/function/test-cases/generate/status', {
        params: { taskId },
        // 轮询接口：失败由调用方的任务状态区展示，不走全局提示
        silent: true,
      })
    },
    generateLeetCodeArtifacts(titleSlug: string) {
      return request.post<LeetCodeArtifactTask>('/question/function/leetcode/artifacts/generate', null, {
        params: { titleSlug },
      })
    },
    getLeetCodeArtifactStatus(taskId: string) {
      return request.get<LeetCodeArtifactTask>('/question/function/leetcode/artifacts/status', {
        params: { taskId },
        // 轮询接口：失败由调用方的任务状态区展示，不走全局提示
        silent: true,
      })
    },
}
   
  
export default questionApi
