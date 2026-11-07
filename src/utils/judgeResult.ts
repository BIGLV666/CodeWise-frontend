import type { JudgeResultDTO, ParsedTestData } from '@/types/QuestionDetail'

/**
 * 从后端 error 文案里解析测试数据。
 *
 * 部分判题结果只带 `error: "输入: ... 输出: ... 预期: ..."`，没有结构化字段，
 * 题目详情页和小组题目页共用同一套解析规则。
 */
export function parseErrorMsg(errorMsg: string): ParsedTestData {
  if (!errorMsg) return { input: '', expected: '', actual: '' }
  const inputMatch = errorMsg.match(/输入:\s*([\s\S]*?)\s*输出:/)
  const outputMatch = errorMsg.match(/输出:\s*([\s\S]*?)\s*预期:/)
  const expectedMatch = errorMsg.match(/预期:\s*([\s\S]*?)$/)
  return {
    input: inputMatch ? inputMatch[1].trim() : '',
    expected: expectedMatch ? expectedMatch[1].trim() : '',
    actual: outputMatch ? outputMatch[1].trim() : '',
  }
}

/** 优先使用结构化字段，缺失时回退到 error 文案解析结果。 */
export function resolveParsedTestData(result: JudgeResultDTO | null): ParsedTestData {
  if (!result) return { input: '', expected: '', actual: '' }
  const fallback = parseErrorMsg(result.error || '')
  return {
    input: result.inputData ?? fallback.input,
    expected: result.expectedOutput ?? fallback.expected,
    actual: result.actual ?? result.userOutput ?? fallback.actual,
  }
}
