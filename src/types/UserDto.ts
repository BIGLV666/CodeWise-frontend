
export default interface userDto {
  userId: string
  userName: string
  email: string
  phone: string
  bio: string
  nickName: string
  avatarUrl: string
  birthday: string // LocalDate 转换为 string
  /** 角色 ID，2 为管理员。刷新页面后可能尚未加载，故为可选。 */
  roleId?: number
  status: number
  openId: string
  totalSubmit: number
  totalAc: number
  rating: number
  createTime: string // LocalDateTime 转换为 string
  updateTime: string
  lastLoginIp: string
  lastLoginTime: string
  banTime: string
}
