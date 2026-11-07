<template>
  <div class="group-detail-page">
    <AppNavBar active="groups" />

    <main class="detail-shell">
      <div class="back-line">
        <el-button text :icon="ArrowLeft" @click="backToGroups">返回小组</el-button>
      </div>

      <el-alert
        v-if="loadError"
        class="page-error"
        type="error"
        :closable="false"
        :title="loadError"
      />

      <section v-if="group" v-loading="loading" class="group-hero panel">
        <div class="group-head">
          <div class="group-avatar">{{ avatarText(group.groupName) }}</div>
          <div class="group-head-main">
            <div class="title-row">
              <h1>{{ group.groupName }}</h1>
              <el-tag size="small" effect="plain">{{ GROUP_TYPE_LABELS[group.groupType] }}</el-tag>
              <el-tag v-if="isOwner" size="small" type="warning" effect="plain">组长</el-tag>
              <el-tag v-else-if="isMember" size="small" type="success" effect="plain">已加入</el-tag>
            </div>
            <p class="group-desc">{{ group.groupDescription || '暂无小组简介' }}</p>
            <div class="group-meta">
              <span>小组 ID：{{ group.groupId }}</span>
              <span>{{ group.memberCount || 0 }} 名成员</span>
              <span>创建于 {{ formatDate(group.createTime) }}</span>
            </div>
          </div>

          <div class="group-actions">
            <template v-if="isOwner">
              <el-button :icon="Edit" @click="openEdit">编辑</el-button>
              <el-button
                v-if="group.groupType === 'INVITE'"
                :icon="Promotion"
                @click="openInvite"
              >
                邀请成员
              </el-button>
            </template>
            <el-button
              v-if="isMember"
              type="danger"
              plain
              :loading="leaving"
              @click="handleLeave"
            >
              退出小组
            </el-button>
            <el-button
              v-else-if="memberState === 'non-member' && approvalSubmitted"
              disabled
            >
              已提交申请
            </el-button>
            <el-button
              v-else-if="memberState === 'non-member'"
              type="primary"
              :loading="joining"
              @click="handleJoin"
            >
              {{ group.groupType === 'APPROVAL' ? '申请加入' : '加入小组' }}
            </el-button>
            <el-button
              v-else-if="memberState === 'unknown'"
              :icon="Refresh"
              :loading="membershipChecking"
              @click="loadGroup"
            >
              重新检查
            </el-button>
          </div>
        </div>

        <div v-if="memberState === 'non-member'" class="join-strip">
          <p>{{ GROUP_TYPE_HINTS[group.groupType] }}</p>
          <div v-if="group.groupType === 'INVITE'" class="join-token-row">
            <el-input
              v-model="joinToken"
              maxlength="6"
              placeholder="6 位数字邀请码"
              class="join-token-input"
            />
            <span class="join-token-hint">邀请码由组内管理员通过站内信发送</span>
          </div>
          <p v-if="approvalSubmitted" class="join-tip">
            入组申请已提交，等待组长或管理员审批。审批接口暂未开放，请联系组长处理。
          </p>
          <p v-else-if="group.groupType === 'APPROVAL'" class="join-tip">
            申请提交后需要组长或管理员审批；当前后端尚未开放审批接口，请联系组长处理。
          </p>
          <div v-if="approvalSubmitted" class="join-token-row">
            <el-button size="small" :loading="canceling" @click="cancelApplication">
              撤销申请
            </el-button>
          </div>
        </div>
      </section>

      <section v-if="group && isMember" class="panel content-panel">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="小组题库" name="questions">
            <div class="question-toolbar">
              <div>
                <strong>{{ questions.length }}</strong>
                <span> 道题目</span>
              </div>
              <el-button type="primary" :icon="Plus" @click="openAddQuestion">添加题目</el-button>
            </div>

            <el-empty
              v-if="!questionsLoading && questions.length === 0"
              description="小组题库还是空的，先添加一道平台题目吧"
              :image-size="72"
            />

            <div v-else v-loading="questionsLoading" class="question-list">
              <article
                v-for="item in questions"
                :key="item.groupQuestionId"
                class="question-row"
                role="link"
                tabindex="0"
                @click="openQuestion(item)"
                @keydown.enter="openQuestion(item)"
              >
                <div class="question-main">
                  <div class="question-title-row">
                    <span class="question-id">#{{ item.dto.questionId }}</span>
                    <strong>{{ item.dto.title || '未命名题目' }}</strong>
                    <el-tag size="small" :type="difficultyTag(item.dto.difficulty)" effect="light">
                      {{ difficultyText(item.dto.difficulty) }}
                    </el-tag>
                    <el-tag v-if="item.dto.status === 0" size="small" type="info" effect="plain">已下架</el-tag>
                    <el-tag v-else-if="item.dto.status === 2" size="small" type="warning" effect="plain">审核中</el-tag>
                    <el-tag v-else-if="item.dto.status === 3" size="small" type="info" effect="plain">小组题</el-tag>
                  </div>
                  <div class="question-meta">
                    <span>{{ item.dto.totalSubmit || 0 }} 次提交</span>
                    <span>通过率 {{ passRateText(item.dto) }}%</span>
                    <span v-if="item.dto.tags" class="question-tags">{{ item.dto.tags }}</span>
                  </div>
                </div>
                <el-button
                  v-if="canManageQuestions"
                  text
                  type="danger"
                  :icon="Delete"
                  @click.stop="removeQuestion(item)"
                >
                  移除
                </el-button>
              </article>

              <div v-if="questionsHasNext" class="load-more">
                <el-button text type="primary" :loading="questionsLoading" @click="loadQuestions(false)">
                  加载更多
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="提交记录" name="submissions">
            <div class="question-toolbar">
              <div>
                <strong>{{ submitRecords.length }}</strong>
                <span> 条记录</span>
              </div>
              <el-button text type="primary" :icon="Refresh" @click="loadSubmissions(true)">刷新</el-button>
            </div>

            <el-empty
              v-if="!submissionsLoading && submitRecords.length === 0"
              description="组内还没有提交记录"
              :image-size="72"
            />

            <template v-else>
              <el-table
                v-loading="submissionsLoading"
                :data="submitRecords"
                stripe
                class="record-table"
              >
                <el-table-column label="题目" min-width="220">
                  <template #default="{ row }">
                    <span class="record-title">{{ row.questionTitle || `题目 ${row.questionId}` }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="提交人" width="180">
                  <template #default="{ row }">
                    <span class="record-user">
                      <el-avatar :size="24" :src="normalizeAvatarUrl(row.avatarUrl)">
                        {{ avatarText(row.nickName || '组员') }}
                      </el-avatar>
                      <span>{{ row.nickName || '组员' }}</span>
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" :type="statusTagType(row.status)">
                      {{ row.status || 'PENDING' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="提交时间" width="190">
                  <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
                </el-table-column>
              </el-table>

              <div v-if="submissionsHasNext" class="load-more">
                <el-button
                  text
                  type="primary"
                  :loading="submissionsLoading"
                  @click="loadSubmissions(false)"
                >
                  加载更多
                </el-button>
              </div>
            </template>
          </el-tab-pane>

          <el-tab-pane label="小组信息" name="about">
            <el-descriptions :column="2" border class="about-table">
              <el-descriptions-item label="小组名称">{{ group.groupName }}</el-descriptions-item>
              <el-descriptions-item label="小组 ID">{{ group.groupId }}</el-descriptions-item>
              <el-descriptions-item label="加入方式">
                {{ GROUP_TYPE_LABELS[group.groupType] }}
              </el-descriptions-item>
              <el-descriptions-item label="成员数">{{ group.memberCount || 0 }}</el-descriptions-item>
              <el-descriptions-item label="组长用户 ID">{{ group.userId }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatDate(group.createTime) }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ formatDate(group.updateTime) }}</el-descriptions-item>
              <el-descriptions-item label="简介" :span="2">
                {{ group.groupDescription || '暂无小组简介' }}
              </el-descriptions-item>
            </el-descriptions>
            <p class="about-tip">
              小组题库只对本组已加入成员可见；平台题目只建立小组索引，自建题目由小组共享维护。
            </p>
          </el-tab-pane>
        </el-tabs>
      </section>

      <section v-else-if="group && memberState === 'non-member'" class="panel locked-panel">
        <el-empty description="加入小组后可以查看小组题库与组内提交记录" :image-size="88" />
      </section>

      <section v-else-if="group && memberState === 'unknown'" class="panel locked-panel">
        <el-empty description="暂时无法确认你的成员身份，请点击右上角重新检查" :image-size="88" />
      </section>
    </main>

    <!-- 编辑小组 -->
    <el-dialog v-model="editVisible" title="编辑小组" width="480px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="小组名称" required>
          <el-input v-model="editForm.groupName" maxlength="40" show-word-limit />
        </el-form-item>
        <el-form-item label="小组简介">
          <el-input v-model="editForm.groupDescription" type="textarea" :rows="3" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="加入方式">
          <el-radio-group v-model="editForm.groupType" class="type-radios">
            <el-radio v-for="type in GROUP_TYPES" :key="type" :value="type" border>
              <span class="radio-label">{{ GROUP_TYPE_LABELS[type] }}</span>
              <small>{{ GROUP_TYPE_HINTS[type] }}</small>
            </el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editVisible = false">取消</el-button>
          <el-button type="primary" :loading="editSaving" @click="submitEdit">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 添加题目 -->
    <el-dialog v-model="addVisible" title="添加题目" width="620px">
      <el-radio-group v-model="addMode" class="add-mode">
        <el-radio-button value="platform">引用平台题目</el-radio-button>
        <el-radio-button value="custom">自建题目</el-radio-button>
      </el-radio-group>

      <div v-if="addMode === 'platform'" class="add-form">
        <el-form label-position="top">
          <el-form-item label="平台题目 ID" required>
            <el-input-number v-model="addForm.questionId" :min="1" :controls="false" placeholder="例如 1024" />
          </el-form-item>
        </el-form>
        <p class="form-tip">
          平台题目只会在小组题库中建立索引，题目本体与公开状态保持平台原样；仅公开题或你自己创建的私密题可以添加。
        </p>
      </div>

      <div v-else class="add-form">
        <el-form label-position="top">
          <el-form-item label="标题" required>
            <el-input v-model="addForm.title" maxlength="200" show-word-limit placeholder="题目名称" />
          </el-form-item>
          <el-form-item label="题目描述" required>
            <el-input v-model="addForm.description" type="textarea" :rows="4" placeholder="支持 Markdown" />
          </el-form-item>
          <div class="form-grid">
            <el-form-item label="输入描述">
              <el-input v-model="addForm.inputDesc" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="输出描述">
              <el-input v-model="addForm.outputDesc" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="样例输入">
              <el-input v-model="addForm.sampleInput" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="样例输出">
              <el-input v-model="addForm.sampleOutput" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="时间限制（ms）" required>
              <el-input-number v-model="addForm.timeLimit" :min="1" :step="100" />
            </el-form-item>
            <el-form-item label="内存限制（MB）" required>
              <el-input-number v-model="addForm.memoryLimit" :min="1" :step="32" />
            </el-form-item>
          </div>
          <el-form-item label="提示">
            <el-input v-model="addForm.hint" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="标签">
            <el-input v-model="addForm.tags" placeholder="逗号分隔，例如：数组,双指针" />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="addVisible = false">取消</el-button>
          <el-button type="primary" :loading="adding" @click="submitAddQuestion">添加</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 邀请成员 -->
    <el-dialog v-model="inviteVisible" title="邀请成员" width="520px">
      <div class="invite-body">
        <div class="invite-search">
          <el-input
            v-model="inviteKeyword"
            placeholder="输入昵称或用户名搜索用户"
            clearable
            @keyup.enter="searchInviteUsers"
          />
          <el-button :loading="inviteSearching" @click="searchInviteUsers">搜索</el-button>
        </div>
        <p class="form-tip">搜索接口每分钟最多 5 次，请避免连续点击。</p>

        <div v-if="inviteResults.length" class="invite-results">
          <button
            v-for="user in inviteResults"
            :key="user.userId"
            type="button"
            class="invite-user"
            :class="{ active: inviteTarget?.userId === user.userId }"
            @click="inviteTarget = user"
          >
            <el-avatar :size="30" :src="normalizeAvatarUrl(user.avatarUrl)">
              {{ avatarText(user.nickName || user.userName || '用户') }}
            </el-avatar>
            <span class="invite-user-copy">
              <strong>{{ user.nickName || user.userName || '用户' }}</strong>
              <small>@{{ user.userName || user.userId }} · ID {{ user.userId }}</small>
            </span>
            <el-icon v-if="inviteTarget?.userId === user.userId" class="invite-check">
              <Check />
            </el-icon>
          </button>
        </div>

        <el-form label-position="top" class="invite-form">
          <el-form-item label="邀请留言">
            <el-input
              v-model="inviteContent"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="可选，会随邀请站内信一起发送"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="inviteVisible = false">取消</el-button>
          <el-button type="primary" :loading="inviteSending" @click="sendInvite">
            发送邀请
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 小组详情页。
 *
 * 后端当前暴露的能力：小组基础信息、题库增删查、加入/退出、邀请码邀请、组内提交记录。
 * 没有「成员列表 / 待审批列表 / 广播」公开接口，因此页面上：
 *  - 成员身份用「题库列表是否可读」探测（非成员返回 4041101）；
 *  - 管理员角色无法从接口取得，管理入口只对组长（group.userId == 当前用户）展示，
 *    ADMIN 仍可通过接口操作，只是前端不显示入口；
 *  - APPROVAL 小组会提示审批接口尚未开放。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Check,
  Delete,
  Edit,
  Plus,
  Promotion,
  Refresh,
} from '@element-plus/icons-vue'
import AppNavBar from '@/components/layout/AppNavBar.vue'
import groupApi, {
  GROUP_TYPE_HINTS,
  GROUP_TYPE_LABELS,
  type GroupInfo,
  type GroupQuestionBrief,
  type GroupQuestionCursorPage,
  type GroupQuestionItem,
  type GroupQuestionPayload,
  type GroupSubmitRecord,
  type GroupSubmitRecordPage,
  type GroupType,
} from '@/api/groupApi'
import userApi from '@/api/userApi'
import type UserDto from '@/types/UserDto'
import { errorText, isLocalFailure, unwrap } from '@/api/request'
import { logWarn } from '@/utils/logger'
import { normalizeAvatarUrl } from '@/utils/avatar'
import { useUserStore } from '@/stores/User'
import { forgetRecentGroup, rememberRecentGroup } from '@/utils/recentGroups'

type TagType = 'success' | 'warning' | 'danger' | 'info'
type MemberState = 'checking' | 'member' | 'non-member' | 'unknown'
type TabKey = 'questions' | 'submissions' | 'about'

const GROUP_TYPES: GroupType[] = ['FREE', 'APPROVAL', 'INVITE']

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const groupId = computed(() => {
  const raw = route.params.groupId
  return String(Array.isArray(raw) ? raw[0] : raw || '')
})

const loading = ref(false)
const loadError = ref('')
const group = ref<GroupInfo | null>(null)
const isOwner = ref(false)
const memberState = ref<MemberState>('checking')
const isMember = computed(() => memberState.value === 'member')
const canManageQuestions = computed(() => isOwner.value)
const membershipChecking = computed(() => memberState.value === 'checking')
const joining = ref(false)
const leaving = ref(false)
const canceling = ref(false)
const joinToken = ref('')
/** APPROVAL 小组 join 成功只代表「申请已提交」，接口无法区分 PENDING/APPROVED。 */
const approvalSubmitted = ref(false)
const activeTab = ref<TabKey>('questions')

// 组件会在路由参数变化时复用；用序号丢弃旧请求，避免慢响应覆盖新小组的数据。
let groupLoadSeq = 0
let questionLoadSeq = 0
let submissionLoadSeq = 0
let inviteSearchSeq = 0

const currentUserId = () => String(userStore.getUserId || 'guest')

/** APPROVAL 的「已申请」后端无法查询，这里按用户 + 小组在本地记住，刷新后仍能提示。 */
function pendingKey(targetGroupId: string) {
  return `codewise_group_pending_${currentUserId()}_${targetGroupId}`
}

function readPending(targetGroupId: string) {
  try {
    return localStorage.getItem(pendingKey(targetGroupId)) === '1'
  } catch {
    return false
  }
}

function writePending(targetGroupId: string, pending: boolean) {
  try {
    if (pending) localStorage.setItem(pendingKey(targetGroupId), '1')
    else localStorage.removeItem(pendingKey(targetGroupId))
  } catch {
    // 本地存储不可用时只影响刷新后的提示
  }
}

const questions = ref<GroupQuestionItem[]>([])
const questionsLoading = ref(false)
const questionsHasNext = ref(false)
const questionNextCursor = ref<string | null>(null)

const submitRecords = ref<GroupSubmitRecord[]>([])
const submissionsLoading = ref(false)
const submissionsHasNext = ref(false)
const submissionsNextCursor = ref<string | null>(null)
const submissionsLoaded = ref(false)

const addVisible = ref(false)
const adding = ref(false)
const addMode = ref<'platform' | 'custom'>('platform')
const addForm = reactive({
  questionId: undefined as number | undefined,
  title: '',
  description: '',
  inputDesc: '',
  outputDesc: '',
  sampleInput: '',
  sampleOutput: '',
  hint: '',
  tags: '',
  timeLimit: 1000,
  memoryLimit: 256,
})

const editVisible = ref(false)
const editSaving = ref(false)
const editForm = reactive({
  groupName: '',
  groupDescription: '',
  groupType: 'FREE' as GroupType,
})

const inviteVisible = ref(false)
const inviteSearching = ref(false)
const inviteSending = ref(false)
const inviteKeyword = ref('')
const inviteResults = ref<UserDto[]>([])
const inviteTarget = ref<UserDto | null>(null)
const inviteContent = ref('')

onMounted(() => {
  const rawToken = Array.isArray(route.query.token) ? route.query.token[0] : route.query.token
  if (rawToken) joinToken.value = String(rawToken)
  void loadGroup()
})

watch(activeTab, (tab) => {
  if (tab === 'submissions' && !submissionsLoaded.value) {
    void loadSubmissions(true)
  }
})

// 组件按路由 name 复用：直接在两个小组之间前进/后退时不会重新挂载，需要手动换数据。
watch(groupId, (value, previous) => {
  if (!value || value === previous) return
  // 先让所有进行中的请求作废，再清空页面数据。
  groupLoadSeq += 1
  questionLoadSeq += 1
  submissionLoadSeq += 1
  inviteSearchSeq += 1
  group.value = null
  loadError.value = ''
  questions.value = []
  submitRecords.value = []
  // 旧请求的 finally 因序号已变化不会再执行，这里主动复位加载态。
  questionsLoading.value = false
  submissionsLoading.value = false
  questionsHasNext.value = false
  submissionsHasNext.value = false
  questionNextCursor.value = null
  submissionsNextCursor.value = null
  submissionsLoaded.value = false
  approvalSubmitted.value = false
  activeTab.value = 'questions'
  void loadGroup()
})

function backToGroups() {
  router.push('/groups')
}

async function loadGroup() {
  const targetGroupId = groupId.value
  if (!targetGroupId) {
    loadError.value = '缺少小组 ID'
    memberState.value = 'unknown'
    return
  }
  const requestId = ++groupLoadSeq
  loading.value = true
  loadError.value = ''
  memberState.value = 'checking'
  try {
    const result = await groupApi.getGroup(targetGroupId, true)
    if (requestId !== groupLoadSeq || targetGroupId !== groupId.value) return
    const info = unwrap<GroupInfo | null>(result, null)
    if (!info) {
      loadError.value = '小组不存在或已被删除'
      memberState.value = 'unknown'
      return
    }
    group.value = info
    isOwner.value = String(info.userId) === String(userStore.getUserId || '')
    rememberRecentGroup(info)
    await probeMembership(targetGroupId, requestId)
  } catch (error) {
    if (requestId !== groupLoadSeq || targetGroupId !== groupId.value) return
    loadError.value = errorText(error, '小组信息加载失败，请稍后重试')
    memberState.value = 'unknown'
    logWarn('加载小组信息失败:', error)
  } finally {
    // 只有最后一次请求能结束 loading，避免旧请求提前关掉新请求的加载态。
    if (requestId === groupLoadSeq) loading.value = false
  }
}

/**
 * 成员身份探测：题库列表是当前唯一「仅成员可读」的接口。
 *
 * 用 silent 请求，非成员返回 4041101 时不应弹全局错误；
 * 其他失败（网络/服务异常）标记为 unknown，不能误判成「未加入」。
 */
async function probeMembership(targetGroupId: string, requestId: number) {
  memberState.value = 'checking'
  try {
    const result = await groupApi.listQuestions(targetGroupId, { pageSize: 20 }, true)
    if (requestId !== groupLoadSeq || targetGroupId !== groupId.value) return
    const page = unwrap<GroupQuestionCursorPage | null>(result, null)
    memberState.value = 'member'
    approvalSubmitted.value = false
    writePending(targetGroupId, false)
    applyQuestionPage(page, true)
  } catch (error) {
    if (requestId !== groupLoadSeq || targetGroupId !== groupId.value) return
    const bizCode = (error as { bizCode?: number } | null)?.bizCode
    if (bizCode === 4041101) {
      memberState.value = 'non-member'
      approvalSubmitted.value = readPending(targetGroupId)
    } else {
      memberState.value = 'unknown'
      logWarn('探测小组成员身份失败:', error)
    }
  }
}

function mapQuestionItem(raw: any): GroupQuestionItem {
  return {
    groupQuestionId: String(raw?.groupQuestionId ?? ''),
    dto: {
      ...(raw?.dto || {}),
      questionId: String(raw?.dto?.questionId ?? ''),
    },
  }
}

function applyQuestionPage(page: GroupQuestionCursorPage | null, reset: boolean) {
  const records = Array.isArray(page?.records) ? page!.records.map(mapQuestionItem) : []
  questions.value = reset ? records : [...questions.value, ...records]
  questionNextCursor.value = page?.nextCursor == null ? null : String(page.nextCursor)
  questionsHasNext.value = Boolean(page?.hasNext)
}

async function loadQuestions(reset: boolean) {
  if (!isMember.value || questionsLoading.value) return
  const targetGroupId = groupId.value
  const requestId = ++questionLoadSeq
  questionsLoading.value = true
  try {
    const result = await groupApi.listQuestions(targetGroupId, {
      pageSize: 20,
      lastId: reset ? null : questionNextCursor.value,
    })
    if (requestId !== questionLoadSeq || targetGroupId !== groupId.value) return
    const page = unwrap<GroupQuestionCursorPage | null>(result, null)
    applyQuestionPage(page, reset)
  } catch (error) {
    if (requestId === questionLoadSeq) logWarn('加载小组题库失败:', error)
  } finally {
    if (requestId === questionLoadSeq) questionsLoading.value = false
  }
}

function mapSubmitRecord(raw: any): GroupSubmitRecord {
  return {
    groupSubmitRecordId: String(raw?.groupSubmitRecordId ?? ''),
    submitRecordId: String(raw?.submitRecordId ?? ''),
    questionId: String(raw?.questionId ?? ''),
    questionTitle: raw?.questionTitle || '',
    nickName: raw?.nickName || null,
    avatarUrl: raw?.avatarUrl || null,
    status: raw?.status || null,
    createTime: raw?.createTime,
  }
}

async function loadSubmissions(reset: boolean) {
  if (!isMember.value || submissionsLoading.value) return
  const targetGroupId = groupId.value
  const requestId = ++submissionLoadSeq
  submissionsLoading.value = true
  try {
    const result = await groupApi.listSubmitRecords(targetGroupId, {
      pageSize: 20,
      lastId: reset ? null : submissionsNextCursor.value,
    })
    if (requestId !== submissionLoadSeq || targetGroupId !== groupId.value) return
    const page = unwrap<GroupSubmitRecordPage | null>(result, null)
    const records = Array.isArray(page?.records) ? page!.records.map(mapSubmitRecord) : []
    submitRecords.value = reset ? records : [...submitRecords.value, ...records]
    submissionsNextCursor.value = page?.nextCursor == null ? null : String(page.nextCursor)
    submissionsHasNext.value = Boolean(page?.hasNext)
    submissionsLoaded.value = true
  } catch (error) {
    if (requestId === submissionLoadSeq) logWarn('加载小组提交记录失败:', error)
  } finally {
    if (requestId === submissionLoadSeq) submissionsLoading.value = false
  }
}

function openQuestion(item: GroupQuestionItem) {
  router.push({
    name: 'group-question',
    params: { groupId: groupId.value, groupQuestionId: item.groupQuestionId },
  })
}

function avatarText(name: string) {
  return (name || '小组').slice(0, 2)
}

function difficultyText(value?: number | null) {
  const map: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }
  return map[Number(value)] || '未标注'
}

function difficultyTag(value?: number | null): TagType {
  const map: Record<number, TagType> = { 1: 'success', 2: 'warning', 3: 'danger' }
  return map[Number(value)] || 'info'
}

function passRateText(item: GroupQuestionBrief) {
  const total = Number(item.totalSubmit || 0)
  if (!total) return '0.0'
  return ((Number(item.totalAc || 0) / total) * 100).toFixed(1)
}

function statusTagType(status?: string | null): TagType {
  if (status === 'AC') return 'success'
  if (!status || status === 'PENDING') return 'info'
  return 'danger'
}

function formatDate(value?: string) {
  if (!value) return '未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function handleJoin() {
  if (!group.value) return
  const targetGroupId = groupId.value
  const targetGroupType = group.value.groupType
  if (targetGroupType === 'INVITE' && !joinToken.value.trim()) {
    ElMessage.warning('该小组需要邀请码，请先填写')
    return
  }
  joining.value = true
  try {
    await groupApi.joinGroup(targetGroupId, joinToken.value.trim() || undefined)
    if (targetGroupId !== groupId.value) return
    if (targetGroupType === 'APPROVAL') {
      // 后端对所有成功路径都返回 data:true，无法区分 PENDING / APPROVED，
      // 这里按「申请已提交」处理，不重新探测成员身份。
      approvalSubmitted.value = true
      writePending(targetGroupId, true)
      ElMessage.success('入组申请已提交，等待管理员审批')
    } else {
      ElMessage.success('已加入小组')
      await loadGroup()
    }
  } catch (error) {
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '加入小组失败'))
    }
  } finally {
    joining.value = false
  }
}

/** 撤销 APPROVAL 小组的待审批申请：后端允许 PENDING 记录调用退出接口。 */
async function cancelApplication() {
  const targetGroupId = groupId.value
  canceling.value = true
  try {
    await groupApi.leaveGroup(targetGroupId)
    writePending(targetGroupId, false)
    if (targetGroupId === groupId.value) approvalSubmitted.value = false
    ElMessage.success('已撤销入组申请')
  } catch (error) {
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '撤销申请失败'))
    }
  } finally {
    canceling.value = false
  }
}

async function handleLeave() {
  if (!group.value) return
  try {
    await ElMessageBox.confirm(
      '退出后将无法查看该小组题库。如果你是组长，会自动把组长转交给其他成员；如果你是最后一名成员，小组会被删除。',
      '退出小组',
      { type: 'warning', confirmButtonText: '退出', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  leaving.value = true
  const targetGroupId = groupId.value
  try {
    await groupApi.leaveGroup(targetGroupId)
    writePending(targetGroupId, false)
    forgetRecentGroup(targetGroupId)
    ElMessage.success('已退出小组')
    router.replace('/groups')
  } catch (error) {
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '退出小组失败'))
    }
  } finally {
    leaving.value = false
  }
}

function openEdit() {
  if (!group.value) return
  editForm.groupName = group.value.groupName
  editForm.groupDescription = group.value.groupDescription || ''
  editForm.groupType = group.value.groupType
  editVisible.value = true
}

async function submitEdit() {
  const groupName = editForm.groupName.trim()
  if (!groupName) {
    ElMessage.warning('请输入小组名称')
    return
  }
  editSaving.value = true
  try {
    await groupApi.updateGroup({
      groupId: groupId.value,
      groupName,
      groupDescription: editForm.groupDescription.trim() || undefined,
      groupType: editForm.groupType,
    })
    // 后端更新响应是不完整的 Group（memberCount/createTime 为 null，userId 变成操作人），
    // 不能拿它覆盖本地对象，否则会把组长误判成自己。只合并本次修改的字段。
    if (group.value) {
      group.value = {
        ...group.value,
        groupName,
        groupDescription: editForm.groupDescription.trim(),
        groupType: editForm.groupType,
      }
    }
    editVisible.value = false
    ElMessage.success('小组信息已更新')
  } catch (error) {
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '保存小组信息失败'))
    }
  } finally {
    editSaving.value = false
  }
}

function openAddQuestion() {
  addMode.value = 'platform'
  addForm.questionId = undefined
  addForm.title = ''
  addForm.description = ''
  addForm.inputDesc = ''
  addForm.outputDesc = ''
  addForm.sampleInput = ''
  addForm.sampleOutput = ''
  addForm.hint = ''
  addForm.tags = ''
  addForm.timeLimit = 1000
  addForm.memoryLimit = 256
  addVisible.value = true
}

async function submitAddQuestion() {
  let payload: GroupQuestionPayload
  if (addMode.value === 'platform') {
    if (!addForm.questionId || addForm.questionId <= 0) {
      ElMessage.warning('请输入平台题目 ID')
      return
    }
    payload = { questionId: Number(addForm.questionId) }
  } else {
    if (!addForm.title.trim()) {
      ElMessage.warning('请输入题目标题')
      return
    }
    if (!addForm.description.trim()) {
      ElMessage.warning('请输入题目描述')
      return
    }
    payload = {
      title: addForm.title.trim(),
      description: addForm.description.trim(),
      inputDesc: addForm.inputDesc.trim(),
      outputDesc: addForm.outputDesc.trim(),
      sampleInput: addForm.sampleInput,
      sampleOutput: addForm.sampleOutput,
      hint: addForm.hint.trim(),
      tags: addForm.tags.trim(),
      timeLimit: Number(addForm.timeLimit),
      memoryLimit: Number(addForm.memoryLimit),
    }
  }

  adding.value = true
  try {
    await groupApi.addQuestion(groupId.value, payload)
    ElMessage.success('题目已加入小组题库')
    addVisible.value = false
    await loadQuestions(true)
  } catch (error) {
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '添加题目失败'))
    }
  } finally {
    adding.value = false
  }
}

async function removeQuestion(item: GroupQuestionItem) {
  try {
    await ElMessageBox.confirm(
      `确定把「${item.dto.title || '该题目'}」移出小组题库吗？平台题目只会移除小组索引。`,
      '移除题目',
      { type: 'warning', confirmButtonText: '移除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await groupApi.deleteQuestion(groupId.value, item.groupQuestionId)
    questions.value = questions.value.filter(
      (question) => question.groupQuestionId !== item.groupQuestionId,
    )
    ElMessage.success('题目已移出小组题库')
  } catch (error) {
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '移除题目失败'))
    }
  }
}

function openInvite() {
  inviteSearchSeq += 1
  inviteKeyword.value = ''
  inviteResults.value = []
  inviteTarget.value = null
  inviteContent.value = ''
  inviteSearching.value = false
  inviteVisible.value = true
}

async function searchInviteUsers() {
  const name = inviteKeyword.value.trim()
  if (!name) {
    ElMessage.warning('请输入昵称或用户名')
    return
  }
  const requestId = ++inviteSearchSeq
  // 新搜索必须清掉上一次选择，否则不改选直接发送会发给旧用户。
  inviteTarget.value = null
  inviteResults.value = []
  inviteSearching.value = true
  try {
    const result = await userApi.findUsers({ name }, true)
    if (requestId !== inviteSearchSeq) return
    inviteResults.value = unwrap<UserDto[]>(result, [])
    if (inviteResults.value.length === 0) ElMessage.info('没有找到匹配的用户')
  } catch (error) {
    if (requestId !== inviteSearchSeq) return
    // 后端搜索无结果时返回 4040101，而不是空数组。
    if ((error as { bizCode?: number } | null)?.bizCode === 4040101) {
      inviteResults.value = []
      ElMessage.info('没有找到匹配的用户')
    } else {
      // 搜索接口是 silent 的（为了自定义 404 文案），其他失败必须在这里补提示。
      ElMessage.error(errorText(error, '搜索用户失败'))
      logWarn('搜索邀请用户失败:', error)
    }
  } finally {
    if (requestId === inviteSearchSeq) inviteSearching.value = false
  }
}

async function sendInvite() {
  if (!inviteTarget.value) {
    ElMessage.warning('请先搜索并选择要邀请的用户')
    return
  }
  // 搜索接口返回的 userId 是字符串，发送邀请的 DTO 是 Long，这里显式转成数字。
  const toUserId = Number(inviteTarget.value.userId)
  if (!Number.isFinite(toUserId) || toUserId <= 0) {
    ElMessage.error('该用户 ID 无效，请重新搜索')
    return
  }
  const targetGroupId = groupId.value
  inviteSending.value = true
  try {
    await groupApi.sendInvitation(targetGroupId, {
      toUserId,
      content: inviteContent.value.trim() || undefined,
    })
    if (targetGroupId !== groupId.value) return
    ElMessage.success('邀请码已通过站内信发送')
    inviteVisible.value = false
  } catch (error) {
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '发送邀请失败'))
    }
  } finally {
    inviteSending.value = false
  }
}
</script>

<style scoped>
.group-detail-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--cw-bg-page);
}

.detail-shell {
  width: min(1080px, calc(100% - 48px));
  margin: 0 auto;
  padding: 18px 0 56px;
}

.back-line {
  margin-bottom: 10px;
}

.page-error {
  margin-bottom: 16px;
}

.panel {
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius-lg);
  background: var(--cw-bg-card);
  box-shadow: var(--cw-shadow-card);
}

.group-hero {
  padding: 24px;
}

.group-head {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}

.group-avatar {
  width: 64px;
  height: 64px;
  border-radius: var(--cw-radius-lg);
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
  font-size: 22px;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.group-head-main {
  flex: 1 1 auto;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.title-row h1 {
  margin: 0;
  color: var(--cw-text-1);
  font-size: 26px;
  line-height: 1.25;
}

.group-desc {
  margin: 8px 0 0;
  color: var(--cw-text-2);
  font-size: 14px;
  line-height: 1.6;
}

.group-meta {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--cw-text-3);
  font-size: 12px;
}

.group-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  flex: 0 0 auto;
}

.join-strip {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed var(--cw-border);
}

.join-strip > p {
  margin: 0;
  color: var(--cw-text-2);
  font-size: 13px;
}

.join-token-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.join-token-input {
  width: 220px;
}

.join-token-hint {
  color: var(--cw-text-3);
  font-size: 12px;
}

.join-tip {
  margin-top: 8px !important;
  color: var(--cw-warning) !important;
  font-size: 12px !important;
}

.content-panel {
  margin-top: 18px;
  padding: 8px 24px 24px;
}

.question-toolbar {
  min-height: 42px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--cw-text-3);
  font-size: 13px;
}

.question-toolbar strong {
  color: var(--cw-text-1);
  font-size: 16px;
}

.question-list {
  display: flex;
  flex-direction: column;
}

.question-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-top: 1px solid var(--cw-border);
  cursor: pointer;
  transition: background-color 160ms ease;
}

.question-row:hover {
  background: var(--cw-bg-page);
}

.question-main {
  flex: 1 1 auto;
  min-width: 0;
}

.question-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.question-title-row strong {
  overflow: hidden;
  color: var(--cw-text-1);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-id {
  flex: 0 0 auto;
  color: var(--cw-text-faint);
  font-family: var(--cw-font-mono);
  font-size: 12px;
}

.question-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: var(--cw-text-3);
  font-size: 12px;
}

.question-tags {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.load-more {
  padding: 16px 0 4px;
  display: flex;
  justify-content: center;
}

.record-table {
  border-radius: var(--cw-radius);
}

.record-title {
  color: var(--cw-text-1);
  font-size: 13px;
}

.record-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--cw-text-2);
  font-size: 13px;
}

.about-table {
  margin-top: 6px;
}

.about-tip {
  margin: 16px 0 0;
  color: var(--cw-text-3);
  font-size: 12px;
  line-height: 1.6;
}

.locked-panel {
  margin-top: 18px;
  padding: 18px;
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

.add-mode {
  margin-bottom: 16px;
}

.add-form {
  max-height: 56vh;
  overflow-y: auto;
  padding-right: 4px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.form-tip {
  margin: 0;
  color: var(--cw-text-3);
  font-size: 12px;
  line-height: 1.6;
}

.invite-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.invite-search {
  display: flex;
  gap: 8px;
}

.invite-results {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius);
}

.invite-user {
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--cw-border);
  background: var(--cw-bg-card);
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  cursor: pointer;
}

.invite-user:last-child {
  border-bottom: 0;
}

.invite-user:hover,
.invite-user.active {
  background: var(--cw-brand-soft);
}

.invite-user-copy {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.invite-user-copy strong {
  overflow: hidden;
  color: var(--cw-text-1);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invite-user-copy small {
  overflow: hidden;
  color: var(--cw-text-3);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invite-check {
  color: var(--cw-brand-dark);
}

.invite-form {
  margin-top: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1024px) {
  .detail-shell {
    width: calc(100% - 32px);
  }

  .content-panel {
    padding: 6px 16px 20px;
  }
}

@media (max-width: 768px) {
  .detail-shell {
    padding: 12px 0 40px;
  }

  .group-hero {
    padding: 18px 16px;
  }

  .group-head {
    flex-wrap: wrap;
  }

  .group-avatar {
    width: 52px;
    height: 52px;
    font-size: 18px;
  }

  .title-row h1 {
    font-size: 21px;
  }

  .group-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .join-token-row {
    align-items: stretch;
    flex-direction: column;
  }

  .join-token-input {
    width: 100%;
  }

  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .add-form {
    max-height: 48vh;
  }

  .record-table :deep(.el-table__body-wrapper) {
    overflow-x: auto;
  }
}
</style>
