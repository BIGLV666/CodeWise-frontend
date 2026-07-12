<template>
    <div ref="panelRef" class="solution-panel" @scroll="handlePanelScroll">
        <template v-if="mode === 'list'">
            <div class="solution-toolbar">
                <div>
                    <h2>题解</h2>
                    <p>来自 CodeWise 用户的解题思路</p>
                </div>
                <el-button type="success" :icon="EditPen" @click="openEditor()">发布题解</el-button>
            </div>

            <el-skeleton v-if="listLoading && solutions.length === 0" :rows="6" animated />
            <el-empty
                v-else-if="!listLoading && solutions.length === 0"
                description="暂无题解，来发布第一篇吧"
            />
            <div v-else class="solution-list">
                <article
                    v-for="item in solutions"
                    :key="item.solutionId"
                    class="solution-row"
                    tabindex="0"
                    @click="openDetail(item.solutionId)"
                    @keydown.enter="openDetail(item.solutionId)"
                >
                    <el-avatar :size="38" :src="avatarOf(item.userDto)">{{
                        avatarText(authorName(item.userDto))
                    }}</el-avatar>
                    <div class="solution-row-main">
                        <div class="solution-author">
                            <strong>{{ authorName(item.userDto) }}</strong
                            ><span>{{ formatDate(item.createTime) }}</span>
                        </div>
                        <h3>{{ item.solutionTitle }}</h3>
                        <div v-if="item.tags.length" class="tag-row">
                            <el-tag
                                v-for="tag in item.tags"
                                :key="tag"
                                size="small"
                                effect="plain"
                                >{{ tag }}</el-tag
                            >
                        </div>
                        <div class="solution-metrics">
                            <span
                                ><el-icon><CaretTop /></el-icon>{{ item.likeCount }}</span
                            >
                            <span
                                ><el-icon><View /></el-icon>{{ item.lookCount }}</span
                            >
                            <span
                                ><el-icon><ChatDotRound /></el-icon>{{ item.commentCount }}</span
                            >
                        </div>
                    </div>
                </article>
                <div class="load-more-row">
                    <el-button v-if="hasNext" text :loading="listLoading" @click="loadSolutions"
                        >加载更多</el-button
                    >
                    <span v-else-if="solutions.length">已经到底了</span>
                </div>
            </div>
        </template>

        <template v-else-if="mode === 'detail'">
            <div class="detail-topbar">
                <button type="button" class="back-button" @click="backToList">
                    <el-icon><ArrowLeft /></el-icon>全部题解
                </button>
                <div v-if="isOwner" class="owner-actions">
                    <el-button text :icon="Edit" @click="openEditor(detail)">修改</el-button>
                    <el-button
                        text
                        type="danger"
                        :icon="Delete"
                        :loading="deleting"
                        @click="removeSolution"
                        >删除</el-button
                    >
                </div>
            </div>

            <el-skeleton v-if="detailLoading" :rows="8" animated />
            <template v-else-if="detail">
                <article class="solution-detail">
                    <h1>{{ detail.solutionTitle }}</h1>
                    <div class="detail-author">
                        <el-avatar :size="40" :src="avatarOf(detail.userDto)">{{
                            avatarText(authorName(detail.userDto))
                        }}</el-avatar>
                        <div>
                            <strong>{{ authorName(detail.userDto) }}</strong
                            ><span>{{ formatDate(detail.createTime) }} 发布</span>
                        </div>
                    </div>
                    <div v-if="detail.tags.length" class="tag-row detail-tags">
                        <el-tag v-for="tag in detail.tags" :key="tag" size="small" effect="plain">{{
                            tag
                        }}</el-tag>
                    </div>
                    <div
                        class="markdown-body"
                        v-html="renderMarkdown(detail.solutionContent)"
                    ></div>
                    <footer class="detail-metrics">
                        <button
                            type="button"
                            class="solution-like"
                            :class="{ liked: detail.isLike }"
                            :disabled="liking"
                            @click="toggleSolutionLike"
                        >
                            <el-icon :class="{ 'is-loading': liking }"
                                ><Loading v-if="liking" /><CaretTop v-else /></el-icon
                            >{{ detail.likeCount }} 赞
                        </button>
                        <span
                            ><el-icon><View /></el-icon>{{ detail.lookCount }} 浏览</span
                        >
                        <span
                            ><el-icon><ChatDotRound /></el-icon>{{ detail.commentCount }} 评论</span
                        >
                    </footer>
                </article>

                <section class="comments-section">
                    <div v-if="!commentsRequested" class="comments-gate">
                        <el-icon><ArrowDown /></el-icon><span>继续向下滚动查看评论</span>
                    </div>
                    <template v-else>
                        <h2>
                            评论 <span>{{ detail.commentCount }}</span>
                        </h2>
                        <div class="comment-editor">
                            <el-input
                                v-model="commentText"
                                type="textarea"
                                :rows="3"
                                maxlength="500"
                                show-word-limit
                                placeholder="写下你的看法..."
                            />
                            <el-button type="primary" :loading="commenting" @click="submitComment"
                                >发表评论</el-button
                            >
                        </div>
                        <el-skeleton
                            v-if="commentsLoading && comments.length === 0"
                            :rows="3"
                            animated
                        />
                        <el-empty v-else-if="comments.length === 0" description="暂无评论" />
                        <div v-else class="comment-list">
                            <article
                                v-for="comment in comments"
                                :key="comment.commentId"
                                class="comment-item"
                            >
                                <el-avatar :size="30">{{ avatarText(comment.userName) }}</el-avatar>
                                <div>
                                    <div class="comment-meta">
                                        <strong>{{ comment.userName || 'CodeWise 用户' }}</strong
                                        ><span>{{ formatDate(comment.createTime) }}</span>
                                    </div>
                                    <p>{{ comment.comment }}</p>
                                    <button
                                        v-if="isCommentOwner(comment)"
                                        type="button"
                                        class="comment-delete"
                                        @click="removeComment(comment)"
                                    >
                                        删除
                                    </button>
                                </div>
                            </article>
                            <div class="load-more-row">
                                <el-button
                                    v-if="commentsHasNext"
                                    text
                                    :loading="commentsLoading"
                                    @click="loadComments"
                                    >加载更多评论</el-button
                                >
                            </div>
                        </div>
                    </template>
                </section>
            </template>
        </template>

        <template v-else>
            <div class="editor-heading">
                <button type="button" class="back-button" @click="cancelEditor">
                    <el-icon><ArrowLeft /></el-icon>{{ editingId ? '返回题解' : '返回列表' }}
                </button>
                <strong>{{ editingId ? '修改题解' : '发布题解' }}</strong>
            </div>
            <div class="solution-editor">
                <el-input
                    v-model="editorForm.solutionTitle"
                    maxlength="200"
                    show-word-limit
                    placeholder="题解标题"
                />
                <el-select
                    v-model="editorForm.tags"
                    multiple
                    filterable
                    allow-create
                    default-first-option
                    placeholder="添加标签"
                >
                    <el-option v-for="tag in suggestedTags" :key="tag" :label="tag" :value="tag" />
                </el-select>
                <el-input
                    v-model="editorForm.solutionContent"
                    type="textarea"
                    :rows="16"
                    maxlength="10000"
                    show-word-limit
                    placeholder="使用 Markdown 编写你的解题思路、复杂度分析和代码..."
                />
                <div class="preview-block">
                    <span>预览</span>
                    <div
                        class="markdown-body"
                        v-html="renderMarkdown(editorForm.solutionContent || '内容将在这里预览。')"
                    ></div>
                </div>
                <div class="editor-actions">
                    <el-button @click="cancelEditor">取消</el-button
                    ><el-button type="primary" :loading="saving" @click="saveSolution">{{
                        editingId ? '保存修改' : '发布题解'
                    }}</el-button>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import {
    ArrowDown,
    ArrowLeft,
    CaretTop,
    ChatDotRound,
    Delete,
    Edit,
    EditPen,
    Loading,
    View
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import communityApi from '@/api/communityApi';
import { normalizeAvatarUrl } from '@/utils/avatar';
import { renderMarkdown } from '@/utils/markdown';

interface UserSummary {
    userId?: string;
    userName?: string;
    nickName?: string;
    avatarUrl?: string;
}
interface SolutionSummary {
    solutionId: string;
    questionId: number;
    solutionTitle: string;
    solutionUserId: string;
    userDto?: UserSummary;
    likeCount: number;
    lookCount: number;
    commentCount: number;
    tags: string[];
    createTime?: string;
}
interface SolutionDetail extends SolutionSummary {
    solutionContent: string;
    isLike?: boolean;
}
interface SolutionComment {
    commentId: string;
    comment: string;
    userId?: string;
    userName?: string;
    rootCommentId?: string;
    createTime?: string;
}

const props = defineProps<{
    active: boolean;
    questionId: string | number;
    questionTitle?: string;
}>();
const panelRef = ref<HTMLElement>();
const mode = ref<'list' | 'detail' | 'editor'>('list');
const activatedOnce = ref(false);
const solutions = ref<SolutionSummary[]>([]);
const listLoading = ref(false);
const hasNext = ref(false);
const nextCursor = ref<string | null>(null);
const detail = ref<SolutionDetail | null>(null);
const detailLoading = ref(false);
const deleting = ref(false);
const liking = ref(false);
const saving = ref(false);
const editingId = ref('');
const commentsRequested = ref(false);
const commentsLoading = ref(false);
const comments = ref<SolutionComment[]>([]);
const commentsHasNext = ref(false);
const commentsNextCursor = ref<string | null>(null);
const commentText = ref('');
const commenting = ref(false);
const suggestedTags = ['Java', 'C++', 'Python', '动态规划', '哈希表', '双指针', '贪心', '二分查找'];
const editorForm = reactive({ solutionTitle: '', solutionContent: '', tags: [] as string[] });

const currentUserId = computed(() => String(localStorage.getItem('userId') || ''));
const isOwner = computed(() =>
    Boolean(
        detail.value?.solutionUserId && currentUserId.value === String(detail.value.solutionUserId)
    )
);
const unwrap = <T,>(response: any, fallback: T): T => (response?.data ?? response ?? fallback) as T;
const mapSummary = (raw: any): SolutionSummary => ({
    solutionId: String(raw.solutionId),
    questionId: Number(raw.questionId),
    solutionTitle: raw.solutionTitle || '未命名题解',
    solutionUserId: String(raw.solutionUserId || ''),
    userDto: raw.userDto,
    likeCount: Number(raw.likeCount || 0),
    lookCount: Number(raw.lookCount || 0),
    commentCount: Number(raw.commentCount || 0),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    createTime: raw.createTime
});
const mapDetail = (raw: any): SolutionDetail => ({
    ...mapSummary(raw),
    solutionContent: raw.solutionContent || '',
    isLike: Boolean(raw.isLike)
});
const mapComment = (raw: any): SolutionComment => ({
    commentId: String(raw.commentId),
    comment: raw.comment || '',
    userId: raw.userId == null ? undefined : String(raw.userId),
    userName: raw.userName,
    rootCommentId: raw.rootCommentId == null ? undefined : String(raw.rootCommentId),
    createTime: raw.createTime
});

async function loadSolutions() {
    if (listLoading.value || (solutions.value.length > 0 && !hasNext.value)) return;
    listLoading.value = true;
    try {
        const data = unwrap<any>(
            await communityApi.listSolutions({
                questionId: props.questionId,
                pageSize: 20,
                lastId: nextCursor.value
            }),
            {}
        );
        const records = Array.isArray(data.records) ? data.records.map(mapSummary) : [];
        solutions.value.push(
            ...records.filter(
                (item: SolutionSummary) =>
                    !solutions.value.some((old) => old.solutionId === item.solutionId)
            )
        );
        hasNext.value = Boolean(data.hasNext);
        nextCursor.value = data.nextCursor == null ? null : String(data.nextCursor);
    } catch (error) {
        console.error('加载题解失败:', error);
    } finally {
        listLoading.value = false;
    }
}

async function openDetail(solutionId: string) {
    mode.value = 'detail';
    detailLoading.value = true;
    commentsRequested.value = false;
    comments.value = [];
    commentsNextCursor.value = null;
    commentsHasNext.value = false;
    await nextTick();
    if (panelRef.value) panelRef.value.scrollTop = 0;
    try {
        detail.value = mapDetail(unwrap<any>(await communityApi.getSolution(solutionId), {}));
    } catch (error) {
        console.error('加载题解详情失败:', error);
        backToList();
    } finally {
        detailLoading.value = false;
    }
}

function backToList() {
    mode.value = 'list';
    detail.value = null;
    commentsRequested.value = false;
    nextTick(() => {
        if (panelRef.value) panelRef.value.scrollTop = 0;
    });
}
function openEditor(source?: SolutionDetail | null) {
    editingId.value = source?.solutionId || '';
    editorForm.solutionTitle = source?.solutionTitle || '';
    editorForm.solutionContent = source?.solutionContent || '';
    editorForm.tags = source ? [...source.tags] : [];
    mode.value = 'editor';
    nextTick(() => {
        if (panelRef.value) panelRef.value.scrollTop = 0;
    });
}
function cancelEditor() {
    if (editingId.value && detail.value) mode.value = 'detail';
    else mode.value = 'list';
}

async function saveSolution() {
    const title = editorForm.solutionTitle.trim();
    const content = editorForm.solutionContent.trim();
    if (!title || !content) {
        ElMessage.warning('题解标题和正文不能为空');
        return;
    }
    saving.value = true;
    try {
        const payload = {
            questionId: Number(props.questionId),
            solutionTitle: title,
            solutionContent: content,
            tags: [...new Set(editorForm.tags.map((tag) => tag.trim()).filter(Boolean))]
        };
        if (editingId.value) {
            await communityApi.updateSolution(editingId.value, payload);
            ElMessage.success('题解已修改');
            await openDetail(editingId.value);
        } else {
            const requestResponse: any = await communityApi.getRequestId();
            const requestId =
                typeof requestResponse === 'string' ? requestResponse : requestResponse?.message;
            if (!requestId) throw new Error('requestId 获取失败');
            const created = unwrap<any>(
                await communityApi.createSolution(payload, requestId),
                null
            );
            ElMessage.success('题解已发布');
            solutions.value = [];
            nextCursor.value = null;
            hasNext.value = false;
            await loadSolutions();
            if (created?.solutionId) await openDetail(String(created.solutionId));
            else mode.value = 'list';
        }
    } catch (error) {
        console.error('保存题解失败:', error);
    } finally {
        saving.value = false;
    }
}

async function removeSolution() {
    if (!detail.value || !isOwner.value) return;
    try {
        await ElMessageBox.confirm('题解及其评论会一起删除，确定继续吗？', '删除题解', {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            confirmButtonClass: 'el-button--danger'
        });
        deleting.value = true;
        await communityApi.deleteSolution(detail.value.solutionId);
        solutions.value = solutions.value.filter(
            (item) => item.solutionId !== detail.value?.solutionId
        );
        ElMessage.success('题解已删除');
        backToList();
    } catch (error: any) {
        if (error !== 'cancel' && error !== 'close') console.error('删除题解失败:', error);
    } finally {
        deleting.value = false;
    }
}

async function toggleSolutionLike() {
    if (!detail.value || liking.value) return;
    const previous = Boolean(detail.value.isLike);
    liking.value = true;
    try {
        const response: any = await communityApi.toggleSolutionLike(detail.value.solutionId);
        const liked = Boolean(response?.data ?? response);
        detail.value.isLike = liked;
        if (liked !== previous)
            detail.value.likeCount = Math.max(0, detail.value.likeCount + (liked ? 1 : -1));
        const summary = solutions.value.find(
            (item) => item.solutionId === detail.value?.solutionId
        );
        if (summary) summary.likeCount = detail.value.likeCount;
    } catch (error) {
        console.error('题解点赞失败:', error);
    } finally {
        liking.value = false;
    }
}

async function loadComments() {
    if (
        !detail.value ||
        commentsLoading.value ||
        (comments.value.length > 0 && !commentsHasNext.value)
    )
        return;
    commentsRequested.value = true;
    commentsLoading.value = true;
    try {
        const data = unwrap<any>(
            await communityApi.listComments({
                postId: detail.value.solutionId,
                type: 'SOLUTION',
                rootCommentId: -1,
                pageSize: 20,
                lastId: commentsNextCursor.value
            }),
            {}
        );
        const records = Array.isArray(data.records) ? data.records.map(mapComment) : [];
        comments.value.push(
            ...records.filter(
                (item: SolutionComment) =>
                    !comments.value.some((old) => old.commentId === item.commentId)
            )
        );
        commentsHasNext.value = Boolean(data.hasNext);
        commentsNextCursor.value = data.nextCursor == null ? null : String(data.nextCursor);
    } catch (error) {
        console.error('加载题解评论失败:', error);
    } finally {
        commentsLoading.value = false;
    }
}

function handlePanelScroll(event: Event) {
    if (mode.value !== 'detail' || commentsRequested.value) return;
    const element = event.currentTarget as HTMLElement;
    if (
        element.scrollTop > 0 &&
        element.scrollTop + element.clientHeight >= element.scrollHeight - 180
    )
        loadComments();
}
async function submitComment() {
    if (!detail.value || !commentText.value.trim()) {
        ElMessage.warning('评论不能为空');
        return;
    }
    commenting.value = true;
    try {
        const requestResponse: any = await communityApi.getRequestId();
        const requestId =
            typeof requestResponse === 'string' ? requestResponse : requestResponse?.message;
        if (!requestId) throw new Error('requestId 获取失败');
        await communityApi.createComment(
            {
                comment: commentText.value.trim(),
                postId: detail.value.solutionId,
                rootCommentId: -1,
                type: 'SOLUTION'
            },
            requestId
        );
        commentText.value = '';
        comments.value = [];
        commentsNextCursor.value = null;
        commentsHasNext.value = false;
        detail.value.commentCount += 1;
        await loadComments();
        ElMessage.success('评论已发表');
    } catch (error) {
        console.error('发表评论失败:', error);
    } finally {
        commenting.value = false;
    }
}
const isCommentOwner = (comment: SolutionComment) =>
    Boolean(comment.userId && currentUserId.value === String(comment.userId));
async function removeComment(comment: SolutionComment) {
    if (!detail.value || !isCommentOwner(comment)) return;
    try {
        await ElMessageBox.confirm('确定删除这条评论吗？', '删除评论', {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
        });
        await communityApi.deleteComment(comment.commentId);
        comments.value = comments.value.filter((item) => item.commentId !== comment.commentId);
        detail.value.commentCount = Math.max(0, detail.value.commentCount - 1);
        ElMessage.success('评论已删除');
    } catch (error: any) {
        if (error !== 'cancel' && error !== 'close') console.error('删除评论失败:', error);
    }
}

const authorName = (user?: UserSummary) => user?.nickName || user?.userName || 'CodeWise 用户';
const avatarOf = (user?: UserSummary) => normalizeAvatarUrl(user?.avatarUrl || '');
const avatarText = (name?: string) => (name || 'CW').slice(0, 2).toUpperCase();
const formatDate = (date?: string) => {
    if (!date) return '刚刚';
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('zh-CN');
};

watch(
    () => [props.active, props.questionId] as const,
    ([active, questionId]) => {
        if (active && questionId && !activatedOnce.value) {
            activatedOnce.value = true;
            loadSolutions();
        }
    },
    { immediate: true }
);
</script>

<style scoped>
.solution-panel {
    height: 100%;
    overflow-y: auto;
    padding: 2px 4px 32px 0;
    color: #262626;
    scrollbar-width: thin;
}
.solution-toolbar,
.detail-topbar,
.editor-heading {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 0 14px;
    background: #fff;
    border-bottom: 1px solid #edf0f3;
}
.solution-toolbar h2 {
    margin: 0;
    font-size: 20px;
}
.solution-toolbar p {
    margin: 4px 0 0;
    color: #8a8f98;
    font-size: 12px;
}
.solution-list {
    display: flex;
    flex-direction: column;
}
.solution-row {
    display: flex;
    gap: 12px;
    padding: 18px 4px;
    border-bottom: 1px solid #edf0f3;
    cursor: pointer;
    transition:
        background 0.16s ease,
        transform 0.16s ease;
}
.solution-row:hover,
.solution-row:focus-visible {
    background: #fafafa;
    transform: translateY(-1px);
    outline: none;
}
.solution-row-main {
    flex: 1;
    min-width: 0;
}
.solution-author,
.comment-meta {
    display: flex;
    align-items: baseline;
    gap: 9px;
}
.solution-author strong,
.comment-meta strong {
    font-size: 13px;
}
.solution-author span,
.comment-meta span {
    color: #9ca3af;
    font-size: 11px;
}
.solution-row h3 {
    margin: 7px 0 9px;
    font-size: 16px;
    line-height: 1.45;
}
.tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.tag-row :deep(.el-tag) {
    border-color: #e4e7eb;
    background: #f5f6f7;
    color: #60656f;
}
.solution-metrics,
.detail-metrics {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-top: 12px;
    color: #8a8f98;
    font-size: 12px;
}
.solution-metrics span,
.detail-metrics span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.solution-like {
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.solution-like:hover,
.solution-like.liked {
    color: #16a34a;
}
.solution-like:disabled {
    cursor: wait;
    opacity: 0.7;
}
.load-more-row {
    min-height: 48px;
    display: grid;
    place-items: center;
    color: #a0a5ad;
    font-size: 12px;
}
.back-button,
.comment-delete {
    border: 0;
    background: transparent;
    font: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #6b7280;
}
.back-button:hover {
    color: #d98200;
}
.owner-actions {
    display: flex;
}
.solution-detail h1 {
    margin: 24px 0 18px;
    font-size: 25px;
    line-height: 1.4;
}
.detail-author {
    display: flex;
    align-items: center;
    gap: 10px;
}
.detail-author div {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.detail-author span {
    color: #8a8f98;
    font-size: 12px;
}
.detail-tags {
    margin: 15px 0 24px;
}
.markdown-body {
    color: #30343b;
    font-size: 15px;
    line-height: 1.85;
    overflow-wrap: anywhere;
}
.markdown-body :deep(h2) {
    margin: 26px 0 12px;
    padding-bottom: 7px;
    border-bottom: 1px solid #edf0f3;
    font-size: 20px;
}
.markdown-body :deep(p) {
    margin: 0 0 15px;
}
.markdown-body :deep(pre) {
    padding: 14px;
    border-radius: 6px;
    overflow-x: auto;
}
.markdown-body :deep(img) {
    max-width: 100%;
}
.markdown-body :deep(.katex-display) {
    overflow-x: auto;
    overflow-y: hidden;
}
.detail-metrics {
    min-height: 54px;
    margin-top: 28px;
    border-top: 1px solid #edf0f3;
}
.comments-section {
    min-height: 240px;
    padding-top: 20px;
    border-top: 8px solid #f6f7f9;
}
.comments-gate {
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: #9ca3af;
}
.comments-section h2 {
    margin: 0 0 14px;
    font-size: 17px;
}
.comments-section h2 span {
    color: #9ca3af;
    font-size: 12px;
    font-weight: 400;
}
.comment-editor {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 9px;
    padding-bottom: 18px;
    border-bottom: 1px solid #edf0f3;
}
.comment-item {
    display: flex;
    gap: 10px;
    padding: 16px 0;
    border-bottom: 1px solid #edf0f3;
}
.comment-item > div {
    flex: 1;
}
.comment-item p {
    margin: 8px 0;
    line-height: 1.7;
    white-space: pre-wrap;
}
.comment-delete {
    padding: 0;
    font-size: 12px;
}
.comment-delete:hover {
    color: #e5484d;
}
.editor-heading strong {
    font-size: 16px;
}
.solution-editor {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 18px;
}
.preview-block {
    padding: 14px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #fafafa;
}
.preview-block > span {
    display: block;
    margin-bottom: 12px;
    color: #8a8f98;
    font-size: 12px;
}
.editor-actions {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 0;
    background: #fff;
    border-top: 1px solid #edf0f3;
}
</style>
