import request from './request'

/**
 * 笔记文件夹视图对象。
 * folderId 为 null 的语义只出现在「未分类」这一虚拟分类上，
 * 服务端返回的真实文件夹 folderId 一定存在（雪花 ID，前端一律按字符串处理）。
 */
export interface NoteFolderVo {
  folderId: string | number
  folderName: string
  noteCount: number
  createTime?: string
  updateTime?: string
}

/** 笔记列表简要项（不含正文，preview 为后端去 Markdown 后的纯文本截断） */
export interface NoteBriefVo {
  noteId: string | number
  title: string
  folderId: string | number | null
  contentType: string
  preview: string
  createTime?: string
  updateTime?: string
}

/** 笔记详情（含 Markdown 全文）。contentType 创建后不可变，默认 "MD" */
export interface NoteDetailVo {
  noteId: string | number
  title: string
  folderId: string | number | null
  contentType: string
  content: string
  createTime?: string
  updateTime?: string
}

/** 游标分页结果：nextCursor 为空或 hasNext 为 false 时停止翻页 */
export interface NoteListVo {
  items: NoteBriefVo[]
  nextCursor: string | number | null
  hasNext: boolean
  total: number
}

/**
 * 创建笔记载荷：content 必填；requestId 用于幂等。
 * folderId 契约：缺省 / null / 0 均归一为「未分类」；正数表示目标文件夹（后端校验归属）。
 */
export interface NoteCreatePayload {
  folderId?: string | number | null
  title?: string
  content: string
  type?: string
  requestId?: string
}

/**
 * 笔记列表查询参数。folderId 三态契约：
 * - 缺省 / 空串 → 全部笔记
 * - 0 → 未分类（folder_id IS NULL）
 * - 正数 N → 该文件夹（后端校验归属）
 * - 负数 → 后端返回 400 业务异常「文件夹 ID 不合法」
 */
export interface NoteListQuery {
  folderId?: string | number
  cursor?: string | number
  size?: number
}

const noteApi = {
  /** 获取当前用户全部文件夹（含每个文件夹下的笔记数量） */
  listFolders() {
    return request.get<NoteFolderVo[]>('/review/note/folders')
  },

  /** 创建文件夹；folderName 去空格后 1-255 字符，同名会被唯一约束拒绝 */
  createFolder(folderName: string, requestId?: string) {
    return request.post<NoteFolderVo>('/review/note/folders', { folderName, requestId })
  },

  /** 重命名文件夹 */
  renameFolder(folderId: string | number, folderName: string) {
    return request.put<NoteFolderVo>(`/review/note/folders/${folderId}`, { folderName })
  },

  /** 删除文件夹（级联删除其下全部笔记，调用前必须二次确认） */
  deleteFolder(folderId: string | number) {
    return request.delete<string>(`/review/note/folders/${folderId}`)
  },

  /** 游标分页获取笔记列表；folderId 三态契约见 NoteListQuery */
  listNotes(query: NoteListQuery = {}) {
    return request.get<NoteListVo>('/review/note/list', { params: { size: 20, ...query } })
  },

  /** 获取笔记详情（含全文） */
  getNote(noteId: string | number) {
    return request.get<NoteDetailVo>(`/review/note/${noteId}`)
  },

  /** 创建笔记；title 为空时后端从正文推导 */
  createNote(data: NoteCreatePayload) {
    return request.post<NoteDetailVo>('/review/note', data)
  },

  /** 更新笔记，仅 title/content 可改（contentType 不可变） */
  updateNote(noteId: string | number, data: { title?: string; content?: string }) {
    return request.put<NoteDetailVo>(`/review/note/${noteId}`, data)
  },

  /** 移动笔记到指定文件夹；folderId 缺省/null/0 = 移入「未分类」，正数 = 目标文件夹 */
  moveNote(noteId: string | number, folderId?: string | number | null) {
    return request.post<string>(`/review/note/${noteId}/move`, null, {
      params: { folderId: folderId ?? undefined },
    })
  },

  /** 删除笔记 */
  deleteNote(noteId: string | number) {
    return request.delete<string>(`/review/note/${noteId}`)
  },
}

export default noteApi
