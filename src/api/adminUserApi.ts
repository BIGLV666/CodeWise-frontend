import request, { unwrap } from './request'

/** 用户账号状态：0-禁用 1-启用 2-已注销（与后端 user.status 一致）。 */
export const USER_STATUS = {
  DISABLED: 0,
  ACTIVE: 1,
  DELETED: 2,
} as const

/** 用户封禁申诉状态：0-待处理 1-已处理。 */
export const USER_APPEAL_STATUS = {
  PENDING: 0,
  PROCESSED: 1,
} as const

/** 管理端可见的用户信息（ban/detail 由后端脱敏，不含邮箱、手机号）。 */
export interface AdminUserDto {
  userId: string
  userName: string
  nickName?: string | null
  email?: string | null
  phone?: string | null
  bio?: string | null
  avatarUrl?: string | null
  roleId?: number
  status?: number
  totalSubmit?: number
  totalAc?: number
  createTime?: string | null
  lastLoginIp?: string | null
  lastLoginTime?: string | null
  banTime?: string | null
}

/** 用户封禁申诉（service-user user_appeal 表）。 */
export interface UserAppeal {
  userAppealId: number
  userId: number
  appealReason: string
  reasonEmail?: string | null
  status: number
  createTime?: string | null
  updateTime?: string | null
  processResult?: string | null
  operatorId?: number | null
}

/** 申诉详情：在申诉基础上附带申诉当时的封禁信息。 */
export interface UserAppealDetail extends UserAppeal {
  banTime?: string | null
  banReason?: string | null
}

const adminUserApi = {
  /** 按 ID 查询任意用户信息（管理员）。 */
  async getUser(userId: string | number): Promise<AdminUserDto> {
    const response = await request.get('/user/admin/user', { params: { userId } })
    return unwrap<AdminUserDto>(response, {} as AdminUserDto)
  },

  /** 查询用户详情（管理员）。 */
  async getUserDetail(userId: string | number): Promise<AdminUserDto> {
    const response = await request.get('/user/admin/detail', { params: { userId } })
    return unwrap<AdminUserDto>(response, {} as AdminUserDto)
  },

  /** 封禁用户，banTime 单位为天。 */
  ban(userId: string | number, banTime: number) {
    return request.post('/user/admin/ban', null, { params: { userId, banTime } })
  },

  /** 解封用户。 */
  unban(userId: string | number) {
    return request.post('/user/admin/unban', null, { params: { userId } })
  },

  /** 查询封禁信息（后端脱敏，不含邮箱、手机号）。 */
  async getBanDetail(userId: string | number): Promise<AdminUserDto> {
    const response = await request.get('/user/admin/ban/detail', { params: { userId } })
    return unwrap<AdminUserDto>(response, {} as AdminUserDto)
  },

  /** 查询全部未处理的封禁申诉。 */
  async listAppeals(): Promise<UserAppeal[]> {
    const response = await request.get('/user/admin/appeal/list')
    const records = unwrap<UserAppeal[]>(response, [])
    return Array.isArray(records) ? records : []
  },

  /** 查询申诉详情（含申诉人封禁信息）。 */
  async getAppealDetail(userAppealId: number): Promise<UserAppealDetail> {
    const response = await request.get('/user/admin/appeal/detail', { params: { userAppealId } })
    return unwrap<UserAppealDetail>(response, {} as UserAppealDetail)
  },

  /** 处理申诉：approve true-批准并解封用户，false-拒绝；processResult 作为邮件正文发送申诉人。 */
  processAppeal(userAppealId: number, approve: boolean, processResult: string) {
    return request.post('/user/admin/appeal/process', null, {
      params: { userAppealId, approve, processResult },
    })
  },
}

export default adminUserApi
