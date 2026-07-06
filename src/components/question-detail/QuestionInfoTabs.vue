<template>
  <el-tabs :model-value="activeTab" class="tabs" @update:model-value="$emit('update:activeTab', String($event))" @tab-click="$emit('tab-click', $event)">
    <el-tab-pane label="题目描述" name="description">
      <div class="question-header">
        <span class="question-id">{{ questionData?.questionId }}</span>
        <span class="question-title">{{ questionData?.title }}</span>
        <el-tag :type="difficultyTag" size="small" effect="light">
          {{ difficultyText }}
        </el-tag>
        <span class="meta-info">
          时间限制: {{ questionData?.timeLimit || 1000 }}ms &nbsp;|&nbsp;
          内存限制: {{ questionData?.memoryLimit || 256 }}MB
        </span>
      </div>

      <div class="section">
        <div class="section-title">题目描述</div>
        <div class="markdown-body" v-html="renderContent(questionData?.description || '（无）')"></div>
      </div>

      <div class="section">
        <div class="section-title">输入描述</div>
        <div class="markdown-body" v-html="renderContent(questionData?.inputDesc || '（无）')"></div>
      </div>

      <div class="section">
        <div class="section-title">输出描述</div>
        <div class="markdown-body" v-html="renderContent(questionData?.outputDesc || '（无）')"></div>
      </div>

      <div class="section">
        <div class="section-title">样例</div>
        <div class="sample-grid">
          <div v-for="(tc, index) in sampleCases" :key="index" class="sample-box">
            <div class="sample-label">样例输入</div>
            <pre>{{ tc.inputData }}</pre>
            <div class="sample-label sample-output-label">样例输出</div>
            <pre>{{ tc.expectedOutput }}</pre>
          </div>
        </div>
      </div>

      <div v-if="questionData?.hint" class="section">
        <div class="section-title">提示</div>
        <div class="markdown-body" v-html="renderContent(questionData.hint)"></div>
      </div>

      <div class="stats-bar">
        <span>提交: {{ questionData?.totalSubmit || 0 }}</span>
        <span>通过: {{ questionData?.totalAc || 0 }}</span>
        <span>通过率: {{ passRate }}%</span>
        <span>来源: {{ questionData?.source || '未知' }}</span>
        <span>标签: {{ questionData?.tags || '无' }}</span>
      </div>
    </el-tab-pane>

    <el-tab-pane label="题解" name="solution">
      <el-empty description="暂无题解，敬请期待" />
    </el-tab-pane>

    <el-tab-pane label="提交记录" name="submissions">
      <div v-if="submissionsLoading" class="submissions-loading">
        <el-skeleton :rows="5" animated />
      </div>
      <el-empty v-else-if="submissionsList.length === 0" description="暂无提交记录" />
      <div v-else class="submissions-list">
        <el-table :data="submissionsList" stripe style="width: 100%;" :header-cell-style="{ background: '#f5f7fa' }">
          <el-table-column prop="status" label="状态" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.submitStatus)" size="small">
                {{ row.submitStatus }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="timeUsed" label="耗时" width="100" align="center">
            <template #default="{ row }">
              <span>{{ row.timeUsed || '-' }} ms</span>
            </template>
          </el-table-column>
          <el-table-column prop="memoryUsed" label="内存" width="120" align="center">
            <template #default="{ row }">
              <span>{{ row.memoryUsed ? (row.memoryUsed / 1024).toFixed(2) + ' MB' : '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="language" label="语言" width="100" align="center">
            <template #default="{ row }">
              <el-tag link type="primary">{{ row.language }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="submitTime" label="提交时间" min-width="160">
            <template #default="{ row }">
              <span>{{ formatTime(row.createTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" text @click="$emit('view-code', row)">查看代码</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-tab-pane>

    <el-tab-pane label="测试用例" name="testcases">
      <div class="testcase-editor">
        <div class="testcase-toolbar">
          <el-button size="small" type="primary" @click="$emit('add-testcase')">
            添加用例
          </el-button>
          <el-button size="small" plain @click="$emit('reset-to-sample')">
            重置为样例
          </el-button>
          <el-button size="small" type="success" :loading="debugging" @click="$emit('debug')">
            调试运行
          </el-button>
          <span class="testcase-hint">点击卡片查看结果 | 双击卡片编辑</span>
        </div>

        <div class="testcase-list">
          <div
            v-for="(tc, index) in debugTestCases"
            :key="index"
            class="testcase-card"
            :class="{
              'is-active': selectedTestCaseIndex === index,
              'has-result': tc.result,
              passed: tc.passed,
              failed: tc.result && !tc.passed,
              'is-editing': editingTestCaseIndex === index,
            }"
            @click="$emit('select-testcase', index)"
            @dblclick="$emit('start-edit-testcase', index)"
          >
            <div class="testcase-card-header">
              <span class="testcase-card-index">用例 {{ index + 1 }}</span>
              <div class="testcase-card-actions">
                <el-button size="small" text type="primary" @click.stop="$emit('start-edit-testcase', index)">
                  编辑
                </el-button>
                <el-button size="small" text type="danger" class="testcase-card-delete" @click.stop="$emit('remove-testcase', index)">
                  删除
                </el-button>
              </div>
            </div>

            <template v-if="editingTestCaseIndex !== index">
              <div class="testcase-card-preview">
                {{ tc.input ? tc.input.slice(0, 40) + (tc.input.length > 40 ? '...' : '') : '（空）' }}
              </div>
              <div class="testcase-card-footer">
                <el-tag v-if="tc.result" type="primary">
                  {{ tc.result.submitStatus }}
                </el-tag>
                <el-tag v-else type="info" size="small">等待</el-tag>
                <span v-if="tc.result" class="testcase-card-metrics">
                  {{ tc.result.timeUsed || 0 }}ms
                </span>
              </div>
            </template>

            <template v-else>
              <div class="testcase-edit-body">
                <div class="testcase-edit-input">
                  <div class="testcase-edit-label">输入</div>
                  <el-input v-model="tc.input" type="textarea" :rows="2" placeholder="请输入测试输入" spellcheck="false" @click.stop />
                </div>
                <div class="testcase-edit-output">
                  <div class="testcase-edit-label">期望输出</div>
                  <el-input v-model="tc.expectedOutput" type="textarea" :rows="2" placeholder="留空则只显示实际输出" spellcheck="false" @click.stop />
                </div>
                <div class="testcase-edit-actions">
                  <el-button size="small" type="primary" @click.stop="$emit('finish-edit-testcase')">
                    完成编辑
                  </el-button>
                  <el-button size="small" @click.stop="$emit('cancel-edit-testcase')">
                    取消
                  </el-button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <el-empty v-if="debugTestCases.length === 0" description="暂无测试用例，点击添加用例创建" />
      </div>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import type { TabsPaneContext } from 'element-plus'
import type { DebugTestCase, SampleCase } from '@/types/QuestionDetail'

defineProps<{
  activeTab: string
  questionData: any
  difficultyTag: string
  difficultyText: string
  sampleCases: SampleCase[]
  passRate: string | number
  renderContent: (content: string) => string | Promise<string>
  submissionsLoading: boolean
  submissionsList: any[]
  getStatusType: (status: string) => string
  formatTime: (time: string) => string
  debugTestCases: DebugTestCase[]
  selectedTestCaseIndex: number | null
  editingTestCaseIndex: number | null
  debugging: boolean
}>()

defineEmits<{
  (event: 'update:activeTab', value: string): void
  (event: 'tab-click', value: TabsPaneContext): void
  (event: 'view-code', value: any): void
  (event: 'add-testcase'): void
  (event: 'reset-to-sample'): void
  (event: 'debug'): void
  (event: 'select-testcase', value: number): void
  (event: 'start-edit-testcase', value: number): void
  (event: 'remove-testcase', value: number): void
  (event: 'finish-edit-testcase'): void
  (event: 'cancel-edit-testcase'): void
}>()
</script>

<style scoped>
.tabs {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tabs :deep(.el-tabs__header) {
  flex-shrink: 0;
  margin: 0 0 20px 0;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 10;
  padding-top: 16px;
}

.tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 4px;
}

.tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 500;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.question-id {
  font-size: 13px;
  color: #909399;
}

.question-title {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.meta-info {
  font-size: 13px;
  color: #909399;
  margin-left: auto;
}

.section {
  margin-bottom: 28px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.markdown-body {
  font-size: 15px;
  line-height: 1.9;
  color: #303133;
}

.markdown-body :deep(p) {
  margin: 10px 0;
}

.markdown-body :deep(code) {
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
}

.markdown-body :deep(pre) {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 14px 18px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.7;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin: 10px 0;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.sample-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 8px;
}

.sample-box {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 14px 18px;
  border: 1px solid #e4e7ed;
}

.sample-box pre {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #303133;
  margin: 6px 0 0 0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}

.sample-label {
  font-size: 13px;
  font-weight: 600;
  color: #909399;
}

.sample-output-label {
  margin-top: 8px;
}

.stats-bar {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: #909399;
  flex-wrap: wrap;
}

.submissions-list {
  padding: 8px 0;
  height: 100%;
  overflow-y: auto;
  max-height: calc(100vh - 350px);
}

.submissions-list .el-table {
  width: 100%;
}

.submissions-list :deep(.el-table__body-wrapper) {
  overflow-y: auto !important;
}

.submissions-list :deep(.el-table__row:hover) {
  background: #f0f2f5;
}

.submissions-loading {
  padding: 20px;
}

.testcase-editor {
  padding: 4px 0;
}

.testcase-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.testcase-hint {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
}

.testcase-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding-right: 4px;
}

.testcase-card {
  background: #f5f7fa;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.testcase-card:hover {
  background: #eef2f7;
  border-color: #d8dce5;
}

.testcase-card.is-active {
  border-color: #409eff;
  background: #ecf5ff;
}

.testcase-card.passed {
  border-left: 4px solid #67c23a;
}

.testcase-card.failed {
  border-left: 4px solid #f56c6c;
}

.testcase-card.is-editing {
  border-color: #409eff;
  background: #ecf5ff;
  cursor: default;
}

.testcase-card.is-editing:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.testcase-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.testcase-card-index {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
}

.testcase-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.testcase-card-actions .el-button {
  padding: 0 4px;
  font-size: 12px;
}

.testcase-card-delete {
  opacity: 0.5;
  transition: opacity 0.2s;
}

.testcase-card-delete:hover {
  opacity: 1;
}

.testcase-card-preview {
  font-size: 13px;
  color: #606266;
  margin: 4px 0;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.testcase-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.testcase-card-metrics {
  font-size: 12px;
  color: #909399;
}

.testcase-edit-body {
  width: 100%;
  padding: 4px 0;
}

.testcase-edit-input,
.testcase-edit-output {
  margin-bottom: 8px;
}

.testcase-edit-label {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 2px;
}

.testcase-edit-body .el-textarea {
  font-family: 'JetBrains Mono', monospace;
}

.testcase-edit-body .el-textarea :deep(textarea) {
  font-size: 13px;
  background: #fff;
}

.testcase-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

@media (max-width: 1024px) {
  .sample-grid {
    grid-template-columns: 1fr;
  }

  .question-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .meta-info {
    margin-left: 0;
  }
}
</style>
