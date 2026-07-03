
export default interface userDto {
  userId: number
  userName: string
  email: string
  phone: string
  bio: string
  nickName: string
  avatarUrl: string
  birthday: string // LocalDate 转换为 string
  roleId: number
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
