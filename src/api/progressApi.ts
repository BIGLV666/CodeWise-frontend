import request from './request'

/**
 * 学习计划状态（单向流转，不可逆向）：
 * 0-未开始 → 1-进行中 →（2-已完成 或 3-已过期）。
 * 已过期只能删除或新建；判题 AC 会由后端自动置为已完成。
 */
export type ProgressStatus = 0 | 1 | 2 | 3

/** 状态 → 展示文案 */
export const PROGRESS_STATUS_TEXT: Record<ProgressStatus, string> = {
  0: '未开始',
  1: '进行中',
  2: '已完成',
  3: '已过期',
}

/** 状态 → Element Plus 标签类型 */
export const PROGRESS_STATUS_TAG: Record<ProgressStatus, 'info' | 'primary' | 'success' | 'danger'> = {
  0: 'info',
  1: 'primary',
  2: 'success',
  3: 'danger',
}

/** 单条学习计划（用户对每道题唯一）。ID 为雪花 Long，前端一律按字符串处理 */
export interface ProgressTracker {
  progressId: string | number
  userId?: string | number
  questionId: string | number
  /** 当天提交记录 */
  submitIds?: Array<string | number>
  status: ProgressStatus
  /** 备注（任何状态可改） */
  notesContent?: string
  /** 反思（任何状态可改） */
  summaryContent?: string
  /** 计划开始日期，yyyy-MM-dd */
  beginTime: string
  createTime?: string
  updateTime?: string
}

/** 日历单日统计：total 为当日计划数，completed 为其中已完成数 */
export interface ProgressCalendarVo {
  date: string
  total: number
  completed: number
}

/** 周报 */
export interface WeeklyReportVo {
  startDate: string
  endDate: string
  totalPlanned: number
  completedCount: number
  inProgressCount: number
  expiredCount: number
  daily: ProgressCalendarVo[]
  completedItems: Array<{
    questionId: string | number
    title?: string
    summaryContent?: string
  }>
}

const progressApi = {
  /**
   * 创建计划。约束：beginTime 不得早于今天（yyyy-MM-dd）；
   * 同一道题已有未终结计划时后端会拒绝（唯一约束）。
   */
  createPlan(data: { questionId: string | number; notesContent?: string; beginTime: string }) {
    return request.post<ProgressTracker>('/review/progress/create', data)
  },

  /** 获取某一天的全部计划，date 必填（yyyy-MM-dd） */
  listByDate(date: string) {
    return request.get<ProgressTracker[]>('/review/progress/list', { params: { date } })
  },

  /** 月日历统计（当月全部有计划的日期），date 缺省 = 当月 */
  calendarMonth(date?: string) {
    return request.get<ProgressCalendarVo[]>('/review/progress/calendar/month', {
      params: date ? { date } : {},
    })
  },

  /**
   * 更新计划。query 均可选：
   * notesContent/summaryContent 任何状态可改；beginTime 仅「未开始」可改。
   */
  updatePlan(params: {
    progressId: string | number
    beginTime?: string
    notesContent?: string
    summaryContent?: string
  }) {
    return request.post<string>('/review/progress/update', null, { params })
  },

  /** 删除计划 */
  deletePlan(progressId: string | number) {
    return request.post<string>('/review/progress/delete', null, { params: { progressId } })
  },

  /** 周报，date 缺省 = 本周 */
  weeklyReport(date?: string) {
    return request.get<WeeklyReportVo>('/review/progress/report/week', {
      params: date ? { date } : {},
    })
  },
}

export default progressApi
