<template>
  <div class="profile-view">
    <header class="navbar">
      <div class="navbar-left">
        <MobileNavToggle :open="nav.open.value" label="打开主导航" @toggle="nav.toggle" />
        <button class="logo" type="button" @click="goHome">
          <BrandLogo :size="28" />
        </button>
        <nav class="nav-menu cw-offcanvas" :class="{ 'is-open': nav.open.value }" aria-label="主导航">
          <div class="nav-drawer-head cw-only-phone">
            <span>导航</span>
            <button class="nav-drawer-close cw-tap" type="button" aria-label="收起导航" @click="nav.close">
              <el-icon><Close /></el-icon>
            </button>
          </div>
          <button class="nav-item" type="button" @click="goHome">题库</button>
          <button class="nav-item" type="button">竞赛</button>
          <button class="nav-item" type="button" @click="goDiscuss">讨论</button>
          <button class="nav-item" type="button" @click="goReview">复习</button>
        </nav>
      </div>
      <div class="navbar-right">
        <InboxButton />
        <el-button :icon="Refresh" circle size="small" :loading="loading" @click="loadProfile" />
        <el-avatar :size="34" :src="avatarUrl">{{ avatarText }}</el-avatar>
      </div>
    </header>

    <main class="profile-shell">
      <aside class="profile-sidebar">
        <section class="profile-card">
          <el-avatar shape="square" :size="92" :src="avatarUrl" class="profile-avatar">{{ avatarText }}</el-avatar>
          <div class="profile-main">
            <h1>{{ displayName }}</h1>
            <p>@{{ userInfo.userName || localUserName }}</p>
            <span class="profile-meta">
              <el-icon><Location /></el-icon>
              {{ userInfo.lastLoginIp || 'CodeWise 用户' }}
            </span>
          </div>
          <p class="bio">{{ userInfo.bio || '专注算法训练与工程能力提升，持续复盘，稳定进步。' }}</p>
          <div class="profile-actions">
            <el-button class="edit-button" type="primary" @click="goHome">继续刷题</el-button>
            <el-dropdown trigger="click" @command="handleProfileCommand">
              <el-button class="more-button">
                编辑
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="avatar">更换头像</el-dropdown-item>
                  <el-dropdown-item command="profile">编辑资料</el-dropdown-item>
                  <el-dropdown-item command="password">修改密码</el-dropdown-item>
                  <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
                  <el-dropdown-item command="freeze">冻结账号</el-dropdown-item>
                  <el-dropdown-item command="delete">注销账号</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <input
              ref="avatarInputRef"
              class="avatar-input"
              type="file"
              accept="image/*"
              @change="handleAvatarChange"
            />
          </div>
        </section>

        <section class="side-card">
          <h2>个人导航</h2>
          <button class="side-link" :class="{ active: profileSection === 'overview' }" type="button" @click="selectProfileSection('overview')">总览</button>
          <button class="side-link" type="button" @click="goHome">题库</button>
          <button class="side-link" type="button" @click="goReview">复习计划</button>
          <button class="side-link" type="button" @click="goFavorites">收藏夹</button>
          <button class="side-link" :class="{ active: profileSection === 'content' }" type="button" @click="selectProfileSection('content')">我的帖子</button>
          <button class="side-link" :class="{ active: profileSection === 'ai' }" type="button" @click="selectProfileSection('ai')">API Key 管理</button>
        </section>

        <section class="side-card">
          <h2>语言偏好</h2>
          <div class="tag-list">
            <el-tag v-for="lang in preferredLanguages" :key="lang" effect="plain">{{ lang }}</el-tag>
          </div>
        </section>
      </aside>

      <section class="profile-content">
        <div class="stats-grid">
          <section class="stat-panel progress-panel">
            <h2>解题进度</h2>
            <div class="progress-ring" :aria-label="`通过率 ${acceptanceRate}%`">
              <svg viewBox="0 0 140 140">
                <circle class="ring-track" cx="70" cy="70" r="58" />
                <circle class="ring-value" cx="70" cy="70" r="58" :style="ringStyle" />
              </svg>
              <div class="ring-text">
                <strong>{{ userInfo.totalAc ?? solvedFromRecords }}</strong>
                <span>已通过</span>
              </div>
            </div>
          </section>

          <section class="stat-panel rank-panel">
            <div>
              <span>提交总数</span>
              <strong>{{ userInfo.totalSubmit ?? submitRecords.length }}</strong>
            </div>
            <div>
              <span>通过率</span>
              <strong>{{ acceptanceRate }}%</strong>
            </div>
            <div>
              <span>评分</span>
              <strong>{{ userInfo.rating ?? 0 }}</strong>
            </div>
          </section>
        </div>

        <section class="achievement-card">
          <div class="section-header">
            <h2>荣誉徽章</h2>
            <span>基于当前提交和收藏数据</span>
          </div>
          <div class="badge-list">
            <div class="achievement-badge">
              <span class="badge-icon orange"><el-icon><Trophy /></el-icon></span>
              <strong>稳定刷题</strong>
              <small>{{ submitRecords.length }} 次提交</small>
            </div>
            <div class="achievement-badge">
              <span class="badge-icon green"><el-icon><CircleCheck /></el-icon></span>
              <strong>AC 收割机</strong>
              <small>{{ solvedFromRecords }} 次通过</small>
            </div>
            <div class="achievement-badge">
              <span class="badge-icon blue"><el-icon><Star /></el-icon></span>
              <strong>题单收藏家</strong>
              <small>{{ favoriteCount }} 个收藏夹</small>
            </div>
          </div>
        </section>

        <section class="activity-card">
          <div class="section-header">
            <h2>最近提交</h2>
            <el-button link type="primary" @click="goHome">去题库</el-button>
          </div>

          <div v-if="loading" class="state-line">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载个人数据...</span>
          </div>

          <el-empty v-else-if="submitRecords.length === 0" description="暂无提交记录" />

          <div v-else class="activity-list">
            <button
              v-for="record in submitRecords"
              :key="record.submitRecordId"
              class="activity-item"
              type="button"
              @click="openRecordQuestion(record)"
            >
              <el-icon class="activity-status" :class="getStatusClass(record.submitStatus)">
                <CircleCheck v-if="record.submitStatus === 'AC'" />
                <CircleClose v-else />
              </el-icon>
              <span class="activity-main">
                <strong>{{ record.questionTitle || '未知题目' }}</strong>
                <small>{{ formatDate(record.submitTime || record.createTime) }}</small>
              </span>
              <el-tag size="small" :type="record.submitStatus === 'AC' ? 'success' : 'danger'">
                {{ record.submitStatus || 'UNKNOWN' }}
              </el-tag>
              <el-tag size="small" effect="plain">{{ record.language || 'unknown' }}</el-tag>
            </button>
          </div>
        </section>

        <section v-if="profileSection === 'content'" class="activity-card my-content-card">
          <div class="section-header content-header">
            <div>
              <h2>我的内容</h2>
              <span>查看帖子、题解与评论的发布及审核状态</span>
            </div>
            <div class="content-header-actions">
              <el-button size="small" @click="openAppealHistory">我的申诉</el-button>
              <el-segmented v-model="myContentType" :options="myContentOptions" size="small" @change="loadMyContent(true)" />
            </div>
          </div>

          <div v-if="myContentLoading && myContent.length === 0" class="state-line">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载我的内容...</span>
          </div>
          <el-empty v-else-if="myContent.length === 0" description="还没有发布过此类内容" />
          <div v-else class="my-content-list">
            <article v-for="item in myContent" :key="`${item.type}-${item.targetId}`" class="my-content-item">
              <div class="my-content-main">
                <div class="my-content-title-line">
                  <strong>{{ item.title || contentExcerpt(item.content) }}</strong>
                  <el-tag :type="contentStatus(item.status).type" size="small" effect="plain">
                    {{ contentStatus(item.status).label }}
                  </el-tag>
                </div>
                <p v-if="item.title">{{ contentExcerpt(item.content) }}</p>
                
                <!-- 显示拒绝理由 -->
                <div v-if="item.status === 2 && item.rejectReason" class="reject-reason">
                  <el-icon><WarningFilled /></el-icon>
                  <span>拒绝理由：{{ item.rejectReason }}</span>
                </div>
                
                <small>{{ formatDate(item.createTime) }}</small>
              </div>
              
              <div class="my-content-actions">
                <!-- 所有内容都可以查看 -->
                <el-button link type="primary" @click="viewMyContent(item)">查看</el-button>
                
                <!-- 帖子和题解可以编辑 -->
                <el-button 
                  v-if="(item.type === 'POST' || item.type === 'SOLUTION') && item.status !== 0" 
                  link 
                  type="primary" 
                  @click="editMyContent(item)"
                >
                  编辑
                </el-button>
                
                <!-- 被拒绝的内容可以申诉 -->
                <el-button 
                  v-if="item.status === 2" 
                  link 
                  type="warning" 
                  @click="openAppealDialog(item)"
                >
                  申诉
                </el-button>
              </div>
            </article>
          </div>
          <div v-if="myContentHasNext" class="my-content-more">
            <el-button text :loading="myContentLoading" @click="loadMyContent(false)">加载更多</el-button>
          </div>
        </section>

        <section v-if="profileSection === 'ai'" id="ai-model-settings" class="ai-settings-card">
          <div class="section-header">
            <div>
              <h2>AI 模型</h2>
              <span>管理你在题目页使用的自定义模型</span>
            </div>
            <el-button type="primary" plain :icon="Plus" @click="openCreateModelDialog">添加模型</el-button>
          </div>

          <el-alert v-if="aiConfigError" :title="aiConfigError" type="warning" :closable="false" show-icon class="load-alert" />
          <div v-if="aiConfigLoading" class="state-line">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载模型配置...</span>
          </div>
          <el-empty v-else-if="aiConfigs.length === 0" description="还没有自定义模型" />
          <div v-else class="ai-config-list">
            <article v-for="config in aiConfigs" :key="config.userConfigId" class="ai-config-item">
              <div class="config-icon"><el-icon><Cpu /></el-icon></div>
              <div class="config-main">
                <strong>{{ config.groupName }}</strong>
                <span>{{ config.modelNames.join('、') }}</span>
              </div>
              <div class="config-actions">
                <el-button link type="primary" :icon="Edit" @click="openEditModelDialog(config.userConfigId)">
                  修改
                </el-button>
                <el-button link type="danger" :icon="Delete" @click="removeModelConfig(config)">删除</el-button>
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>

    <el-dialog v-model="profileDialogVisible" title="编辑资料" width="460px" class="profile-dialog">
      <el-form label-position="top">
        <el-form-item label="昵称">
          <el-input v-model="profileForm.nickName" maxlength="24" show-word-limit placeholder="输入昵称" />
        </el-form-item>
        <el-form-item label="个人简介">
          <el-input
            v-model="profileForm.bio"
            type="textarea"
            :rows="4"
            maxlength="120"
            show-word-limit
            placeholder="简单介绍一下自己"
          />
        </el-form-item>
        <el-form-item label="生日">
          <el-date-picker
            v-model="profileForm.birthday"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择生日"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="profileDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="profileSaving" @click="saveProfile">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <AiModelConfigDialog
      v-model="modelDialogVisible"
      :mode="modelDialogMode"
      :config-id="editingConfigId"
      @saved="loadAiConfigs"
    />

    <!-- 申诉弹窗 -->
    <el-dialog v-model="appealDialogVisible" title="提交申诉" width="500px">
      <el-form label-position="top">
        <el-form-item label="申诉内容">
          <div class="appeal-content-preview">
            <strong>{{ appealTarget?.title || contentExcerpt(appealTarget?.content) }}</strong>
            <el-tag size="small" type="danger">已拒绝</el-tag>
          </div>
        </el-form-item>
        
        <el-form-item label="拒绝理由">
          <el-alert type="error" :closable="false" show-icon>
            {{ appealTarget?.rejectReason || '无' }}
          </el-alert>
        </el-form-item>
        
        <el-form-item label="申诉理由" required>
          <el-input
            v-model="appealForm.reason"
            type="textarea"
            :rows="5"
            maxlength="500"
            show-word-limit
            placeholder="请说明您认为此内容不应被拒绝的理由..."
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="appealDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="appealSubmitting" @click="submitAppeal">提交申诉</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码弹窗 -->
    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="420px" class="profile-dialog">
      <el-form label-position="top">
        <el-form-item label="当前密码" required>
          <el-input v-model="passwordForm.oldPassword" type="password" show-password placeholder="输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码" required>
          <el-input v-model="passwordForm.newPassword" type="password" show-password maxlength="64" placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认新密码" required>
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="passwordDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="passwordSubmitting" @click="submitPassword">确认修改</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 申诉历史弹窗 -->
    <el-dialog v-model="appealHistoryVisible" title="我的申诉" width="560px">
      <div v-if="appealHistoryLoading && appealHistory.length === 0" class="state-line">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载申诉历史...</span>
      </div>
      <el-empty v-else-if="appealHistory.length === 0" description="还没有申诉记录" />
      <template v-else>
        <div class="appeal-history-list">
          <article
            v-for="item in appealHistory"
            :key="item.appealId"
            class="appeal-history-item"
            @click="openAppealDetail(item.appealId)"
          >
            <div class="appeal-history-head">
              <el-tag size="small" :type="appealStatusTag(item.status).type">{{ appealStatusTag(item.status).label }}</el-tag>
              <strong>{{ item.title || `${item.rootType} #${item.rootId}` }}</strong>
              <small>{{ formatDate(item.createTime) }}</small>
            </div>
            <p class="appeal-history-reason">{{ item.reason }}</p>
          </article>
        </div>
        <div v-if="appealHistoryHasMore" class="my-content-more">
          <el-button text :loading="appealHistoryLoading" @click="loadAppealHistory(false)">加载更多</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 申诉详情弹窗 -->
    <el-dialog v-model="appealDetailVisible" title="申诉详情" width="480px">
      <div v-if="appealDetailLoading" class="state-line">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载申诉详情...</span>
      </div>
      <el-descriptions v-else-if="appealDetail" :column="1" border>
        <el-descriptions-item label="状态">
          <el-tag size="small" :type="appealStatusTag(appealDetail.status).type">{{ appealStatusTag(appealDetail.status).label }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="相关内容">
          {{ appealDetail.title || `${appealDetail.rootType} #${appealDetail.rootId}` }}
        </el-descriptions-item>
        <el-descriptions-item label="申诉理由">{{ appealDetail.reason }}</el-descriptions-item>
        <el-descriptions-item label="管理员回复">{{ appealDetail.takeDownReason || '暂无回复' }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ formatDate(appealDetail.createTime) }}</el-descriptions-item>
        <el-descriptions-item v-if="appealDetail.updateTime" label="更新时间">{{ formatDate(appealDetail.updateTime) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
    <!-- 冻结账号弹窗 -->
    <el-dialog v-model="freezeDialogVisible" title="冻结账号" width="420px" class="profile-dialog">
      <el-alert
        title="冻结后账号将无法登录，可随时联系管理员申诉解封。"
        type="warning"
        :closable="false"
        show-icon
        class="freeze-alert"
      />
      <el-form label-position="top">
        <el-form-item label="冻结原因" required>
          <el-input v-model="freezeForm.reason" maxlength="120" show-word-limit placeholder="例如：暂停使用一段时间" />
        </el-form-item>
        <el-form-item label="登录密码" required>
          <el-input v-model="freezeForm.password" type="password" show-password placeholder="验证身份" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="freezeDialogVisible = false">取消</el-button>
          <el-button type="danger" :loading="freezeSubmitting" @click="submitFreeze">确认冻结</el-button>
        </div>
      </template>
    </el-dialog>

    <MobileNavBackdrop v-if="nav.open.value" @close="nav.close" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/User'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  CircleCheck,
  CircleClose,
  Close,
  Cpu,
  Delete,
  Edit,
  Loading,
  Location,
  Plus,
  Refresh,
  Star,
  Trophy,
  WarningFilled,
} from '@element-plus/icons-vue'
import { errorText, isLocalFailure } from '@/api/request'
import userApi from '@/api/userApi'
import questionApi from '@/api/questionApi'
import reviewApi from '@/api/reviewApi'
import aiApi, { type UserAiConfigSummary } from '@/api/aiApi'
import communityApi, { type MyContentItem, type MyContentType } from '@/api/communityApi'
import appealApi from '@/api/appealApi'
import adminAppealApi, { type AppealItem } from '@/api/adminAppealApi'
import { normalizeAvatarUrl } from '@/utils/avatar'
import type UserDto from '@/types/UserDto'
import type { FavoriteCollection } from '@/types/FavoriteProblem'
import InboxButton from '@/components/notification/InboxButton.vue'
import AiModelConfigDialog from '@/components/ai/AiModelConfigDialog.vue'
import MobileNavToggle from '@/components/layout/MobileNavToggle.vue'
import MobileNavBackdrop from '@/components/layout/MobileNavBackdrop.vue'
import { useMobileNav } from '@/composables/useMobileNav'
import { navigateTopLevel } from '@/utils/navigation'
import { logWarn } from '@/utils/logger'

interface SubmitRecord {
  submitRecordId: string
  questionTitle?: string
  questionId: number
  submitStatus?: string
  submitTime?: string
  createTime?: string
  language?: string
}

const router = useRouter()
const route = useRoute()
// 手机档主导航转成抽屉
const nav = useMobileNav()
const userStore = useUserStore()
const loading = ref(false)
const profileSection = ref<'overview' | 'content' | 'ai'>('overview')
const profileSaving = ref(false)
const avatarUploading = ref(false)
const profileDialogVisible = ref(false)
const avatarInputRef = ref<HTMLInputElement | null>(null)
const userInfo = ref<Partial<UserDto>>({})
const submitRecords = ref<SubmitRecord[]>([])
const favorites = ref<FavoriteCollection[]>([])
const aiConfigs = ref<UserAiConfigSummary[]>([])
const aiConfigLoading = ref(false)
const aiConfigError = ref('')
const myContent = ref<MyContentItem[]>([])
const myContentType = ref<MyContentType>('POST')
const myContentLoading = ref(false)
const myContentNextCursor = ref<string | null>(null)
const myContentHasNext = ref(false)
const myContentOptions = [
  { label: '帖子', value: 'POST' },
  { label: '题解', value: 'SOLUTION' },
  { label: '评论', value: 'COMMENT' },
]
const modelDialogVisible = ref(false)
const modelDialogMode = ref<'create' | 'edit'>('create')
const editingConfigId = ref<number | null>(null)
const profileForm = reactive({
  nickName: '',
  bio: '',
  birthday: '',
})

const localUserId = computed(() => localStorage.getItem('userId') || '')
const localUserName = computed(() => localStorage.getItem('userName') || 'coder')
const displayName = computed(() => userInfo.value.nickName || userInfo.value.userName || localUserName.value)
const avatarUrl = computed(() => {
  const url = userInfo.value.avatarUrl || localStorage.getItem('avatarUrl') || ''
  return normalizeAvatarUrl(url)
})
const avatarText = computed(() => displayName.value.slice(0, 2).toUpperCase())
const favoriteCount = computed(() => favorites.value.length)
const preferredLanguages = computed(() => {
  const langs = submitRecords.value.map((item) => item.language).filter(Boolean) as string[]
  return Array.from(new Set(langs)).slice(0, 4).length ? Array.from(new Set(langs)).slice(0, 4) : ['C++', 'Python', 'Java', 'Go']
})
const solvedFromRecords = computed(() => submitRecords.value.filter((item) => item.submitStatus === 'AC').length)
const acceptanceRate = computed(() => {
  const total = userInfo.value.totalSubmit ?? submitRecords.value.length
  const ac = userInfo.value.totalAc ?? solvedFromRecords.value
  if (!total) return 0
  return Math.round((ac / total) * 100)
})
const ringStyle = computed(() => {
  const circumference = 364.4
  return {
    strokeDasharray: circumference,
    strokeDashoffset: circumference * (1 - acceptanceRate.value / 100),
  }
})
const recentRecords = computed(() => submitRecords.value.slice(0, 6))

const contentStatus = (status: number) => {
  if (status === 0) return { label: '待审核', type: 'warning' as const }
  if (status === 1) return { label: '已发布', type: 'success' as const }
  if (status === 2) return { label: '未通过 / 已下架', type: 'danger' as const }
  return { label: '未知', type: 'info' as const }
}

const contentExcerpt = (content?: string) => {
  const text = String(content || '').replace(/\s+/g, ' ').trim()
  if (!text) return '（无正文）'
  return text.length > 100 ? `${text.slice(0, 100)}…` : text
}

const loadMyContent = async (reset = false) => {
  if (myContentLoading.value) return
  myContentLoading.value = true
  if (reset) {
    myContent.value = []
    myContentNextCursor.value = null
    myContentHasNext.value = false
  }
  const type = myContentType.value
  try {
    const response: any = await communityApi.listMyContent({
      type,
      pageSize: 10,
      lastId: reset ? null : myContentNextCursor.value,
    })
    const page = response?.data ?? response ?? {}
    if (type !== myContentType.value) return
    const list = Array.isArray(page.records) ? page.records : (Array.isArray(page.list) ? page.list : [])
    const normalized = list.map((item: any): MyContentItem => ({
      ...item,
      targetId: String(item.id || item.targetId),
      rootId: item.rootId == null ? null : String(item.rootId),
      questionId: item.questionId == null ? null : String(item.questionId),
      status: Number(item.status),
      rejectReason: item.checkReason || item.rejectReason,
    }))
    myContent.value = reset ? normalized : [...myContent.value, ...normalized]
    
    // 计算下一个游标
    if (list.length > 0) {
      const lastItem = list[list.length - 1]
      myContentNextCursor.value = String(page.nextCursor ?? lastItem.id ?? lastItem.targetId)
    }
    
    myContentHasNext.value = Boolean(page.hasNext ?? page.hasMore)
  } catch (error) {
    logWarn('我的内容加载失败:', error)
  } finally {
    myContentLoading.value = false
  }
}

const openMyContent = (item: MyContentItem) => {
  if (item.type === 'POST') {
    router.push(`/discuss/${item.targetId}`)
    return
  }
  if (item.type === 'SOLUTION' && item.questionId) {
    router.push({
      path: '/questiondetailview',
      query: { questionId: item.questionId, tab: 'solution', solutionId: item.targetId },
    })
    return
  }
  if (item.type === 'COMMENT' && item.rootId) {
    if (item.rootType === 'SOLUTION') {
      router.push({
        path: '/questiondetailview',
        query: { questionId: item.questionId || undefined, tab: 'solution', solutionId: item.rootId },
      })
    } else {
      router.push({ path: `/discuss/${item.rootId}`, query: { commentId: item.targetId } })
    }
  }
}

// 申诉相关状态
const appealDialogVisible = ref(false)
const appealTarget = ref<MyContentItem | null>(null)
const appealForm = ref({ reason: '' })
const appealSubmitting = ref(false)

// 修改密码相关状态
const passwordDialogVisible = ref(false)
const passwordSubmitting = ref(false)
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

// 申诉历史相关状态
const appealHistoryVisible = ref(false)
const appealHistoryLoading = ref(false)
const appealHistory = ref<AppealItem[]>([])
const appealHistoryLastId = ref<string | number | null>(null)
const appealHistoryHasMore = ref(false)
const appealDetailVisible = ref(false)
const appealDetailLoading = ref(false)
const appealDetail = ref<AppealItem | null>(null)

/** 申诉状态到标签文案/颜色的映射（与后端 0-待审核 1-拒绝 2-恢复 对应）。 */
function appealStatusTag(status: number) {
  if (status === 0) return { label: '待审核', type: 'warning' as const }
  if (status === 1) return { label: '已拒绝', type: 'danger' as const }
  return { label: '已恢复', type: 'success' as const }
}

function openPasswordDialog() {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordDialogVisible.value = true
}

// 冻结/注销账号相关状态
const freezeDialogVisible = ref(false)
const freezeSubmitting = ref(false)
const freezeForm = reactive({ reason: '', password: '' })

function openFreezeDialog() {
  freezeForm.reason = ''
  freezeForm.password = ''
  freezeDialogVisible.value = true
}

async function submitFreeze() {
  if (freezeSubmitting.value) return
  if (!freezeForm.reason.trim()) {
    ElMessage.warning('请填写冻结原因')
    return
  }
  if (!freezeForm.password) {
    ElMessage.warning('请输入登录密码验证身份')
    return
  }
  try {
    await ElMessageBox.confirm('冻结后账号将无法登录，确认继续？', '冻结账号', {
      confirmButtonText: '确认冻结',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
      type: 'warning',
    })
  } catch {
    return
  }
  freezeSubmitting.value = true
  try {
    await userApi.freezeAccount(freezeForm.reason.trim(), freezeForm.password)
    ElMessage.success('账号已冻结')
    freezeDialogVisible.value = false
    userStore.logout()
    router.push('/login')
  } catch {
    // 失败提示由 axios 响应拦截器统一弹出
  } finally {
    freezeSubmitting.value = false
  }
}

async function deleteAccount() {
  try {
    await ElMessageBox.prompt(
      '注销后账号将无法恢复，请输入「注销」确认操作。',
      '注销账号',
      {
        confirmButtonText: '确认注销',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
        inputPattern: /^注销$/,
        inputErrorMessage: '请输入「注销」以确认',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  try {
    await userApi.deleteAccount()
    ElMessage.success('账号已注销')
    userStore.logout()
    router.push('/login')
  } catch {
    // 失败提示由 axios 响应拦截器统一弹出
  }
}

async function submitPassword() {
  if (passwordSubmitting.value) return
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    ElMessage.warning('请填写当前密码和新密码')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少 6 位')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  passwordSubmitting.value = true
  try {
    await userApi.updatePassword(passwordForm.oldPassword, passwordForm.newPassword)
    ElMessage.success('密码修改成功')
    passwordDialogVisible.value = false
  } catch {
    // 失败提示由 axios 响应拦截器统一弹出
  } finally {
    passwordSubmitting.value = false
  }
}

function openAppealHistory() {
  appealHistoryVisible.value = true
  if (appealHistory.value.length === 0) loadAppealHistory(true)
}

async function loadAppealHistory(refresh: boolean) {
  if (appealHistoryLoading.value) return
  appealHistoryLoading.value = true
  try {
    const page = await adminAppealApi.myAppeals({
      lastId: refresh ? null : appealHistoryLastId.value,
      pageSize: 20,
    })
    appealHistory.value = refresh ? page.list : [...appealHistory.value, ...page.list]
    const last = page.list[page.list.length - 1]
    appealHistoryLastId.value = last ? last.appealId : null
    appealHistoryHasMore.value = page.hasMore
  } catch {
    // 失败提示由 axios 响应拦截器统一弹出
  } finally {
    appealHistoryLoading.value = false
  }
}

async function openAppealDetail(appealId: number) {
  appealDetailVisible.value = true
  appealDetailLoading.value = true
  appealDetail.value = null
  try {
    appealDetail.value = await adminAppealApi.getAppealDetail(appealId)
  } catch {
    // 加载失败时收起详情弹窗，失败提示由拦截器统一弹出
    appealDetailVisible.value = false
  } finally {
    appealDetailLoading.value = false
  }
}

// 查看我的内容
function viewMyContent(item: MyContentItem) {
  if (item.type === 'POST') {
    router.push(`/discuss/${item.targetId}`)
  } else if (item.type === 'SOLUTION' && item.questionId) {
    router.push({
      path: '/questiondetailview',
      query: { questionId: item.questionId, tab: 'solution', solutionId: item.targetId },
    })
  } else if (item.type === 'COMMENT' && item.rootId) {
    if (item.rootType === 'SOLUTION') {
      router.push({
        path: '/questiondetailview',
        query: { questionId: item.questionId || undefined, tab: 'solution', solutionId: item.rootId },
      })
    } else {
      router.push({ path: `/discuss/${item.rootId}`, query: { commentId: item.targetId } })
    }
  }
}

// 编辑我的内容
function editMyContent(item: MyContentItem) {
  if (item.type === 'POST') {
    router.push(`/discuss/${item.targetId}/edit`)
  } else if (item.type === 'SOLUTION') {
    router.push(`/solutions/${item.targetId}/edit`)
  }
}

// 打开申诉弹窗
function openAppealDialog(item: MyContentItem) {
  appealTarget.value = item
  appealForm.value.reason = ''
  appealDialogVisible.value = true
}

// 提交申诉
async function submitAppeal() {
  if (!appealTarget.value) return
  
  if (!appealForm.value.reason.trim()) {
    ElMessage.warning('请填写申诉理由')
    return
  }
  
  try {
    appealSubmitting.value = true
    
    // 社区服务的 AppealDto 使用 postType/postId，不能发送 rootType/rootId。
    const payload = {
      postType: appealTarget.value.type,
      postId: Number(appealTarget.value.targetId),
      reason: appealForm.value.reason.trim(),
    }

    await appealApi.submitAppeal(payload)
    
    ElMessage.success('申诉已提交，等待管理员审核')
    appealDialogVisible.value = false
    
    // 刷新列表
    await loadMyContent(true)
  } catch (error) {
    logWarn('提交申诉失败:', error)
  } finally {
    appealSubmitting.value = false
  }
}

const normalizeUser = (raw: any): Partial<UserDto> => ({
  ...raw,
  userId: raw?.userId !== undefined && raw?.userId !== null ? String(raw.userId) : undefined,
})

const normalizeRecord = (raw: any): SubmitRecord => ({
  submitRecordId: String(raw.submitRecordId ?? raw.submit_record_id ?? `${raw.questionId}-${raw.createTime}`),
  questionTitle: raw.questionTitle ?? raw.question_title,
  questionId: Number(raw.questionId ?? raw.question_id),
  submitStatus: raw.submitStatus ?? raw.submit_status,
  submitTime: raw.submitTime ?? raw.submit_time,
  createTime: raw.createTime ?? raw.create_time,
  language: raw.language,
})

const getCursorRecords = (res: any): any[] => {
  const payload = res?.data ?? res
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.records)) return payload.records
  return []
}

const applyUserInfo = (user: Partial<UserDto>) => {
  userInfo.value = normalizeUser(user)
  userStore.updateUser(userInfo.value)
}

const openProfileDialog = () => {
  profileForm.nickName = userInfo.value.nickName || ''
  profileForm.bio = userInfo.value.bio || ''
  profileForm.birthday = userInfo.value.birthday || ''
  profileDialogVisible.value = true
}

const loadProfile = async () => {
  loading.value = true
  try {
    const [userResult, recordsResult, favoritesResult] = await Promise.allSettled([
      localUserId.value ? userApi.getCurrentUser() : Promise.resolve(null),
      questionApi.getUserSubmitRecords({ pageSize: 30 }),
      reviewApi.listFavorites(),
    ])

    if (userResult.status === 'fulfilled') {
      const user = userResult.value?.data ?? userResult.value ?? {}
      applyUserInfo(user)
    } else {
      logWarn('用户信息加载失败:', userResult.reason)
    }

    if (recordsResult.status === 'fulfilled') {
      submitRecords.value = getCursorRecords(recordsResult.value).map(normalizeRecord)
    } else {
      submitRecords.value = []
      logWarn('提交记录加载失败:', recordsResult.reason)
    }

    if (favoritesResult.status === 'fulfilled') {
      const favoriteData = favoritesResult.value?.data ?? favoritesResult.value ?? []
      favorites.value = Array.isArray(favoriteData) ? favoriteData : []
    } else {
      favorites.value = []
      logWarn('收藏夹加载失败:', favoritesResult.reason)
    }
  } finally {
    loading.value = false
  }
}

const loadAiConfigs = async () => {
  aiConfigLoading.value = true
  aiConfigError.value = ''
  try {
    const response: any = await aiApi.listConfigs()
    const configs = response?.data || response || []
    aiConfigs.value = (Array.isArray(configs) ? configs : []).map((config: UserAiConfigSummary) => ({
      ...config,
      userConfigId: Number(config.userConfigId),
      modelNames: config.modelNames || [],
    }))
  } catch (error) {
    aiConfigs.value = []
    aiConfigError.value = 'AI 配置服务暂不可用，请确认 service-ai 已启动'
    logWarn('AI 配置加载失败:', error)
  } finally {
    aiConfigLoading.value = false
  }
}

const openCreateModelDialog = () => {
  modelDialogMode.value = 'create'
  editingConfigId.value = null
  modelDialogVisible.value = true
}

const openEditModelDialog = (configId: number) => {
  modelDialogMode.value = 'edit'
  editingConfigId.value = configId
  modelDialogVisible.value = true
}

const removeModelConfig = async (config: UserAiConfigSummary) => {
  try {
    await ElMessageBox.confirm(
      `删除“${config.groupName}”后，题目页将无法继续使用其中的模型。`,
      '删除模型配置',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    await aiApi.deleteConfig(config.userConfigId)
    ElMessage.success('模型配置已删除')
    await loadAiConfigs()
  } catch (error: any) {
    // 取消不是错误；真实失败已由 request 拦截器统一提示。
    // 这里之前会把错误重新抛出，结果只多出一条未捕获的 promise rejection。
    if (error !== 'cancel' && error !== 'close') logWarn('删除模型配置失败:', error)
  }
}

const saveProfile = async () => {
  profileSaving.value = true
  try {
    let latestUser: Partial<UserDto> = { ...userInfo.value }
    const nickName = profileForm.nickName.trim()
    const bio = profileForm.bio.trim()
    const birthday = profileForm.birthday

    if (nickName && nickName !== userInfo.value.nickName) {
      const res: any = await userApi.updateNickName(nickName)
      latestUser = res?.data || res || latestUser
    }
    if (bio !== (userInfo.value.bio || '')) {
      const res: any = await userApi.updateBio(bio)
      latestUser = res?.data || res || latestUser
    }
    if (birthday && birthday !== userInfo.value.birthday) {
      const res: any = await userApi.updateBirthday(birthday)
      latestUser = res?.data || res || latestUser
    }

    applyUserInfo(latestUser)
    profileDialogVisible.value = false
    ElMessage.success('资料已更新')
  } catch (error) {
    // 请求失败已由拦截器统一提示；本地失败不经过拦截器，需要自己提示
    logWarn('保存资料失败:', error)
    if (isLocalFailure(error)) ElMessage.error(errorText(error, '保存资料失败，请稍后重试'))
  } finally {
    profileSaving.value = false
  }
}

const handleAvatarChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  avatarUploading.value = true
  try {
    const res: any = await userApi.uploadAvatar(file)
    const avatar = res?.data || res?.message || ''
    if (avatar && avatar !== 'success') {
      applyUserInfo({ ...userInfo.value, avatarUrl: avatar })
    } else {
      await loadProfile()
    }
    ElMessage.success('头像已更新')
  } catch (error) {
    // 请求失败已由拦截器统一提示；本地失败不经过拦截器，需要自己提示
    logWarn('上传头像失败:', error)
    if (isLocalFailure(error)) ElMessage.error(errorText(error, '上传头像失败，请稍后重试'))
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}

const getStatusClass = (status?: string) => (status === 'AC' ? 'success' : 'failed')

const formatDate = (date?: string) => {
  if (!date) return '未知时间'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const openRecordQuestion = (record: SubmitRecord) => {
  if (!record.questionId) return
  router.push({ path: '/questiondetailview', query: { questionId: record.questionId, from: '/profile' } })
}

const goHome = () => navigateTopLevel(router, '/home')
const selectProfileSection = async (section: 'overview' | 'content' | 'ai') => {
  profileSection.value = section
  if (section === 'content' && myContent.value.length === 0) await loadMyContent(true)
  if (section === 'ai' && aiConfigs.value.length === 0) await loadAiConfigs()
}
const goReview = () => navigateTopLevel(router, '/review')
const goDiscuss = () => navigateTopLevel(router, '/discuss')
const goFavorites = () => navigateTopLevel(router, '/favorites')
const handleProfileCommand = (command: string) => {
  if (command === 'avatar') {
    if (avatarUploading.value) return
    avatarInputRef.value?.click()
    return
  }
  if (command === 'profile') {
    openProfileDialog()
    return
  }
  if (command === 'password') {
    openPasswordDialog()
    return
  }
  if (command === 'logout') {
    void logoutAccount()
    return
  }
  if (command === 'freeze') {
    openFreezeDialog()
    return
  }
  if (command === 'delete') {
    void deleteAccount()
  }
}

/** 用户主动退出登录：先通知后端拉黑 token，再回登录页。 */
const logoutAccount = async () => {
  await userStore.logoutWithServer()
  await router.push('/login')
}

onMounted(async () => {
  await loadProfile()
  if (route.query.section === 'ai') {
    profileSection.value = 'ai'
    await loadAiConfigs()
    await nextTick()
    document.getElementById('ai-model-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})
</script>

<style scoped>
.profile-view {
  min-height: 100vh; min-height: 100dvh;
  min-height: 100dvh;
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
  font-family: var(--cw-font-sans);
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 58px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--cw-border);
}

.navbar-left,
.navbar-right,
.nav-menu {
  display: flex;
  align-items: center;
}

.navbar-left {
  gap: 32px;
}

.navbar-right {
  gap: 12px;
}

.logo,
.nav-item {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cw-text-1);
  font-size: 18px;
  font-weight: 700;
}

.logo-icon,
.nav-item.active,
.nav-item:hover {
  color: var(--cw-brand);
}

.nav-menu {
  gap: 4px;
}

.nav-item {
  padding: 7px 15px;
  border-radius: 6px;
  color: var(--cw-text-2);
  font-size: 14px;
  font-weight: 500;
}

.nav-item:hover {
  background: var(--cw-brand-soft);
}

.profile-shell {
  width: min(1180px, calc(100% - 56px));
  margin: 0 auto;
  padding: 34px 0 48px;
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 24px;
}

.profile-sidebar,
.profile-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.profile-card,
.side-card,
.stat-panel,
.achievement-card,
.activity-card,
.ai-settings-card {
  background: #ffffff;
  border: 1px solid var(--cw-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.profile-card {
  padding: 24px;
}

.profile-avatar {
  margin-bottom: 16px;
}

.profile-main h1 {
  margin: 0;
  color: var(--cw-text-1);
  font-size: 22px;
}

.profile-main p,
.profile-meta,
.bio {
  color: var(--cw-text-3);
}

.profile-main p {
  margin: 4px 0 10px;
}

.profile-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.bio {
  margin: 18px 0;
  line-height: 1.7;
  font-size: 14px;
}

.profile-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.edit-button {
  background: var(--cw-text-1);
  border-color: var(--cw-text-1);
}

.more-button {
  min-width: 84px;
}

.avatar-input {
  display: none;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.side-card {
  padding: 16px;
}

.side-card h2,
.stat-panel h2,
.section-header h2 {
  margin: 0;
  color: var(--cw-text-1);
  font-size: 16px;
}

.side-link {
  width: 100%;
  min-height: 36px;
  margin-top: 6px;
  padding: 0 12px;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--cw-text-2);
  text-align: left;
  cursor: pointer;
}

.side-link:hover,
.side-link.active {
  border-left-color: var(--cw-brand);
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 18px;
}

.stat-panel {
  padding: 22px;
}

.progress-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.progress-panel h2 {
  width: 100%;
}

.progress-ring {
  position: relative;
  width: 144px;
  height: 144px;
}

.progress-ring svg {
  width: 144px;
  height: 144px;
  transform: rotate(-90deg);
}

.ring-track,
.ring-value {
  fill: none;
  stroke-width: 10;
}

.ring-track {
  stroke: var(--cw-bg-page);
}

.ring-value {
  stroke: var(--cw-success);
  stroke-linecap: round;
}

.ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-text strong {
  color: var(--cw-text-1);
  font-size: 30px;
}

.ring-text span,
.section-header span {
  color: var(--cw-text-3);
  font-size: 13px;
}

.rank-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: stretch;
}

.rank-panel div {
  padding: 16px;
  border: 1px solid var(--cw-bg-subtle);
  border-radius: 8px;
  background: var(--cw-bg-page);
}

.rank-panel span,
.rank-panel strong {
  display: block;
}

.rank-panel span {
  color: var(--cw-text-3);
  font-size: 13px;
}

.rank-panel strong {
  margin-top: 12px;
  color: var(--cw-text-1);
  font-size: 24px;
}

.achievement-card,
.activity-card,
.ai-settings-card {
  padding: 20px;
}

.ai-settings-card {
  scroll-margin-top: 78px;
}

.ai-settings-card .section-header > div:first-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-config-list {
  display: flex;
  flex-direction: column;
}

.ai-config-item {
  min-height: 72px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--cw-bg-subtle);
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-config-item:last-child {
  border-bottom: 0;
}

.config-icon {
  width: 38px;
  height: 38px;
  border-radius: 7px;
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.config-main {
  min-width: 0;
  flex: 1;
}

.config-main strong,
.config-main span {
  display: block;
}

.config-main strong {
  color: #24272c;
  font-size: 14px;
}

.config-main span {
  margin-top: 5px;
  color: #898f98;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.content-header > div:first-child {
  min-width: 0;
}

.content-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.appeal-history-list {
  display: flex;
  flex-direction: column;
}

.appeal-history-item {
  padding: 12px 4px;
  border-bottom: 1px solid var(--cw-bg-subtle);
  cursor: pointer;
}

.appeal-history-item:last-child {
  border-bottom: none;
}

.appeal-history-item:hover {
  background: #f9fafb;
}

.appeal-history-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.appeal-history-head strong {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.appeal-history-reason {
  margin: 6px 0 0;
  font-size: 13px;
  color: #5b6470;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.my-content-list {
  display: flex;
  flex-direction: column;
}

.my-content-item {
  min-height: 72px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--cw-bg-subtle);
  display: flex;
  align-items: center;
  gap: 16px;
}

.my-content-main {
  flex: 1;
  min-width: 0;
}

.my-content-title-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.my-content-title-line strong {
  overflow: hidden;
  color: #24272c;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-content-item p {
  margin: 7px 0 4px;
  color: #676d76;
  font-size: 13px;
  line-height: 1.5;
}

.my-content-item small {
  color: var(--cw-text-3);
}

.my-content-more {
  padding-top: 10px;
  text-align: center;
}

.badge-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.achievement-badge {
  padding: 16px;
  border: 1px solid var(--cw-bg-subtle);
  border-radius: 8px;
  background: var(--cw-bg-page);
}

.badge-icon {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.badge-icon.orange {
  background: var(--cw-brand-soft);
  color: var(--cw-brand);
}

.badge-icon.green {
  background: #eefaf7;
  color: var(--cw-success);
}

.badge-icon.blue {
  background: #eef6ff;
  color: #2f7dd3;
}

.achievement-badge strong,
.achievement-badge small {
  display: block;
}

.achievement-badge strong {
  margin-top: 12px;
  color: var(--cw-text-1);
}

.achievement-badge small {
  margin-top: 4px;
  color: var(--cw-text-3);
}

.activity-list {
  max-height: 430px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-right: 6px;
}

.activity-list::-webkit-scrollbar {
  width: 6px;
}

.activity-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #d8dde5;
}

.activity-list::-webkit-scrollbar-track {
  background: transparent;
}

.activity-item {
  width: 100%;
  min-height: 66px;
  padding: 12px 4px;
  border: 0;
  border-bottom: 1px solid var(--cw-bg-subtle);
  background: transparent;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.activity-item:hover {
  background: var(--cw-brand-soft);
}

.activity-status {
  font-size: 22px;
}

.activity-status.success {
  color: var(--cw-success);
}

.activity-status.failed {
  color: var(--cw-danger);
}

.activity-main {
  flex: 1;
  min-width: 0;
}

.activity-main strong,
.activity-main small {
  display: block;
}

.activity-main strong {
  color: var(--cw-text-1);
}

.activity-main small {
  margin-top: 3px;
  color: var(--cw-text-3);
}

.state-line {
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--cw-text-3);
}

@media (max-width: 1024px) {
  .profile-shell,
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .badge-list,
  .rank-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  /* 主导航转成 .cw-offcanvas 抽屉；顶部留白与右侧簇按手机收窄 */
  .navbar {
    padding: 0 12px;
    gap: 8px;
  }

  .navbar-left {
    gap: 10px;
    min-width: 0;
  }

  .navbar-right {
    gap: 6px;
  }

  .profile-shell {
    width: calc(100% - 28px);
    padding-top: 18px;
  }
}

.reject-reason {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef0f0;
  border-left: 3px solid var(--cw-danger);
  border-radius: 4px;
  font-size: 13px;
  color: var(--cw-danger);
}

.my-content-actions {
  display: flex;
  gap: 8px;
}

.appeal-content-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--cw-bg-page);
  border-radius: 6px;
}
</style>

