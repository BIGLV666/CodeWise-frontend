<template>
  <div class="users-page">
    <main class="page-content">
      <section class="page-heading">
        <div>
          <span class="eyebrow">ADMIN · USER GOVERNANCE</span>
          <h1>用户治理</h1>
          <p>查询用户信息、执行封禁与解封，并处理用户提交的封禁申诉。</p>
        </div>
        <el-button :icon="Refresh" :loading="appealsLoading" @click="loadAppeals">刷新申诉</el-button>
      </section>

      <!-- 用户查询与封禁操作 -->
      <section class="panel-card">
        <header class="card-header">
          <div>
            <h2>用户查询</h2>
            <span>按用户 ID 查询资料并执行封禁/解封</span>
          </div>
        </header>
        <div class="search-row">
          <el-input
            v-model="searchUserId"
            class="search-input"
            placeholder="输入用户 ID，例如 1001"
            clearable
            @keyup.enter="loadUser"
          />
          <el-button type="primary" :loading="userLoading" @click="loadUser">查询</el-button>
        </div>

        <el-alert v-if="userError" :title="userError" type="error" :closable="false" show-icon class="load-alert" />

        <el-descriptions v-if="user" :column="2" border class="user-descriptions">
          <el-descriptions-item label="用户 ID">{{ user.userId }}</el-descriptions-item>
          <el-descriptions-item label="用户名">{{ user.userName }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ user.nickName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="角色">
            <el-tag size="small" :type="user.roleId === 2 || user.roleId === 0 ? 'warning' : 'info'" effect="plain">
              {{ roleText(user.roleId) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ user.email || '—' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ user.phone || '—' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag size="small" :type="statusTagType(user.status)" effect="plain">{{ statusText(user.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="封禁至">{{ formatDate(user.banTime) }}</el-descriptions-item>
          <el-descriptions-item label="提交 / AC">{{ user.totalSubmit ?? 0 }} / {{ user.totalAc ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="最近登录">{{ formatDate(user.lastLoginTime) }}<template v-if="user.lastLoginIp">（{{ user.lastLoginIp }}）</template></el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ formatDate(user.createTime) }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="user" class="ban-actions">
          <el-input-number v-model="banDays" :min="1" :max="3650" size="small" />
          <span class="ban-unit">天</span>
          <el-button type="danger" :loading="banLoading" @click="banUser">封禁</el-button>
          <el-button type="warning" plain :loading="banLoading" @click="unbanUser">解封</el-button>
          <el-button link type="primary" :loading="banLoading" @click="loadBanDetail">查看封禁信息</el-button>
        </div>
      </section>

      <!-- 封禁申诉处理 -->
      <section class="panel-card">
        <header class="card-header">
          <div>
            <h2>封禁申诉</h2>
            <span>共 {{ appeals.length }} 条未处理申诉</span>
          </div>
          <el-tag effect="plain" type="info">处理结果将邮件通知申诉人</el-tag>
        </header>

        <el-table v-loading="appealsLoading" :data="appeals" empty-text="暂无待处理申诉" row-key="userAppealId">
          <el-table-column label="申诉 ID" min-width="95">
            <template #default="{ row }">#{{ row.userAppealId }}</template>
          </el-table-column>
          <el-table-column label="申诉人" min-width="100">
            <template #default="{ row }">{{ row.userId }}</template>
          </el-table-column>
          <el-table-column label="联系邮箱" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.reasonEmail || '—' }}</template>
          </el-table-column>
          <el-table-column label="申诉理由" min-width="260" show-overflow-tooltip>
            <template #default="{ row }">{{ row.appealReason }}</template>
          </el-table-column>
          <el-table-column label="提交时间" min-width="170">
            <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right" align="center">
            <template #default="{ row }">
              <el-button link type="primary" @click="openProcess(row)">详情与处理</el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </main>

    <!-- 申诉详情与处理弹窗 -->
    <el-dialog v-model="processDialogVisible" title="封禁申诉处理" width="560px">
      <div v-if="detailLoading" class="state-line">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载申诉详情...</span>
      </div>
      <template v-else-if="appealDetail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="申诉人 ID">{{ appealDetail.userId }}</el-descriptions-item>
          <el-descriptions-item label="联系邮箱">{{ appealDetail.reasonEmail || '—' }}</el-descriptions-item>
          <el-descriptions-item label="封禁原因">{{ appealDetail.banReason || '—' }}</el-descriptions-item>
          <el-descriptions-item label="封禁至">{{ formatDate(appealDetail.banTime) }}</el-descriptions-item>
          <el-descriptions-item label="申诉理由">{{ appealDetail.appealReason }}</el-descriptions-item>
        </el-descriptions>
        <el-form label-position="top" class="process-form">
          <el-form-item label="处理结果说明（将作为邮件正文发送给申诉人）" required>
            <el-input
              v-model="processResult"
              type="textarea"
              :rows="4"
              maxlength="500"
              show-word-limit
              placeholder="请说明处理结论与依据..."
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="processDialogVisible = false">取消</el-button>
        <el-button type="danger" plain :loading="processing" @click="submitProcess(false)">拒绝申诉</el-button>
        <el-button type="primary" :loading="processing" @click="submitProcess(true)">批准并解封</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Loading, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminUserApi, {
  type AdminUserDto,
  type UserAppeal,
  type UserAppealDetail,
} from '@/api/adminUserApi'
import { errorText } from '@/api/request'

const searchUserId = ref('')
const user = ref<AdminUserDto | null>(null)
const userLoading = ref(false)
const userError = ref('')
const banDays = ref(3)
const banLoading = ref(false)

const appeals = ref<UserAppeal[]>([])
const appealsLoading = ref(false)
const processDialogVisible = ref(false)
const detailLoading = ref(false)
const appealDetail = ref<UserAppealDetail | null>(null)
const processResult = ref('')
const processing = ref(false)

function roleText(roleId?: number) {
  if (roleId === 0) return 'root'
  if (roleId === 2) return '管理员'
  return '普通用户'
}

function statusText(status?: number) {
  if (status === 0) return '禁用'
  if (status === 2) return '已注销'
  return '启用'
}

function statusTagType(status?: number) {
  if (status === 0) return 'danger'
  if (status === 2) return 'info'
  return 'success'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

async function loadUser() {
  const id = searchUserId.value.trim()
  if (!id) {
    ElMessage.warning('请输入用户 ID')
    return
  }
  userLoading.value = true
  userError.value = ''
  user.value = null
  try {
    user.value = await adminUserApi.getUserDetail(id)
  } catch (error) {
    userError.value = errorText(error, '用户查询失败')
  } finally {
    userLoading.value = false
  }
}

async function banUser() {
  if (!user.value || banLoading.value) return
  try {
    await ElMessageBox.confirm(
      `确认封禁用户 ${user.value.userName}（ID ${user.value.userId}）${banDays.value} 天？`,
      '封禁用户',
      { confirmButtonText: '确认封禁', cancelButtonText: '取消', type: 'warning' },
    )
    banLoading.value = true
    await adminUserApi.ban(user.value.userId, banDays.value)
    ElMessage.success('已封禁')
    await reloadCurrentUser()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') console.error('封禁用户失败:', error)
  } finally {
    banLoading.value = false
  }
}

async function unbanUser() {
  if (!user.value || banLoading.value) return
  try {
    await ElMessageBox.confirm(
      `确认解封用户 ${user.value.userName}（ID ${user.value.userId}）？`,
      '解封用户',
      { confirmButtonText: '确认解封', cancelButtonText: '取消', type: 'warning' },
    )
    banLoading.value = true
    await adminUserApi.unban(user.value.userId)
    ElMessage.success('已解封')
    await reloadCurrentUser()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') console.error('解封用户失败:', error)
  } finally {
    banLoading.value = false
  }
}

async function loadBanDetail() {
  if (!user.value || banLoading.value) return
  banLoading.value = true
  try {
    // 封禁信息接口对邮箱/手机号脱敏，仅用于核对封禁时间与状态
    const detail = await adminUserApi.getBanDetail(user.value.userId)
    user.value = { ...user.value, banTime: detail.banTime, status: detail.status }
    ElMessage.success('已刷新封禁信息')
  } catch (error) {
    ElMessage.error(errorText(error, '封禁信息查询失败'))
  } finally {
    banLoading.value = false
  }
}

async function reloadCurrentUser() {
  if (!user.value) return
  try {
    user.value = await adminUserApi.getUserDetail(user.value.userId)
  } catch {
    // 刷新失败保留现有展示
  }
}

async function loadAppeals() {
  appealsLoading.value = true
  try {
    appeals.value = await adminUserApi.listAppeals()
  } catch (error) {
    appeals.value = []
    ElMessage.error(errorText(error, '申诉列表加载失败'))
  } finally {
    appealsLoading.value = false
  }
}

async function openProcess(appeal: UserAppeal) {
  processDialogVisible.value = true
  detailLoading.value = true
  appealDetail.value = null
  processResult.value = ''
  try {
    appealDetail.value = await adminUserApi.getAppealDetail(appeal.userAppealId)
  } catch (error) {
    processDialogVisible.value = false
    ElMessage.error(errorText(error, '申诉详情加载失败'))
  } finally {
    detailLoading.value = false
  }
}

async function submitProcess(approve: boolean) {
  if (!appealDetail.value || processing.value) return
  if (!processResult.value.trim()) {
    ElMessage.warning('请填写处理结果说明')
    return
  }
  try {
    await ElMessageBox.confirm(
      approve ? '批准后将立即解封该用户并邮件通知。' : '拒绝后将邮件通知申诉人。',
      approve ? '批准申诉' : '拒绝申诉',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
    )
    processing.value = true
    await adminUserApi.processAppeal(appealDetail.value.userAppealId, approve, processResult.value.trim())
    ElMessage.success(approve ? '申诉已批准，用户已解封' : '申诉已拒绝')
    processDialogVisible.value = false
    await loadAppeals()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') console.error('处理申诉失败:', error)
  } finally {
    processing.value = false
  }
}

onMounted(loadAppeals)
</script>

<style scoped>
.users-page { min-height: 100vh; color: var(--cw-text-1); background: var(--cw-bg-page); }
.page-content { width: min(1420px, calc(100% - 48px)); margin: 0 auto; padding: 42px 0 64px; }
.page-heading { margin-bottom: 24px; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.eyebrow { color: var(--cw-text-3); font-size: 11px; font-weight: 700; letter-spacing: .13em; }
h1 { margin: 7px 0 5px; color: var(--cw-text-1); font-size: 28px; letter-spacing: -.03em; }
.page-heading p { margin: 0; color: var(--cw-text-3); font-size: 13px; }
.panel-card { border: 1px solid var(--cw-border); border-radius: 9px; overflow: hidden; background: #fff; margin-bottom: 20px; }
.card-header { min-height: 64px; padding: 0 20px; border-bottom: 1px solid var(--cw-border); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.card-header > div:first-child { display: flex; align-items: baseline; gap: 10px; }
.card-header h2 { margin: 0; color: var(--cw-text-1); font-size: 16px; }
.card-header span { color: var(--cw-text-3); font-size: 11px; }
.search-row { display: flex; gap: 10px; padding: 16px 20px 4px; }
.search-input { max-width: 320px; }
.user-descriptions { margin: 16px 20px; }
.load-alert { margin: 12px 20px 0; }
.ban-actions { display: flex; align-items: center; gap: 10px; padding: 0 20px 18px; }
.ban-unit { color: var(--cw-text-3); font-size: 13px; margin-right: 6px; }
.state-line { display: flex; align-items: center; gap: 8px; justify-content: center; padding: 20px 0; color: var(--cw-text-3); font-size: 13px; }
.process-form { margin-top: 16px; }
:deep(.el-table th.el-table__cell) { background: var(--cw-bg-page); color: var(--cw-text-3); font-size: 12px; font-weight: 600; }
:deep(.el-table td.el-table__cell) { color: var(--cw-text-3); font-size: 12px; }
@media (max-width: 900px) { .page-content { width: calc(100% - 28px); padding-top: 28px; } }
</style>
