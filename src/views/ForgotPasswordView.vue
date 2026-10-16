<template>
  <div class="auth-page">
    <main class="auth-shell">
      <section class="panel">
        <div class="brand-row"><BrandLogo :size="36" /></div>

        <div class="panel-heading">
          <span class="eyebrow">ACCOUNT RECOVERY</span>
          <h1>找回密码</h1>
          <p>通过注册邮箱验证身份后设置新密码。</p>
        </div>

        <el-steps :active="step" align-center finish-status="success" class="steps">
          <el-step title="验证邮箱" />
          <el-step title="设置新密码" />
        </el-steps>

        <el-form
          v-if="step === 0"
          ref="emailFormRef"
          :model="form"
          :rules="emailRules"
          label-position="top"
          size="large"
          class="auth-form"
          @submit.prevent="sendCode"
        >
          <el-form-item label="注册邮箱" prop="email">
            <el-input
              v-model.trim="form.email"
              maxlength="254"
              :prefix-icon="Message"
              autocomplete="email"
              placeholder="请输入注册时使用的邮箱"
              clearable
            />
          </el-form-item>

          <el-button
            type="primary"
            native-type="submit"
            class="primary-button"
            :loading="sending"
          >发送验证码</el-button>
        </el-form>

        <el-form
          v-else
          ref="resetFormRef"
          :model="form"
          :rules="resetRules"
          label-position="top"
          size="large"
          class="auth-form"
          @submit.prevent="resetPassword"
        >
          <el-form-item label="验证码" prop="code">
            <div class="code-row">
              <el-input
                v-model.trim="form.code"
                :prefix-icon="Key"
                autocomplete="one-time-code"
                placeholder="6 位验证码"
                maxlength="6"
              />
              <el-button
                class="code-button"
                :disabled="countdown > 0 || sending"
                :loading="sending"
                @click="sendCode"
              >
                {{ countdown > 0 ? `${countdown}s` : '重新发送' }}
              </el-button>
            </div>
          </el-form-item>

          <el-form-item label="新密码" prop="password">
            <el-input
              v-model="form.password"
              :prefix-icon="Lock"
              type="password"
              autocomplete="new-password"
              placeholder="至少 6 位"
              show-password
            />
          </el-form-item>

          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              :prefix-icon="Lock"
              type="password"
              autocomplete="new-password"
              placeholder="再次输入新密码"
              show-password
            />
          </el-form-item>

          <el-button
            type="primary"
            native-type="submit"
            class="primary-button"
            :loading="submitting"
          >重置密码</el-button>

          <button type="button" class="text-action back-action" @click="backToEmail">
            换个邮箱
          </button>
        </el-form>

        <p class="footer-row">
          想起密码了？
          <button type="button" class="text-action strong" @click="router.replace('/login')">返回登录</button>
        </p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Key, Lock, Message } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import userApi from '@/api/userApi'
import { logWarn } from '@/utils/logger'

const CODE_COUNTDOWN_SECONDS = 60

const router = useRouter()
const emailFormRef = ref<FormInstance>()
const resetFormRef = ref<FormInstance>()
const step = ref(0)
const sending = ref(false)
const submitting = ref(false)
const countdown = ref(0)
const form = reactive({ email: '', code: '', password: '', confirmPassword: '' })
let countdownTimer: number | undefined

const emailRules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
    { max: 254, message: '邮箱最多 254 个字符', trigger: 'blur' },
  ],
}

const resetRules: FormRules = {
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少需要 6 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

onBeforeUnmount(() => {
  if (countdownTimer) window.clearInterval(countdownTimer)
})

function startCountdown() {
  countdown.value = CODE_COUNTDOWN_SECONDS
  if (countdownTimer) window.clearInterval(countdownTimer)
  countdownTimer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && countdownTimer) {
      window.clearInterval(countdownTimer)
      countdownTimer = undefined
    }
  }, 1000)
}

async function sendCode() {
  if (sending.value || countdown.value > 0) return
  const targetRef = step.value === 0 ? emailFormRef.value : resetFormRef.value
  // 第二步重发时表单里没有 email 字段，直接沿用已确认的邮箱。
  if (step.value === 0) {
    const valid = await targetRef?.validateField('email').then(() => true).catch(() => false)
    if (!valid) return
  }

  sending.value = true
  try {
    await userApi.updataPasswordForEmail(form.email)
    ElMessage.success('验证码已发送，请查收邮件')
    startCountdown()
    step.value = 1
  } catch (error) {
    logWarn('发送验证码失败:', error)
  } finally {
    sending.value = false
  }
}

async function resetPassword() {
  if (!resetFormRef.value || submitting.value) return
  const valid = await resetFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await userApi.updatefromcode(form.email, form.code, form.password)
    ElMessage.success('密码已重置，请使用新密码登录')
    await router.replace('/login')
  } catch (error) {
    logWarn('重置密码失败:', error)
  } finally {
    submitting.value = false
  }
}

function backToEmail() {
  step.value = 0
  form.code = ''
  form.password = ''
  form.confirmPassword = ''
}
</script>

<style scoped>
.auth-page {
  --ink: var(--cw-text-1);
  --muted: #68707b;
  --accent: var(--cw-brand);
  min-height: 100vh; min-height: 100dvh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  background-color: var(--cw-bg-subtle);
  background-image: linear-gradient(rgba(32,33,36,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(32,33,36,.045) 1px, transparent 1px);
  background-size: 28px 28px;
  font-family: var(--cw-font-sans);
}

.auth-shell {
  width: min(460px, calc(100% - 40px));
  padding: 32px 0;
}

.panel {
  padding: 40px 36px;
  border: 1px solid rgba(255,255,255,.72);
  border-radius: 10px;
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(18px) saturate(120%);
  -webkit-backdrop-filter: blur(18px) saturate(120%);
  box-shadow: 0 24px 70px rgba(37,43,51,.14);
}

.brand-row { margin-bottom: 28px; display: flex; align-items: center; }
.eyebrow { display: block; margin-bottom: 10px; color: var(--cw-brand-dark); font-size: 11px; font-weight: 750; }
.panel-heading h1 { margin: 0; font-size: 26px; line-height: 1.25; font-weight: 740; }
.panel-heading p { margin: 10px 0 0; color: var(--muted); font-size: 14px; }

.steps { margin: 28px 0 24px; }

.auth-form :deep(.el-form-item) { margin-bottom: 20px; }
.auth-form :deep(.el-form-item__label) { padding-bottom: 7px; color: var(--cw-text-2); font-size: 13px; font-weight: 650; }
.auth-form :deep(.el-input__wrapper) { min-height: 46px; border-radius: 6px; background: rgba(255,255,255,.72); box-shadow: 0 0 0 1px rgba(32,33,36,.16) inset; transition: box-shadow .18s ease, background-color .18s ease; }
.auth-form :deep(.el-input__wrapper:hover) { box-shadow: 0 0 0 1px rgba(32,33,36,.3) inset; }
.auth-form :deep(.el-input__wrapper.is-focus) { background: #fff; box-shadow: 0 0 0 1px var(--accent) inset, 0 0 0 3px rgba(245,166,35,.13); }

.code-row { display: flex; gap: 10px; width: 100%; }
.code-row .el-input { flex: 1; min-width: 0; }
.code-button { min-width: 104px; height: 46px; border-radius: 6px; }

.primary-button { width: 100%; height: 46px; border-radius: 6px; border-color: var(--ink); background: var(--ink); color: #fff; font-size: 14px; font-weight: 700; }
.primary-button:hover, .primary-button:focus { border-color: #34363a; background: #34363a; }

.text-action { padding: 0; border: 0; background: transparent; color: var(--cw-brand-deep); font: inherit; font-size: 13px; cursor: pointer; }
.text-action:hover { color: var(--cw-brand-deep); text-decoration: underline; }
.text-action.strong { font-weight: 700; }
.back-action { display: block; margin: 16px auto 0; }

.footer-row { margin: 24px 0 0; color: var(--muted); font-size: 13px; text-align: center; }

@media (max-width: 768px) {
  .panel { padding: 32px 24px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: .01ms !important; }
}
</style>
