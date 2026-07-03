import request from "./request";
export interface JudgeRequest {
  code: string
  language: string
  questionId: number
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
    }
}
   
  
export default questionApi