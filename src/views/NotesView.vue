<template>
  <div class="notes-view">
    <AppNavBar active="home">
      <template #actions>
        <MobileNavToggle purpose="sidebar" :open="nav.open.value" :icon="Folder" label="打开文件夹" @toggle="nav.toggle" />
      </template>
    </AppNavBar>

    <div class="main-container">
      <!-- 左：文件夹栏 -->
      <aside class="folder-panel cw-offcanvas" :class="{ 'is-open': nav.open.value }">
        <div class="panel-header">
          <span class="panel-title">文件夹</span>
          <el-button :icon="FolderAdd" text size="small" title="新建文件夹" @click="createFolder" />
        </div>

        <div class="folder-list">
          <div
            class="folder-item"
            :class="{ active: activeFolder === ALL_FOLDER }"
            @click="selectFolder(ALL_FOLDER)"
          >
            <el-icon><Collection /></el-icon>
            <span class="folder-name">全部笔记</span>
          </div>
          <div
            class="folder-item"
            :class="{ active: activeFolder === UNCATEGORIZED }"
            @click="selectFolder(UNCATEGORIZED)"
          >
            <el-icon><Document /></el-icon>
            <span class="folder-name">未分类</span>
          </div>

          <div
            v-for="folder in folders"
            :key="String(folder.folderId)"
            class="folder-item"
            :class="{ active: activeFolder === String(folder.folderId) }"
            @click="selectFolder(String(folder.folderId))"
          >
            <el-icon><Folder /></el-icon>
            <span class="folder-name">{{ folder.folderName }}</span>
            <span class="folder-count">{{ folder.noteCount }}</span>
            <span class="folder-ops" @click.stop>
              <el-icon title="重命名" @click="renameFolder(folder)"><EditPen /></el-icon>
              <el-icon title="删除（连同其中笔记）" class="danger" @click="removeFolder(folder)"><Delete /></el-icon>
            </span>
          </div>

          <el-empty v-if="!foldersLoading && folders.length === 0" description="暂无文件夹" :image-size="56" />
        </div>
      </aside>

      <!-- 中：笔记列表 -->
      <aside class="note-list-panel">
        <div class="panel-header">
          <span class="panel-title">{{ currentFolderLabel }}</span>
          <el-button :icon="Plus" text size="small" title="新建笔记" @click="startCreate" />
        </div>

        <div v-loading="notesLoading" class="note-list">
          <el-empty v-if="!notesLoading && notes.length === 0" description="暂无笔记" :image-size="72" />
          <div
            v-for="note in notes"
            :key="String(note.noteId)"
            class="note-item"
            :class="{ active: currentNoteId === String(note.noteId) }"
            @click="selectNote(note)"
          >
            <div class="note-item-title">{{ note.title || '无标题笔记' }}</div>
            <div class="note-item-preview">{{ note.preview || '（空内容）' }}</div>
            <div class="note-item-time">{{ note.updateTime ? fmtTime(note.updateTime) : '' }}</div>
          </div>

          <div v-if="hasNext" class="load-more">
            <el-button text type="primary" :loading="notesLoading" @click="loadMore">加载更多</el-button>
          </div>
        </div>
      </aside>

      <!-- 右：编辑器 -->
      <main class="editor-panel">
        <template v-if="currentNoteId || isCreating">
          <div class="editor-toolbar">
            <el-input
              v-model="editor.title"
              placeholder="笔记标题（留空则自动生成）"
              class="title-input"
              maxlength="255"
            />
            <el-select
              v-model="editor.folderId"
              class="folder-select"
              placeholder="移动到文件夹"
              @change="moveCurrentNote"
            >
              <el-option label="未分类" :value="UNCATEGORIZED" />
              <el-option
                v-for="folder in folders"
                :key="String(folder.folderId)"
                :label="folder.folderName"
                :value="String(folder.folderId)"
              />
            </el-select>

            <div class="toolbar-actions">
              <el-radio-group v-model="editorMode" size="small">
                <el-radio-button value="edit">编辑</el-radio-button>
                <el-radio-button value="preview">预览</el-radio-button>
              </el-radio-group>
              <el-button
                type="primary"
                :loading="savingNote"
                :disabled="editorMode === 'preview'"
                @click="saveNote"
              >
                保存
              </el-button>
              <el-button v-if="!isCreating" type="danger" plain @click="removeNote">删除</el-button>
            </div>
          </div>

          <div class="editor-body">
            <el-input
              v-show="editorMode === 'edit'"
              v-model="editor.content"
              type="textarea"
              class="markdown-input"
              :autosize="false"
              placeholder="用 Markdown 记录你的笔记……"
            />
            <div
              v-show="editorMode === 'preview'"
              class="markdown-preview markdown-body"
              v-html="previewHtml"
            ></div>
          </div>
        </template>

        <div v-else class="editor-empty">
          <el-icon><Notebook /></el-icon>
          <p>选择左侧一条笔记，或点击右上角「+」新建笔记</p>
        </div>
      </main>
    </div>

    <MobileNavBackdrop v-if="nav.open.value" @close="nav.close" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Collection, Delete, Document, EditPen, Folder, FolderAdd, Notebook, Plus } from '@element-plus/icons-vue'
import AppNavBar from '@/components/layout/AppNavBar.vue'
import MobileNavToggle from '@/components/layout/MobileNavToggle.vue'
import MobileNavBackdrop from '@/components/layout/MobileNavBackdrop.vue'
import { useMobileNav } from '@/composables/useMobileNav'
import noteApi, {
  type NoteBriefVo,
  type NoteDetailVo,
  type NoteFolderVo,
} from '@/api/noteApi'
import { renderMarkdown } from '@/utils/markdown'
import { logWarn } from '@/utils/logger'

/** 「全部笔记」的虚拟文件夹 key（不映射为 folderId） */
const ALL_FOLDER = '__all__'
/** 「未分类」的虚拟文件夹 key（映射为 folderId 空值） */
const UNCATEGORIZED = '__uncategorized__'

// 手机档文件夹栏转成抽屉
const nav = useMobileNav()

const folders = ref<NoteFolderVo[]>([])
const foldersLoading = ref(false)

const notes = ref<NoteBriefVo[]>([])
const nextCursor = ref<string | number | null>(null)
const hasNext = ref(false)
const total = ref(0)
const notesLoading = ref(false)

const activeFolder = ref<string>(ALL_FOLDER)
const currentNoteId = ref('')
const noteDetail = ref<NoteDetailVo | null>(null)
const isCreating = ref(false)
const detailLoading = ref(false)
const savingNote = ref(false)
const suppressDirty = ref(false)

const editor = reactive({ title: '', content: '', folderId: UNCATEGORIZED })
const editorMode = ref<'edit' | 'preview'>('edit')
const dirty = ref(false)

const unwrapData = <T,>(res: any, fallback: T): T => (res?.data ?? res ?? fallback) as T

const currentFolderLabel = computed(() => {
  if (activeFolder.value === ALL_FOLDER) return `全部笔记（${total.value}）`
  if (activeFolder.value === UNCATEGORIZED) return '未分类'
  return folders.value.find((f) => String(f.folderId) === activeFolder.value)?.folderName || '笔记'
})

const previewHtml = computed(() => renderMarkdown(editor.content))

const fmtTime = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 列表三态过滤（与后端契约一致）：
 * - 全部（ALL_FOLDER）：不传 folderId（缺省即「全部笔记」）
 * - 未分类（UNCATEGORIZED）：folderId = 0（folder_id IS NULL）
 * - 文件夹：folderId = 正数（后端校验归属）
 */
function buildListQuery(cursor?: string | number) {
  const query: Record<string, any> = { size: 20 }
  if (activeFolder.value === UNCATEGORIZED) {
    query.folderId = 0
  } else if (activeFolder.value !== ALL_FOLDER) {
    query.folderId = activeFolder.value
  }
  if (cursor !== undefined && cursor !== null && cursor !== '') {
    query.cursor = cursor
  }
  return query
}

/** 编辑器内部 folderId 表示（哨兵或正数字符串）→ 后端 folderId：未分类 = 0，文件夹 = 正数 */
function toFolderId(folderKey: string): number {
  if (folderKey === UNCATEGORIZED) return 0
  const num = Number(folderKey)
  return Number.isFinite(num) && num > 0 ? num : 0
}

function normalizeNote(item: any): NoteBriefVo {
  return {
    ...item,
    noteId: String(item.noteId ?? ''),
    folderId: item.folderId == null ? null : String(item.folderId),
  }
}

async function loadFolders() {
  foldersLoading.value = true
  try {
    const res: any = await noteApi.listFolders()
    const list = unwrapData<any[]>(res, [])
    folders.value = list.map((item) => ({
      ...item,
      folderId: String(item.folderId ?? ''),
      noteCount: Number(item.noteCount ?? 0),
    }))
  } catch (error) {
    logWarn('加载文件夹失败:', error)
    folders.value = []
  } finally {
    foldersLoading.value = false
  }
}

async function loadNotes(reset = true) {
  notesLoading.value = true
  try {
    const res: any = await noteApi.listNotes(buildListQuery())
    const data = unwrapData<any>(res, { items: [], hasNext: false, total: 0, nextCursor: null })
    const items = (data.items || []).map(normalizeNote)
    if (reset) {
      notes.value = items
    } else {
      notes.value = [...notes.value, ...items]
    }
    nextCursor.value = data.nextCursor ?? null
    hasNext.value = Boolean(data.hasNext)
    total.value = Number(data.total ?? 0)
  } catch (error) {
    logWarn('加载笔记列表失败:', error)
    if (reset) notes.value = []
  } finally {
    notesLoading.value = false
  }
}

async function loadMore() {
  if (!hasNext.value || notesLoading.value) return
  await loadNotes(false)
}

/** 切换文件夹前若编辑区有未保存改动，需用户确认 */
async function selectFolder(key: string) {
  if (key === activeFolder.value) return
  if (!(await confirmDiscard())) return
  activeFolder.value = key
  currentNoteId.value = ''
  noteDetail.value = null
  isCreating.value = false
  dirty.value = false
  await loadNotes()
}

async function selectNote(note: NoteBriefVo) {
  const id = String(note.noteId)
  if (id === currentNoteId.value) return
  if (!(await confirmDiscard())) return

  isCreating.value = false
  currentNoteId.value = id
  dirty.value = false
  editorMode.value = 'edit'
  detailLoading.value = true
  suppressDirty.value = true
  try {
    const res: any = await noteApi.getNote(id)
    const detail = unwrapData<NoteDetailVo | null>(res, null)
    noteDetail.value = detail
    editor.title = detail?.title || ''
    editor.content = detail?.content || ''
    editor.folderId = detail?.folderId == null ? UNCATEGORIZED : String(detail.folderId)
  } catch (error) {
    logWarn('加载笔记详情失败:', error)
    currentNoteId.value = ''
  } finally {
    detailLoading.value = false
    // 等编辑器字段稳定后再开启 dirty 追踪
    setTimeout(() => (suppressDirty.value = false), 0)
  }
}

function startCreate() {
  isCreating.value = true
  currentNoteId.value = ''
  noteDetail.value = null
  dirty.value = false
  editor.title = ''
  editor.content = ''
  editor.folderId = activeFolder.value === ALL_FOLDER || activeFolder.value === UNCATEGORIZED
    ? UNCATEGORIZED
    : activeFolder.value
  editorMode.value = 'edit'
}

async function saveNote() {
  if (!editor.content.trim()) {
    ElMessage.warning('笔记内容不能为空')
    return
  }

  const folderId = toFolderId(editor.folderId)
  savingNote.value = true
  try {
    if (isCreating.value) {
      const res: any = await noteApi.createNote({
        folderId,
        title: editor.title.trim() || undefined,
        content: editor.content,
        requestId: crypto.randomUUID(),
      })
      const created = unwrapData<NoteDetailVo | null>(res, null)
      ElMessage.success('笔记已创建')
      isCreating.value = false
      if (created) currentNoteId.value = String(created.noteId)
    } else {
      await noteApi.updateNote(currentNoteId.value, {
        title: editor.title.trim() || undefined,
        content: editor.content,
      })
      ElMessage.success('笔记已保存')
    }
    dirty.value = false
    await Promise.all([loadNotes(), loadFolders()])
  } catch (error) {
    logWarn('保存笔记失败:', error)
  } finally {
    savingNote.value = false
  }
}

async function moveCurrentNote() {
  if (isCreating.value) return
  // 下拉 v-model 变更会触发 dirty watch，移动期间抑制；
  // 移动成功后编辑区与后端状态一致，不应再视为有未保存改动。
  suppressDirty.value = true
  try {
    const folderId = toFolderId(editor.folderId)
    await noteApi.moveNote(currentNoteId.value, folderId)
    ElMessage.success('笔记已移动')
    dirty.value = false
    if (noteDetail.value) noteDetail.value = { ...noteDetail.value, folderId }
    await Promise.all([loadNotes(), loadFolders()])
  } catch (error) {
    logWarn('移动笔记失败:', error)
  } finally {
    suppressDirty.value = false
  }
}

async function removeNote() {
  if (isCreating.value) {
    isCreating.value = false
    dirty.value = false
    editor.content = ''
    editor.title = ''
    return
  }
  try {
    await ElMessageBox.confirm('确定删除这条笔记吗？删除后不可恢复。', '删除笔记', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await noteApi.deleteNote(currentNoteId.value)
    ElMessage.success('笔记已删除')
    currentNoteId.value = ''
    noteDetail.value = null
    dirty.value = false
    editor.content = ''
    editor.title = ''
    await Promise.all([loadNotes(), loadFolders()])
  } catch (error) {
    logWarn('删除笔记失败:', error)
  }
}

async function createFolder() {
  try {
    const { value } = await ElMessageBox.prompt('请输入文件夹名称', '新建文件夹', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '文件夹名称不能为空',
    })
    await noteApi.createFolder(value.trim(), crypto.randomUUID())
    ElMessage.success('文件夹已创建')
    await loadFolders()
  } catch (error) {
    if (error !== 'cancel') logWarn('创建文件夹失败:', error)
  }
}

async function renameFolder(folder: NoteFolderVo) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的文件夹名称', '重命名文件夹', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: folder.folderName,
      inputPattern: /\S+/,
      inputErrorMessage: '文件夹名称不能为空',
    })
    await noteApi.renameFolder(String(folder.folderId), value.trim())
    ElMessage.success('文件夹已重命名')
    await loadFolders()
  } catch (error) {
    if (error !== 'cancel') logWarn('重命名文件夹失败:', error)
  }
}

async function removeFolder(folder: NoteFolderVo) {
  try {
    await ElMessageBox.confirm(
      `确定删除文件夹「${folder.folderName}」吗？其中的 ${folder.noteCount} 条笔记会一并删除。`,
      '删除文件夹',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  try {
    await noteApi.deleteFolder(String(folder.folderId))
    ElMessage.success('文件夹已删除')
    if (activeFolder.value === String(folder.folderId)) {
      activeFolder.value = ALL_FOLDER
      currentNoteId.value = ''
      isCreating.value = false
      dirty.value = false
    }
    await Promise.all([loadFolders(), loadNotes()])
  } catch (error) {
    logWarn('删除文件夹失败:', error)
  }
}

/** 编辑区有未保存改动时，返回 false 表示用户选择取消（阻止切换） */
async function confirmDiscard(): Promise<boolean> {
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('当前笔记有未保存的改动，确定放弃并离开吗？', '未保存的改动', {
      confirmButtonText: '放弃改动',
      cancelButtonText: '继续编辑',
      type: 'warning',
    })
    dirty.value = false
    return true
  } catch {
    return false
  }
}

// 编辑器内容变化即标记为「已修改」，加载详情期间抑制
watch(
  () => [editor.title, editor.content, editor.folderId],
  () => {
    if (!suppressDirty.value && (currentNoteId.value || isCreating.value)) {
      dirty.value = true
    }
  },
)

onMounted(() => {
  loadFolders()
  loadNotes()
})
</script>

<style scoped>
.notes-view {
  height: 100vh; height: 100dvh;
  /* dvh：移动端地址栏收放不顶出底部内容 */
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
  font-family: var(--cw-font-sans);
}

.main-container {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* ---------- 左：文件夹 ---------- */
.folder-panel {
  width: 210px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid var(--cw-border);
  padding: 16px 12px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--cw-text-3);
}

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--cw-text-2);
  cursor: pointer;
  transition: all 0.2s;
}

.folder-item:hover {
  background: var(--cw-bg-page);
}

.folder-item.active {
  background: var(--cw-brand-soft);
  color: var(--cw-brand);
  font-weight: 600;
}

.folder-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  font-size: 12px;
  color: var(--cw-text-3);
}

.folder-ops {
  display: none;
  align-items: center;
  gap: 6px;
}

.folder-item:hover .folder-ops {
  display: inline-flex;
}

.folder-ops .el-icon {
  color: var(--cw-text-3);
}

.folder-ops .el-icon:hover {
  color: var(--cw-brand);
}

.folder-ops .el-icon.danger:hover {
  color: var(--cw-danger);
}

/* ---------- 中：笔记列表 ---------- */
.note-list-panel {
  width: 300px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid var(--cw-border);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
}

.note-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note-item {
  border: 1px solid #eef1f5;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.note-item:hover {
  border-color: var(--cw-brand);
  background: var(--cw-brand-soft);
}

.note-item.active {
  border-color: var(--cw-brand);
  background: var(--cw-brand-soft);
}

.note-item-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--cw-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-item-preview {
  font-size: 12px;
  color: var(--cw-text-3);
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-item-time {
  font-size: 11px;
  color: var(--cw-text-faint);
  margin-top: 6px;
}

.load-more {
  text-align: center;
  padding: 6px 0;
}

/* ---------- 右：编辑器 ---------- */
.editor-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--cw-border);
}

.title-input {
  width: 220px;
}

.folder-select {
  width: 160px;
}

.toolbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.editor-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.markdown-input {
  flex: 1;
  height: 100%;
}

.markdown-input :deep(textarea) {
  height: 100% !important;
  border: none;
  border-radius: 0;
  resize: none;
  font-family: var(--cw-font-mono);
  font-size: 14px;
  line-height: 1.6;
  padding: 16px 20px;
}

.markdown-preview {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--cw-text-3);
}

.editor-empty .el-icon {
  font-size: 48px;
}

.editor-empty p {
  margin: 0;
  font-size: 14px;
}

@media (max-width: 768px) {
  /* 手机档改为上下堆叠：文件夹进抽屉，笔记列表在上、编辑器在下。
   * 三栏横排在 375px 下会把编辑器挤到只剩一百多像素。 */
  .main-container {
    flex-direction: column;
    overflow: visible;
  }

  .note-list-panel {
    width: 100%;
    /* 这一页没有全局 border-box，不显式声明的话 padding 会加到 100% 之外，
       面板比容器宽 24px，右侧内容被 .main-container 裁掉 */
    box-sizing: border-box;
    max-height: 42vh;
    border-right: 0;
    border-bottom: 1px solid var(--cw-border);
  }

  .editor-panel {
    min-height: 50vh;
  }

  /* 编辑器工具栏在窄屏换行，避免固定宽输入框顶破容器 */
  .editor-toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .title-input {
    width: 100%;
  }
}
</style>
