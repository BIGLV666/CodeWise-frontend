import request from './request'

export interface FunctionParameterDraft {
  type: string
  name: string
}

export interface FunctionSampleDraft {
  input: string
  output: string
}

export interface FunctionQuestionDraft {
  title: string
  description: string
  inputDesc: string
  outputDesc: string
  hint: string
  source: string
  difficulty: number
  tags: string
  timeLimit: number
  memoryLimit: number
  className: string
  methodName: string
  parameterConfig: string
  outputType: string
  samples: FunctionSampleDraft[]
}

interface ApiResult<T> {
  code: number
  message?: string
  data: T
}

const questionImportApi = {
  parseLeetCode(titleSlug: string) {
    return request.get('/question/function/leetcode', {
      params: { title: titleSlug },
      timeout: 30000,
    }) as unknown as Promise<ApiResult<FunctionQuestionDraft>>
  },

  createFunctionQuestion(data: FunctionQuestionDraft) {
    return request.post('/question/function', data) as unknown as Promise<ApiResult<number>>
  },
}

export default questionImportApi
