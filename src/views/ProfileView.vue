﻿﻿﻿﻿﻿<template>
  <div class="profile-view">
    <header class="navbar">
      <div class="navbar-left">
        <button class="logo" type="button" @click="goHome">
          <span class="logo-icon">C</span>
          <span class="logo-text">CodeWise</span>
        </button>
        <nav class="nav-menu">
          <button class="nav-item" type="button" @click="goHome">题库</button>
          <button class="nav-item" type="button">竞赛</button>
          <button class="nav-item" type="button" @click="goDiscuss">讨论</button>
          <button class="nav-item" type="button" @click="goReview">复习</button>
        </nav>
      </div>
      <div class="navbar-right">
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
          <button class="side-link active" type="button">总览</button>
          <button class="side-link" type="button" @click="goHome">题库</button>
          <button class="side-link" type="button" @click="goReview">复习计划</button>
          <button class="side-link" type="button" @click="goFavorites">收藏夹</button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/User'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  CircleCheck,
  CircleClose,
  Loading,
  Location,
  Refresh,
  Star,
  Trophy,
} from '@element-plus/icons-vue'
import userApi from '@/api/userApi'
import questionApi from '@/api/questionApi'
import reviewApi from '@/api/reviewApi'
import { normalizeAvatarUrl } from '@/utils/avatar'
import type UserDto from '@/types/UserDto'
import type { FavoriteCollection } from '@/types/FavoriteProblem'

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
const userStore = useUserStore()
const loading = ref(false)
const profileSaving = ref(false)
const avatarUploading = ref(false)
const profileDialogVisible = ref(false)
const avatarInputRef = ref<HTMLInputElement | null>(null)
const userInfo = ref<Partial<UserDto>>({})
const submitRecords = ref<SubmitRecord[]>([])
const favorites = ref<FavoriteCollection[]>([])
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
    const [userRes, recordsRes, favoritesRes]: any[] = await Promise.all([
      localUserId.value ? userApi.getUserById(localUserId.value) : Promise.resolve(null),
      questionApi.getUserSubmitRecords({ pageSize: 30 }),
      reviewApi.listFavorites(),
    ])
    applyUserInfo(userRes?.data || userRes || {})
    submitRecords.value = getCursorRecords(recordsRes).map(normalizeRecord)
    favorites.value = favoritesRes?.data || favoritesRes || []
  } finally {
    loading.value = false
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

const goHome = () => router.push('/home')
const goReview = () => router.push('/review')
const goDiscuss = () => router.push('/discuss')
const goFavorites = () => router.push('/favorites')
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
    ElMessage.info('修改密码入口后续可以接到设置弹窗')
  }
}

onMounted(loadProfile)
</script>

<style scoped>
.profile-view {
  min-height: 100vh;
  background: #f6f7f9;
  color: #191c1e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
  border-bottom: 1px solid #e8ecf1;
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
  color: #1a1a2e;
  font-size: 18px;
  font-weight: 700;
}

.logo-icon,
.nav-item.active,
.nav-item:hover {
  color: #ffa116;
}

.nav-menu {
  gap: 4px;
}

.nav-item {
  padding: 7px 15px;
  border-radius: 6px;
  color: #4a4a4a;
  font-size: 14px;
  font-weight: 500;
}

.nav-item:hover {
  background: #fff8f0;
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
.activity-card {
  background: #ffffff;
  border: 1px solid #e8ecf1;
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
  color: #1a1a2e;
  font-size: 22px;
}

.profile-main p,
.profile-meta,
.bio {
  color: #6b7280;
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
  background: #262626;
  border-color: #262626;
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
  color: #1a1a2e;
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
  color: #4a4a4a;
  text-align: left;
  cursor: pointer;
}

.side-link:hover,
.side-link.active {
  border-left-color: #ffa116;
  background: #fff8f0;
  color: #d98200;
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
  stroke: #eef0f3;
}

.ring-value {
  stroke: #00b8a3;
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
  color: #1a1a2e;
  font-size: 30px;
}

.ring-text span,
.section-header span {
  color: #8c8c8c;
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
  border: 1px solid #edf0f3;
  border-radius: 8px;
  background: #fbfcfd;
}

.rank-panel span,
.rank-panel strong {
  display: block;
}

.rank-panel span {
  color: #8c8c8c;
  font-size: 13px;
}

.rank-panel strong {
  margin-top: 12px;
  color: #1a1a2e;
  font-size: 24px;
}

.achievement-card,
.activity-card {
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.badge-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.achievement-badge {
  padding: 16px;
  border: 1px solid #edf0f3;
  border-radius: 8px;
  background: #fbfcfd;
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
  background: #fff8f0;
  color: #ffa116;
}

.badge-icon.green {
  background: #eefaf7;
  color: #00a38f;
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
  color: #1a1a2e;
}

.achievement-badge small {
  margin-top: 4px;
  color: #8c8c8c;
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
  border-bottom: 1px solid #edf0f3;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.activity-item:hover {
  background: #fffdf9;
}

.activity-status {
  font-size: 22px;
}

.activity-status.success {
  color: #00a38f;
}

.activity-status.failed {
  color: #d64d4d;
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
  color: #1a1a2e;
}

.activity-main small {
  margin-top: 3px;
  color: #8c8c8c;
}

.state-line {
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #8c8c8c;
}

@media (max-width: 980px) {
  .profile-shell,
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .badge-list,
  .rank-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .nav-menu {
    display: none;
  }

  .profile-shell {
    width: calc(100% - 28px);
    padding-top: 18px;
  }
}
</style>
