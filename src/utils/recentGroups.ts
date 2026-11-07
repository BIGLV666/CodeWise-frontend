import type { GroupInfo, GroupType } from '@/api/groupApi'

/**
 * 「最近访问的小组」本地记录。
 *
 * 后端当前没有「我的小组 / 小组列表」公开接口，小组入口来自邀请链接、
 * 站内信邀请或手动输入小组 ID。这里只把用户确实打开过的小组记在本地，
 * 作为再次进入的快捷方式，不参与权限判断。
 */

const STORAGE_KEY_PREFIX = 'codewise_recent_groups'
const MAX_ITEMS = 8
const VALID_TYPES: GroupType[] = ['FREE', 'APPROVAL', 'INVITE']

/**
 * 按用户隔离存储键。
 *
 * 登录态失效时前端只会清 token/userId，不一定清 localStorage；如果共用
 * 一个全局键，同一浏览器的下一个账号会看到上一个账号访问过的私密小组名。
 */
function storageKey() {
  let userId = ''
  try {
    userId = localStorage.getItem('userId') || ''
  } catch {
    userId = ''
  }
  return `${STORAGE_KEY_PREFIX}_${userId || 'guest'}`
}

export interface RecentGroup {
  groupId: string
  groupName: string
  groupType: GroupType
  visitedAt: number
}

function isRecentGroup(value: unknown): value is RecentGroup {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<RecentGroup>
  return (
    typeof item.groupId === 'string' &&
    item.groupId !== '' &&
    typeof item.groupName === 'string' &&
    typeof item.groupType === 'string' &&
    VALID_TYPES.includes(item.groupType as GroupType) &&
    typeof item.visitedAt === 'number'
  )
}

export function listRecentGroups(): RecentGroup[] {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecentGroup).slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

/** 退出/删除小组后从最近访问里移除，避免留下打不开的入口。 */
export function forgetRecentGroup(groupId: string | number): void {
  const id = String(groupId)
  const rest = listRecentGroups().filter((item) => item.groupId !== id)
  try {
    localStorage.setItem(storageKey(), JSON.stringify(rest))
  } catch {
    // 本地存储不可用时忽略
  }
}

/** 记录/刷新一个小组的访问时间，按最近访问倒序保留有限条数。 */
export function rememberRecentGroup(
  group: Pick<GroupInfo, 'groupId' | 'groupName' | 'groupType'>,
): void {
  const groupId = String(group.groupId)
  if (!groupId) return
  const next: RecentGroup = {
    groupId,
    groupName: group.groupName || `小组 ${groupId}`,
    groupType: group.groupType,
    visitedAt: Date.now(),
  }
  const rest = listRecentGroups().filter((item) => item.groupId !== groupId)
  try {
    localStorage.setItem(storageKey(), JSON.stringify([next, ...rest].slice(0, MAX_ITEMS)))
  } catch {
    // 本地存储不可用（隐私模式/配额满）不影响主流程
  }
}
