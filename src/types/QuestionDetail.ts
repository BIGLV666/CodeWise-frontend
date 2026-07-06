export interface SampleCase {
  inputData: string
  expectedOutput: string
}

export interface JudgeResultDTO {
  submissionId?: number
  language?: string
  code?: string
  submitStatus: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | 'OLE' | 'MLE' | 'PE' | 'PENDING' | string
  failInde?: number
  expectedOutput?: string
  inputData?: string
  timeUsed?: number
  memoryUsed?: number
  error?: string
  log?: string
  userOutput?: string
}

export interface DebugTestCase {
  input: string
  expectedOutput: string
  result?: JudgeReturnRecordDto | null
  passed?: boolean | null
}

export interface JudgeReturnRecordDto {
  userId?: number
  errorMsg?: string
  log?: string
  submitStatus?: string
  userOutput?: string
  failIndex?: number
  inputData?: string
  expectedOutput?: string
  timeUsed?: number
  memoryUsed?: number
}

export interface ParsedTestData {
  input: string
  expected: string
  actual: string
}
