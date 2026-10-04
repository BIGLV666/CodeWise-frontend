<template>
  <el-dialog
    :model-value="modelValue"
    :title="mode === 'create' ? '添加自定义模型' : '修改模型配置'"
    width="520px"
    destroy-on-close
    class="ai-config-dialog"
    @close="closeDialog"
  >
    <div class="dialog-intro">
      <span class="provider-mark"><el-icon><Connection /></el-icon></span>
      <div>
        <strong>连接 OpenAI 兼容服务</strong>
        <p>密钥仅用于服务端调用，不会在保存后回显。</p>
      </div>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="配置名称" prop="groupName">
        <el-input v-model="form.groupName" maxlength="64" placeholder="例如：我的 DeepSeek" />
      </el-form-item>

      <el-form-item label="API 地址" prop="aiUrl">
        <el-input v-model="form.aiUrl" placeholder="https://api.example.com/v1" @input="resetTestResult" />
        <span class="field-note">填写 API 基础地址，不需要添加 /chat/completions。</span>
      </el-form-item>

      <el-form-item label="API Key" prop="apiKey">
        <el-input
          v-model="form.apiKey"
          type="password"
          show-password
          autocomplete="new-password"
          :placeholder="mode === 'create' ? '输入 API Key' : '输入新的 API Key'"
          @input="resetTestResult"
        />
        <span v-if="mode === 'edit' && isStoredApiKey" class="field-note">
          这是当前已保存的 Key（脱敏显示）；输入新 Key 后才会替换并可重新测试。
        </span>
      </el-form-item>

      <div class="connection-row">
        <el-button
          :icon="Connection"
          :loading="testing"
          :disabled="!canTest"
          @click="testConnection"
        >
          测试连接
        </el-button>
        <span v-if="testedModels.length" class="connection-success">
          <el-icon><CircleCheck /></el-icon>
          已发现 {{ testedModels.length }} 个模型
        </span>
        <span v-else class="connection-hint">填写地址和密钥后获取模型名称</span>
      </div>

      <div v-if="testedModels.length" class="detected-models" aria-live="polite">
        <span v-for="model in testedModels" :key="model">{{ model }}</span>
      </div>

      <el-form-item label="可用模型" prop="modelNames" class="model-field">
        <el-select
          v-model="form.modelNames"
          multiple
          filterable
          allow-create
          default-first-option
          :disabled="!availableModels.length && mode === 'create'"
          placeholder="请先测试连接"
          style="width: 100%"
        >
          <el-option v-for="model in availableModels" :key="model" :label="model" :value="model" />
        </el-select>
        <span class="field-note">可以选择多个模型，AI 助手中会分别列出。</span>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="closeDialog">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">
          {{ mode === 'create' ? '添加模型' : '保存修改' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CircleCheck, Connection } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import aiApi, { type UserAiConfigDetail, type UserAiConfigPayload } from '@/api/aiApi'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode?: 'create' | 'edit'
    configId?: number | null
  }>(),
  { mode: 'create', configId: null },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'saved', config: UserAiConfigDetail): void
}>()

const formRef = ref<FormInstance>()
const loading = ref(false)
const testing = ref(false)
const saving = ref(false)
const testedModels = ref<string[]>([])
const originalModels = ref<string[]>([])
const originalApiKeyDisplay = ref('')
const form = reactive<UserAiConfigPayload>({
  groupName: '',
  aiUrl: '',
  apiKey: '',
  modelNames: [],
})

const rules: FormRules = {
  groupName: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
  aiUrl: [
    { required: true, message: '请输入 API 地址', trigger: 'blur' },
    { type: 'url', message: '请输入完整的 HTTPS 地址', trigger: 'blur' },
  ],
  apiKey: [
    {
      validator: (_rule, value, callback) => {
        if (props.mode === 'create' && !String(value || '').trim()) callback(new Error('请输入 API Key'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
  modelNames: [{ type: 'array', required: true, min: 1, message: '至少选择一个模型', trigger: 'change' }],
}

const availableModels = computed(() => Array.from(new Set([...originalModels.value, ...testedModels.value])))
const isStoredApiKey = computed(
  () => props.mode === 'edit' && Boolean(originalApiKeyDisplay.value) && form.apiKey === originalApiKeyDisplay.value,
)
const canTest = computed(
  () => Boolean(form.aiUrl.trim() && String(form.apiKey || '').trim() && !isStoredApiKey.value),
)

const unwrap = <T,>(response: any, fallback: T): T => (response?.data ?? response ?? fallback) as T

function resetForm() {
  form.groupName = ''
  form.aiUrl = ''
  form.apiKey = ''
  form.modelNames = []
  testedModels.value = []
  originalModels.value = []
  originalApiKeyDisplay.value = ''
  formRef.value?.clearValidate()
}

async function loadConfig() {
  if (props.mode !== 'edit' || !props.configId) return
  loading.value = true
  try {
    const config = unwrap<UserAiConfigDetail>(await aiApi.getConfig(props.configId), {} as UserAiConfigDetail)
    form.groupName = config.groupName || ''
    form.aiUrl = config.aiUrl || ''
    form.apiKey = config.apiKey || ''
    originalApiKeyDisplay.value = config.apiKey || ''
    form.modelNames = [...(config.modelNames || [])]
    originalModels.value = [...(config.modelNames || [])]
  } finally {
    loading.value = false
  }
}

function resetTestResult() {
  testedModels.value = []
}

async function testConnection() {
  if (!canTest.value || testing.value) return
  testing.value = true
  try {
    const models = unwrap<string[]>(
      await aiApi.fetchModels({ baseUrl: form.aiUrl.trim(), apiKey: String(form.apiKey).trim() }),
      [],
    )
    testedModels.value = models
    form.modelNames = form.modelNames.filter((model) => availableModels.value.includes(model))
    if (models.length === 1) form.modelNames = [...models]
    ElMessage.success(`连接成功，发现 ${models.length} 个模型`)
  } finally {
    testing.value = false
  }
}

async function saveConfig() {
  if (saving.value || loading.value) return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const payload: UserAiConfigPayload = {
      groupName: form.groupName.trim(),
      aiUrl: form.aiUrl.trim(),
      modelNames: [...form.modelNames],
      apiKey:
        props.mode === 'edit' && form.apiKey === originalApiKeyDisplay.value
          ? undefined
          : String(form.apiKey || '').trim() || undefined,
    }
    const response = props.mode === 'edit' && props.configId
      ? await aiApi.updateConfig(props.configId, payload)
      : await aiApi.createConfig(payload)
    const config = unwrap<UserAiConfigDetail>(response, {} as UserAiConfigDetail)
    ElMessage.success(props.mode === 'create' ? '模型配置已添加' : '模型配置已更新')
    emit('saved', config)
    closeDialog()
  } finally {
    saving.value = false
  }
}

function closeDialog() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    resetForm()
    loadConfig()
  },
)
</script>

<style scoped>
.dialog-intro {
  margin: -4px 0 22px;
  padding: 14px;
  border: 1px solid var(--cw-bg-subtle);
  border-radius: 8px;
  background: var(--cw-bg-page);
  display: flex;
  align-items: center;
  gap: 12px;
}
.provider-mark {
  width: 38px;
  height: 38px;
  border-radius: 7px;
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
  display: grid;
  place-items: center;
  font-size: 19px;
  flex: 0 0 auto;
}
.dialog-intro strong {
  color: var(--cw-text-1);
  font-size: 14px;
}
.dialog-intro p {
  margin: 3px 0 0;
  color: var(--cw-text-3);
  font-size: 12px;
}
.field-note {
  margin-top: 5px;
  color: #989da5;
  font-size: 12px;
  line-height: 1.5;
}
.connection-row {
  min-height: 34px;
  margin: -2px 0 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.connection-success {
  color: var(--cw-success);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
}
.connection-hint {
  color: var(--cw-text-3);
  font-size: 12px;
}
.detected-models {
  margin: -8px 0 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.detected-models span {
  max-width: 100%;
  padding: 4px 8px;
  border: 1px solid #dceee8;
  border-radius: 5px;
  background: #f2faf7;
  color: var(--cw-success);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.model-field {
  margin-bottom: 2px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 600px) {
  .connection-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
