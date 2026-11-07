import request from './request'

/**
 * 小组（service-quiz-nest）接口。
 *
 * 网关前缀 `/api/quiz/**`，request 的 baseURL 已含 `/api`，这里只写 `/quiz/...`。
 * 小组 id / 题目 id 一律按字符串处理（后端 Long 自增，不排除以后换成雪花 id）。
 */

/** 加入方式，与后端 GroupType 对齐。 */
export type GroupType = 'FREE' | 'APPROVAL' | 'INVITE'

/** 成员角色，与后端 GroupMemberRole 对齐。 */
export type GroupMemberRole = 'MEMBER' | 'ADMIN' | 'ROOT'

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  FREE: '公开加入',
  APPROVAL: '申请审批',
  INVITE: '邀请加入',
}

export const GROUP_TYPE_HINTS: Record<GroupType, string> = {
  FREE: '任何人都可以直接加入',
  APPROVAL: '提交申请后等待管理员审批',
  INVITE: '需要管理员发送邀请码',
}

/** 小组基础信息（后端返回 Group 实体）。 */
export interface GroupInfo {
  groupId: string
  groupName: string
  /** 创建人（ROOT）的用户 id。 */
  userId: string
  groupDescription?: string | null
  groupType: GroupType
  /** APPROVED 成员数（含 ROOT）。 */
  memberCount?: number | null
  createTime?: string
  updateTime?: string
}

export interface CreateGroupPayload {
  groupName: string
  groupDescription?: string
  groupType: GroupType
  /** 建组前先调 getCreateToken() 拿到的一次性凭证。 */
  token: string
}

export interface UpdateGroupPayload {
  groupId: string | number
  groupName: string
  groupDescription?: string
  groupType: GroupType
}

/** 小组题库列表里的题目瘦身信息（QuestionBriefDto）。 */
export interface GroupQuestionBrief {
  questionId: string | number
  title: string
  difficulty?: number | null
  tags?: string | null
  status?: number
  createUserId?: string | number
  totalSubmit?: number | null
  totalAc?: number | null
  passRate?: string | number | null
  createTime?: string
}

/** 小组题库条目：dto 是题目本身，groupQuestionId 是小组内的索引 id。 */
export interface GroupQuestionItem {
  dto: GroupQuestionBrief
  groupQuestionId: string
}

/** 小组题目详情（GroupQuestionVo）。 */
export interface GroupQuestionDetail {
  questionDto: GroupQuestionBrief & {
    description?: string
    inputDesc?: string
    outputDesc?: string
    sampleInput?: string
    sampleOutput?: string
    hint?: string
    timeLimit?: number
    memoryLimit?: number
    source?: string
    /** 0-下架 1-正常 2-审核 3-私密 */
    status?: number
  }
  groupQuestionId: string
}

export interface GroupQuestionCursorPage {
  records: GroupQuestionItem[]
  nextCursor?: string | number | null
  hasNext?: boolean
  total?: number | null
}

/**
 * 添加题目：`questionId` 非空表示引用平台题目，其余字段忽略；
 * 为空时按自建题目处理，必须提供 title/description/timeLimit/memoryLimit。
 */
export interface GroupQuestionPayload {
  questionId?: number
  title?: string
  description?: string
  inputDesc?: string
  outputDesc?: string
  sampleInput?: string
  sampleOutput?: string
  hint?: string
  /** 逗号分隔的标签串（后端字段是 String）。 */
  tags?: string
  timeLimit?: number
  memoryLimit?: number
}

export interface GroupSubmitRecord {
  groupSubmitRecordId: string
  submitRecordId: string
  questionId: string
  questionTitle: string
  nickName?: string | null
  avatarUrl?: string | null
  status?: string | null
  createTime?: string
}

export interface GroupSubmitRecordPage {
  records: GroupSubmitRecord[]
  nextCursor?: string | number | null
  hasNext?: boolean
  total?: number | null
}

export interface SendInvitationPayload {
  toUserId: string | number
  /** 邀请人留言，最多 200 字。 */
  content?: string
}

const groupApi = {
  /** 获取建组一次性凭证（10 分钟有效，重复提交会被拒绝）。 */
  getCreateToken() {
    return request.get<string>('/quiz/groups/token')
  },

  createGroup(data: CreateGroupPayload) {
    return request.post<GroupInfo>('/quiz/groups', data)
  },

  /** 修改小组：后端是全量覆盖，名称/描述/加入方式都要传。 */
  updateGroup(data: UpdateGroupPayload) {
    return request.put<GroupInfo>('/quiz/groups', data)
  },

  /** `silent` 用于详情页自行展示页面级错误，避免和全局提示重复。 */
  getGroup(groupId: string | number, silent = false) {
    return request.get<GroupInfo>(`/quiz/groups/${encodeURIComponent(String(groupId))}`, {
      silent,
    })
  },

  /**
   * 小组题库游标分页（仅本组 APPROVED 成员可看）。
   *
   * `silent` 用于详情页探测成员身份：非成员会返回业务码 4041101，
   * 探测时不应该弹全局错误。
   */
  listQuestions(
    groupId: string | number,
    params: { pageSize?: number; lastId?: string | number | null } = {},
    silent = false,
  ) {
    return request.get<GroupQuestionCursorPage>(
      `/quiz/groups/${encodeURIComponent(String(groupId))}/questions`,
      {
        params: {
          pageSize: params.pageSize ?? 20,
          lastId: params.lastId ?? undefined,
        },
        silent,
      },
    )
  },

  addQuestion(groupId: string | number, data: GroupQuestionPayload) {
    return request.post<void>(
      `/quiz/groups/${encodeURIComponent(String(groupId))}/questions`,
      data,
    )
  },

  /** `silent` 用于做题页自行渲染「非成员 / 题目不存在」状态。 */
  getQuestion(groupId: string | number, groupQuestionId: string | number, silent = false) {
    return request.get<GroupQuestionDetail>(
      `/quiz/groups/${encodeURIComponent(String(groupId))}/questions/${encodeURIComponent(String(groupQuestionId))}`,
      { silent },
    )
  },

  /** 修改小组自建题目（平台题目不允许在组内修改）。 */
  updateQuestion(
    groupId: string | number,
    groupQuestionId: string | number,
    data: GroupQuestionPayload,
  ) {
    return request.put<void>(
      `/quiz/groups/${encodeURIComponent(String(groupId))}/questions/${encodeURIComponent(String(groupQuestionId))}`,
      data,
    )
  },

  deleteQuestion(groupId: string | number, groupQuestionId: string | number) {
    return request.delete<void>(
      `/quiz/groups/${encodeURIComponent(String(groupId))}/questions/${encodeURIComponent(String(groupQuestionId))}`,
    )
  },

  /**
   * 加入小组：FREE 直接加入、APPROVAL 落 PENDING、INVITE 必须带邀请码。
   */
  joinGroup(groupId: string | number, token?: string) {
    return request.post<boolean>(
      `/quiz/groups/${encodeURIComponent(String(groupId))}/join`,
      token ? { token } : null,
    )
  },

  /** 退出小组；ROOT 可指定继承人，未指定时后端自动晋升。 */
  leaveGroup(groupId: string | number, lastRoot?: string | number) {
    return request.delete<boolean>(
      `/quiz/groups/${encodeURIComponent(String(groupId))}/members/me`,
      { params: lastRoot == null ? undefined : { lastRoot } },
    )
  },

  /** 向指定用户发送邀请码站内信（仅 ROOT/ADMIN，且仅 INVITE 小组）。 */
  sendInvitation(groupId: string | number, data: SendInvitationPayload) {
    return request.post<void>(
      `/quiz/groups/${encodeURIComponent(String(groupId))}/invitations`,
      data,
    )
  },

  /** 小组提交记录（仅本组 APPROVED 成员可看，跨题目、按时间倒序）。 */
  listSubmitRecords(
    groupId: string | number,
    params: { pageSize?: number; lastId?: string | number | null } = {},
  ) {
    return request.get<GroupSubmitRecordPage>(
      `/question/group/${encodeURIComponent(String(groupId))}/submit-records`,
      {
        params: {
          pageSize: params.pageSize ?? 20,
          lastId: params.lastId ?? undefined,
        },
      },
    )
  },
}

export default groupApi
