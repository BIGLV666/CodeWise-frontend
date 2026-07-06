<template>
  <div v-if="judgeResult" class="result-area">
    <div class="result-status-bar" :class="judgeResultClass">
      <div class="result-status-left">
        <el-icon v-if="judgeResult.submitStatus === 'AC'" class="status-icon success">
          <CircleCheck />
        </el-icon>
        <el-icon v-else-if="judgeResult.submitStatus === 'PENDING'" class="status-icon pending">
          <Loading />
        </el-icon>
        <el-icon v-else class="status-icon error">
          <CircleClose />
        </el-icon>
        <span class="status-text">{{ statusText }}</span>
        <span v-if="judgeResult.timeUsed !== null" class="status-metric">{{ judgeResult.timeUsed }}ms</span>
        <span v-if="judgeResult.memoryUsed !== null" class="status-metric">{{ formatMemory(judgeResult.memoryUsed) }}MB</span>
      </div>
      <el-button size="small" text @click="$emit('clear-result')">关闭</el-button>
    </div>

    <div v-if="judgeResult.submitStatus === 'AC'" class="result-content ac-content">
      <el-result icon="success" title="Accepted" sub-title="恭喜通过">
        <template #extra>
          <span>耗时: {{ judgeResult.timeUsed }}ms | 内存: {{ formatMemory(judgeResult.memoryUsed) }}MB</span>
        </template>
      </el-result>
    </div>

    <div v-else-if="judgeResult.submitStatus === 'PENDING'" class="result-content">
      <el-result icon="info" title="判题中..." sub-title="请稍候">
        <template #extra>
          <el-progress :percentage="judgeProgress" :stroke-width="8" />
        </template>
      </el-result>
    </div>

    <div v-else class="result-content error-content">
      <div class="error-section">
        <div class="error-title">错误信息</div>
        <el-alert :title="judgeResult.error || '未知错误'" type="error" show-icon :closable="false" />
      </div>
      <div v-if="judgeResult.log" class="log-section">
        <div class="log-title">完整日志</div>
        <pre class="log-content">{{ judgeResult.log }}</pre>
      </div>
      <div class="sample-section">
        <div class="sample-title">失败测试点</div>
        <el-card shadow="hover" class="sample-card input-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">输入</span>
              <el-button size="small" text @click="$emit('copy-text', parsedTestData.input)">复制</el-button>
            </div>
          </template>
          <pre class="card-content">{{ parsedTestData.input || '（无）' }}</pre>
        </el-card>
        <el-card shadow="hover" class="sample-card expected-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">期望输出</span>
              <el-button size="small" text @click="$emit('copy-text', parsedTestData.expected)">复制</el-button>
            </div>
          </template>
          <pre class="card-content expected">{{ parsedTestData.expected || '（无）' }}</pre>
        </el-card>
        <el-card shadow="hover" class="sample-card actual-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">实际输出</span>
              <el-button size="small" text @click="$emit('copy-text', parsedTestData.actual)">复制</el-button>
            </div>
          </template>
          <pre class="card-content actual">{{ parsedTestData.actual || '（无输出）' }}</pre>
        </el-card>
      </div>
      <div v-if="allTestCases && allTestCases.length > 1" class="summary-section">
        <div class="summary-title">测试点概览 ({{ allTestCases.length }})</div>
        <div class="testcase-summary">
          <div
            v-for="(tc, index) in allTestCases"
            :key="index"
            class="testcase-dot"
            :class="tc.passed ? 'passed' : 'failed'"
            :title="`测试点 ${index + 1}: ${tc.passed ? '通过' : '失败'}`"
          >
            {{ index + 1 }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="selectedTestCase && selectedTestCase.result" class="result-area">
    <div class="result-status-bar" :class="selectedTestCase.passed ? 'ac' : 'wa'">
      <div class="result-status-left">
        <el-icon v-if="selectedTestCase.passed" class="status-icon success">
          <CircleCheck />
        </el-icon>
        <el-icon v-else class="status-icon error">
          <CircleClose />
        </el-icon>
        <span class="status-text">{{ selectedTestCase.result.submitStatus }}</span>
        <span class="status-metric">{{ selectedTestCase.result.timeUsed || 0 }}ms</span>
        <span class="status-metric">{{ formatMemory(selectedTestCase.result.memoryUsed) }}MB</span>
      </div>
      <el-button size="small" text @click="$emit('clear-selected-testcase')">关闭</el-button>
    </div>
    <div class="result-content">
      <el-card shadow="hover" class="sample-card input-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">输入</span>
            <el-button size="small" text @click="$emit('copy-text', selectedTestCase.input)">复制</el-button>
          </div>
        </template>
        <pre class="card-content">{{ selectedTestCase.input || '（无）' }}</pre>
      </el-card>
      <el-card shadow="hover" class="sample-card expected-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">期望输出</span>
            <el-button size="small" text @click="$emit('copy-text', selectedTestCase.expectedOutput)">复制</el-button>
          </div>
        </template>
        <pre class="card-content expected">{{ selectedTestCase.expectedOutput || '（无）' }}</pre>
      </el-card>
      <el-card shadow="hover" class="sample-card actual-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">实际输出</span>
            <el-button size="small" text @click="$emit('copy-text', selectedTestCase.result.userOutput)">复制</el-button>
          </div>
        </template>
        <pre class="card-content actual">{{ selectedTestCase.result.userOutput || '（无输出）' }}</pre>
      </el-card>
      <div v-if="selectedTestCase.result.submitStatus !== 'AC'" class="error-section">
        <div class="error-title">错误信息</div>
        <el-alert :title="selectedTestCase.result.errorMsg" type="error" show-icon :closable="false" />
      </div>
      <div v-if="selectedTestCase.result.log" class="log-section">
        <div class="log-title">完整日志</div>
        <pre class="log-content">{{ selectedTestCase.result.log }}</pre>
      </div>
    </div>
  </div>

  <div v-else-if="selectedTestCase && !selectedTestCase.result" class="result-placeholder">
    <el-empty description="该用例尚未运行，请点击调试运行" :image-size="80" />
  </div>

  <div v-else class="result-placeholder">
    <el-empty description="提交代码或点击左侧用例查看详情" :image-size="80" />
  </div>
</template>

<script setup lang="ts">
import { CircleCheck, CircleClose, Loading } from '@element-plus/icons-vue'
import type { DebugTestCase, JudgeResultDTO, ParsedTestData } from '@/types/QuestionDetail'

defineProps<{
  judgeResult: JudgeResultDTO | null
  judgeResultClass: string
  statusText: string
  judgeProgress: number
  parsedTestData: ParsedTestData
  allTestCases: any[]
  selectedTestCase: DebugTestCase | null
}>()

defineEmits<{
  (event: 'clear-result'): void
  (event: 'copy-text', value: any): void
  (event: 'clear-selected-testcase'): void
}>()

const formatMemory = (value?: number | null) => {
  return value ? (value / 1024).toFixed(2) : '0'
}
</script>

<style scoped>
.result-area {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
  min-height: 0;
  max-height: 100%;
}

.result-area::-webkit-scrollbar {
  width: 4px;
}

.result-area::-webkit-scrollbar-thumb {
  background: #d8dce5;
  border-radius: 2px;
}

.result-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.result-status-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-icon {
  font-size: 22px;
}

.status-icon.success {
  color: #67c23a;
}

.status-icon.error {
  color: #f56c6c;
}

.status-icon.pending {
  color: #e6a23c;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-text {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.status-metric {
  font-size: 13px;
  color: #909399;
}

.error-section {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.error-title {
  font-size: 12px;
  font-weight: 600;
  color: #f56c6c;
  margin-bottom: 2px;
}

.error-section .el-alert {
  padding: 4px 10px;
  font-size: 12px;
}

.sample-section {
  margin-bottom: 6px;
  flex-shrink: 0;
}

.sample-title,
.log-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.sample-card {
  background: #fafafa;
  margin-bottom: 4px;
}

.sample-card:last-child {
  margin-bottom: 0;
}

.sample-card :deep(.el-card__header) {
  padding: 2px 8px;
  border-bottom: 1px solid #f0f0f0;
}

.sample-card :deep(.el-card__body) {
  padding: 4px 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 12px;
  font-weight: 600;
}

.input-card .card-title {
  color: #409eff;
}

.expected-card .card-title {
  color: #67c23a;
}

.actual-card .card-title {
  color: #f56c6c;
}

.card-content {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
  padding: 2px 0;
}

.card-content.expected {
  border-left: 3px solid #67c23a;
  padding-left: 6px;
}

.card-content.actual {
  border-left: 3px solid #f56c6c;
  padding-left: 6px;
}

.summary-section {
  margin-top: 4px;
}

.summary-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.testcase-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.testcase-dot {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
}

.testcase-dot.passed {
  background: #67c23a;
}

.testcase-dot.failed {
  background: #f56c6c;
}

.log-section {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.log-content {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.6;
  background: #1a1a2e;
  color: #d4d4d4;
  padding: 10px 12px;
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
  margin: 0;
  border: 1px solid #333;
}

.log-content::-webkit-scrollbar {
  width: 4px;
}

.log-content::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 2px;
}

.result-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
</style>
