<template>
  <div class="groups-page">
    <AppNavBar active="groups" />

    <main class="groups-shell">
      <section class="groups-hero">
        <div class="hero-copy">
          <p class="hero-eyebrow">学习社区</p>
          <h1 class="hero-title">小组</h1>
          <p class="hero-desc">
            和同学一起维护题单、互相出题，并在组内查看彼此的提交记录。
          </p>
        </div>
        <div class="hero-actions">
          <el-button type="primary" :icon="Plus" @click="openCreate">创建小组</el-button>
          <el-button :icon="Promotion" @click="openJoin()">加入小组</el-button>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <h2>最近访问</h2>
            <p>小组入口来自邀请链接、站内信邀请，或手动输入小组 ID。</p>
          </div>
          <el-button text type="primary" :icon="Refresh" @click="reloadRecent">刷新</el-button>
        </header>

        <el-empty
          v-if="recentGroups.length === 0"
          description="还没有访问过小组，先创建一个或凭邀请码加入吧"
          :image-size="72"
        />

        <div v-else class="group-grid">
          <article
            v-for="item in recentGroups"
            :key="item.groupId"
            class="group-card"
            role="link"
            tabindex="0"
            @click="openGroup(item.groupId)"
            @keydown.enter="openGroup(item.groupId)"
          >
            <div class="group-avatar">{{ avatarText(item.groupName) }}</div>
            <div class="group-body">
              <div class="group-title-row">
                <h3>{{ item.groupName }}</h3>
                <el-tag size="small" effect="plain">{{ GROUP_TYPE_LABELS[item.groupType] }}</el-tag>
              </div>
              <p class="group-meta">
                <span>小组 ID：{{ item.groupId }}</span>
                <span>{{ formatVisited(item.visitedAt) }}访问</span>
              </p>
            </div>
            <el-icon class="group-arrow"><ArrowRight /></el-icon>
          </article>
        </div>
      </section>

      <section class="panel guide-panel">
        <header class="panel-head">
          <div>
            <h2>如何进入小组</h2>
            <p>三种常见入口，任选一种即可。</p>
          </div>
        </header>
        <div class="guide-grid">
          <div class="guide-item">
            <span class="guide-index">01</span>
            <strong>创建小组</strong>
            <p>填写名称与加入方式，创建后你自动成为组长（ROOT）。</p>
            <el-button link type="primary" @click="openCreate">立即创建</el-button>
          </div>
          <div class="guide-item">
            <span class="guide-index">02</span>
            <strong>使用邀请链接</strong>
            <p>邀请链接会带上小组 ID 与邀请码，打开后确认即可加入。</p>
          </div>
          <div class="guide-item">
            <span class="guide-index">03</span>
            <strong>查看站内信</strong>
            <p>组内管理员发送的邀请会进入收件箱，点击「加入小组」即可。</p>
            <el-button link type="primary" @click="goInbox">打开收件箱</el-button>
          </div>
        </div>
      </section>
    </main>

    <!-- 创建小组 -->
    <el-dialog v-model="createVisible" title="创建小组" width="480px" @closed="resetCreateForm">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top">
        <el-form-item label="小组名称" prop="groupName">
          <el-input v-model="createForm.groupName" maxlength="40" show-word-limit placeholder="例如：算法陪跑小组" />
        </el-form-item>
        <el-form-item label="小组简介" prop="groupDescription">
          <el-input
            v-model="createForm.groupDescription"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="可选，介绍小组目标或刷题方向"
          />
        </el-form-item>
        <el-form-item label="加入方式" prop="groupType">
          <el-radio-group v-model="createForm.groupType" class="type-radios">
            <el-radio v-for="type in GROUP_TYPES" :key="type" :value="type" border>
              <span class="radio-label">{{ GROUP_TYPE_LABELS[type] }}</span>
              <small>{{ GROUP_TYPE_HINTS[type] }}</small>
            </el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createVisible = false">取消</el-button>
          <el-button type="primary" :loading="creating" @click="submitCreate">创建</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 加入小组 -->
    <el-dialog v-model="joinVisible" title="加入小组" width="460px" @closed="resetJoinForm">
      <div class="join-form">
        <label class="field-label" for="join-group-id">小组 ID</label>
        <div class="join-id-row">
          <el-input
            id="join-group-id"
            v-model="joinForm.groupId"
            placeholder="输入数字小组 ID"
            clearable
            @input="handleJoinIdInput"
            @keyup.enter="previewGroup"
          />
          <el-button :loading="previewLoading" @click="previewGroup">查询</el-button>
        </div>

        <el-alert
          v-if="joinError"
          class="join-error"
          type="error"
          :closable="false"
          :title="joinError"
        />

        <div v-if="joinPreview" class="join-preview">
          <div class="join-preview-main">
            <div class="group-avatar small">{{ avatarText(joinPreview.groupName) }}</div>
            <div>
              <h3>{{ joinPreview.groupName }}</h3>
              <p>{{ joinPreview.groupDescription || '暂无小组简介' }}</p>
            </div>
          </div>
          <div class="join-preview-meta">
            <el-tag size="small" :type="joinPreview.groupType === 'FREE' ? 'success' : 'warning'">
              {{ GROUP_TYPE_LABELS[joinPreview.groupType] }}
            </el-tag>
            <span>{{ joinPreview.memberCount || 0 }} 名成员</span>
            <span>组长 ID：{{ joinPreview.userId }}</span>
          </div>
          <p class="join-hint">{{ GROUP_TYPE_HINTS[joinPreview.groupType] }}</p>
        </div>

        <template v-if="joinPreview?.groupType === 'INVITE'">
          <label class="field-label" for="join-group-token">邀请码</label>
          <el-input
            id="join-group-token"
            v-model="joinForm.token"
            maxlength="6"
            placeholder="6 位数字邀请码"
          />
        </template>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="joinVisible = false">取消</el-button>
          <el-button type="primary" :loading="joining" @click="submitJoin">
            {{ joinPreview?.groupType === 'APPROVAL' ? '提交申请' : '加入小组' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 小组入口页。
 *
 * 后端暂无「小组列表」公开接口，因此这里不做假列表：
 * 展示本地记录过的最近访问小组，并提供「创建 / 按 ID 加入 / 邀请链接直达」三条入口。
 * 邀请链接由收件箱的小组邀请卡片带过来（query: groupId + token）。
 */
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { ArrowRight, Plus, Promotion, Refresh } from '@element-plus/icons-vue'
import AppNavBar from '@/components/layout/AppNavBar.vue'
import groupApi, {
  GROUP_TYPE_HINTS,
  GROUP_TYPE_LABELS,
  type GroupInfo,
  type GroupType,
} from '@/api/groupApi'
import { errorText, isLocalFailure, unwrap } from '@/api/request'
import { logWarn } from '@/utils/logger'
import { listRecentGroups, rememberRecentGroup, type RecentGroup } from '@/utils/recentGroups'

const route = useRoute()
const router = useRouter()

const GROUP_TYPES: GroupType[] = ['FREE', 'APPROVAL', 'INVITE']

const recentGroups = ref<RecentGroup[]>([])

const createVisible = ref(false)
const creating = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = reactive({
  groupName: '',
  groupDescription: '',
  groupType: 'FREE' as GroupType,
})
const createRules: FormRules = {
  groupName: [{ required: true, message: '请输入小组名称', trigger: 'blur' }],
  groupType: [{ required: true, message: '请选择加入方式', trigger: 'change' }],
}

const joinVisible = ref(false)
const joining = ref(false)
const previewLoading = ref(false)
const joinPreview = ref<GroupInfo | null>(null)
const joinError = ref('')
const joinForm = reactive({ groupId: '', token: '' })
// 查询预览的请求序号：慢请求返回时不能覆盖用户后来输入的小组。
let previewSeq = 0

onMounted(() => {
  reloadRecent()
  openJoinFromQuery()
})

function reloadRecent() {
  recentGroups.value = listRecentGroups()
}

function openGroup(groupId: string) {
  router.push(`/groups/${groupId}`)
}

function goInbox() {
  router.push('/inbox')
}

function avatarText(name: string) {
  return (name || '小组').slice(0, 2)
}

function formatVisited(timestamp: number) {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

function openCreate() {
  createForm.groupName = ''
  createForm.groupDescription = ''
  createForm.groupType = 'FREE'
  createVisible.value = true
}

function resetCreateForm() {
  createFormRef.value?.clearValidate()
}

async function submitCreate() {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return
  creating.value = true
  try {
    const tokenResult = await groupApi.getCreateToken()
    const token = unwrap<string>(tokenResult, '')
    if (!token) {
      throw new Error('创建凭证获取失败，请稍后重试')
    }
    const result = await groupApi.createGroup({
      groupName: createForm.groupName.trim(),
      groupDescription: createForm.groupDescription.trim() || undefined,
      groupType: createForm.groupType,
      token,
    })
    const group = unwrap<GroupInfo | null>(result, null)
    ElMessage.success('小组创建成功')
    createVisible.value = false
    if (group?.groupId) {
      rememberRecentGroup(group)
      router.push(`/groups/${group.groupId}`)
    } else {
      reloadRecent()
    }
  } catch (error) {
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '创建小组失败'))
    }
  } finally {
    creating.value = false
  }
}

function openJoin(prefill?: { groupId?: string; token?: string }) {
  // 打开弹窗即作废上一次查询，避免旧响应回填到新表单。
  previewSeq += 1
  joinForm.groupId = prefill?.groupId || ''
  joinForm.token = prefill?.token || ''
  joinPreview.value = null
  joinError.value = ''
  joinVisible.value = true
  if (joinForm.groupId) {
    void previewGroup()
  }
}

function handleJoinIdInput() {
  previewSeq += 1
  joinPreview.value = null
  joinError.value = ''
  previewLoading.value = false
}

function resetJoinForm() {
  previewSeq += 1
  joinForm.groupId = ''
  joinForm.token = ''
  joinPreview.value = null
  joinError.value = ''
  previewLoading.value = false
}

function openJoinFromQuery() {
  const rawGroupId = Array.isArray(route.query.groupId) ? route.query.groupId[0] : route.query.groupId
  const rawToken = Array.isArray(route.query.token) ? route.query.token[0] : route.query.token
  if (!rawGroupId) return
  openJoin({ groupId: String(rawGroupId), token: rawToken ? String(rawToken) : '' })
}

async function previewGroup() {
  const groupId = joinForm.groupId.trim()
  if (!/^\d+$/.test(groupId)) {
    ElMessage.warning('请输入数字小组 ID')
    return
  }
  const requestId = ++previewSeq
  previewLoading.value = true
  joinError.value = ''
  joinPreview.value = null
  try {
    const result = await groupApi.getGroup(groupId, true)
    if (requestId !== previewSeq || joinForm.groupId.trim() !== groupId) return
    joinPreview.value = unwrap<GroupInfo | null>(result, null)
    if (!joinPreview.value) {
      joinError.value = '没有找到这个小组，请核对小组 ID'
    }
  } catch (error) {
    if (requestId !== previewSeq) return
    joinPreview.value = null
    joinError.value = errorText(error, '小组查询失败，请稍后重试')
    logWarn('查询小组失败:', error)
  } finally {
    if (requestId === previewSeq) previewLoading.value = false
  }
}

async function submitJoin() {
  // 输入框和预览必须指向同一个小组，否则先重新查询再提交。
  if (
    !joinPreview.value ||
    String(joinPreview.value.groupId) !== joinForm.groupId.trim()
  ) {
    await previewGroup()
  }
  if (!joinPreview.value) return

  const group = joinPreview.value
  if (group.groupType === 'INVITE' && !joinForm.token.trim()) {
    ElMessage.warning('该小组需要邀请码，请向管理员获取')
    return
  }

  joining.value = true
  try {
    await groupApi.joinGroup(group.groupId, joinForm.token.trim() || undefined)
    ElMessage.success(
      group.groupType === 'APPROVAL' ? '入组申请已提交，等待管理员审批' : '已加入小组',
    )
    rememberRecentGroup(group)
    joinVisible.value = false
    router.push(`/groups/${group.groupId}`)
  } catch (error) {
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '加入小组失败'))
    }
  } finally {
    joining.value = false
  }
}
</script>

<style scoped>
.groups-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--cw-bg-page);
}

.groups-shell {
  width: min(1080px, calc(100% - 48px));
  margin: 0 auto;
  padding: 32px 0 56px;
}

.groups-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.hero-eyebrow {
  margin: 0 0 6px;
  color: var(--cw-text-3);
  font-size: 13px;
}

.hero-title {
  margin: 0;
  color: var(--cw-text-1);
  font-size: 30px;
  line-height: 1.2;
}

.hero-desc {
  margin: 10px 0 0;
  color: var(--cw-text-2);
  font-size: 14px;
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex: 0 0 auto;
}

.join-error {
  margin-bottom: 4px;
}

.panel {
  padding: 22px 24px;
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius-lg);
  background: var(--cw-bg-card);
  box-shadow: var(--cw-shadow-card);
}

.panel + .panel {
  margin-top: 18px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.panel-head h2 {
  margin: 0;
  color: var(--cw-text-1);
  font-size: 18px;
}

.panel-head p {
  margin: 6px 0 0;
  color: var(--cw-text-3);
  font-size: 13px;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.group-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius);
  background: var(--cw-bg-card);
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.group-card:hover {
  border-color: var(--cw-brand-border);
  box-shadow: var(--cw-shadow-card);
  transform: translateY(-1px);
}

.group-avatar {
  width: 46px;
  height: 46px;
  border-radius: var(--cw-radius);
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
  font-size: 16px;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.group-avatar.small {
  width: 40px;
  height: 40px;
  font-size: 14px;
}

.group-body {
  flex: 1 1 auto;
  min-width: 0;
}

.group-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.group-title-row h3 {
  margin: 0;
  overflow: hidden;
  color: var(--cw-text-1);
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-meta {
  margin: 7px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--cw-text-3);
  font-size: 12px;
}

.group-arrow {
  flex: 0 0 auto;
  color: var(--cw-text-faint);
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.guide-item {
  padding: 16px;
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius);
  background: var(--cw-bg-page);
}

.guide-index {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--cw-brand-dark);
  font-family: var(--cw-font-mono);
  font-size: 12px;
}

.guide-item strong {
  display: block;
  color: var(--cw-text-1);
  font-size: 14px;
}

.guide-item p {
  min-height: 40px;
  margin: 8px 0 4px;
  color: var(--cw-text-3);
  font-size: 13px;
  line-height: 1.6;
}

.type-radios {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.type-radios :deep(.el-radio) {
  height: auto;
  margin-right: 0;
  padding: 10px 12px;
}

.radio-label {
  display: block;
  color: var(--cw-text-1);
  font-weight: 600;
}

.type-radios small {
  display: block;
  margin-top: 2px;
  color: var(--cw-text-3);
  font-size: 12px;
  font-weight: 400;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-label {
  color: var(--cw-text-2);
  font-size: 13px;
}

.join-id-row {
  display: flex;
  gap: 8px;
}

.join-preview {
  margin: 6px 0 2px;
  padding: 14px;
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius);
  background: var(--cw-bg-page);
}

.join-preview-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.join-preview-main h3 {
  margin: 0;
  color: var(--cw-text-1);
  font-size: 15px;
}

.join-preview-main p {
  margin: 5px 0 0;
  color: var(--cw-text-3);
  font-size: 12px;
  line-height: 1.5;
}

.join-preview-meta {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  color: var(--cw-text-3);
  font-size: 12px;
}

.join-hint {
  margin: 8px 0 0;
  color: var(--cw-text-2);
  font-size: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1024px) {
  .groups-shell {
    width: calc(100% - 32px);
  }

  .group-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .groups-shell {
    padding: 20px 0 40px;
  }

  .groups-hero {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }

  .hero-actions :deep(.el-button) {
    flex: 1 1 0;
  }

  .panel {
    padding: 18px 16px;
  }

  .guide-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .guide-item p {
    min-height: 0;
  }
}
</style>
