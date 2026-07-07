import request from "./request";
export interface JudgeRequest {
  code: string
  language: string
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

const questionApi={
    cursorquestions(params:any){
        return request.get('/question/cursorquestions', { params })
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
    getUserSubmitRecords() {
      return request.get('/question/getsubmitrecordsbyuserid')
    },
    debug(data: { userId: string; code: string; language: string; questionId: number; tests: DebugTestCase[] }) {
      return request.post('/question/debug', data)
    }
}
   
  
export default questionApi
