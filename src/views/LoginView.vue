<template>
  <div class="auth-page">
    <header class="brand-bar">
      <BrandLogo :size="38" inverse />
    </header>

    <main class="auth-shell">
      <section class="workspace-showcase" aria-labelledby="showcase-title">
        <div class="showcase-copy">
          <span class="eyebrow">CODING WORKSPACE</span>
          <h1 id="showcase-title">把每一次提交，变成下一次进步。</h1>
          <p>刷题、复习、题解与 AI 建议，都在同一个工作台里。</p>
        </div>

        <div class="editor-window" aria-hidden="true">
          <div class="editor-topbar">
            <div class="window-controls"><i></i><i></i><i></i></div>
            <span>Two Sum</span><span class="language">Java</span>
          </div>
          <div class="editor-body">
            <div class="line-numbers">1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9</div>
            <pre><code><b>class</b> <em>Solution</em> {
  <b>public</b> <em>int</em>[] twoSum(<em>int</em>[] nums, <em>int</em> target) {
    Map&lt;Integer, Integer&gt; seen = <b>new</b> HashMap&lt;&gt;();
    <b>for</b> (<em>int</em> i = 0; i &lt; nums.length; i++) {
      <em>int</em> need = target - nums[i];
      <b>if</b> (seen.containsKey(need))
        <b>return new</b> <em>int</em>[] { seen.get(need), i };
      seen.put(nums[i], i);
    }
  }
}</code></pre>
          </div>
          <div class="editor-status">
            <span><i></i> 已保存</span><span>Ln 9, Col 4</span>
          </div>
        </div>

        <div class="feature-strip" aria-hidden="true">
          <span><el-icon><CircleCheck /></el-icon>训练记录</span>
          <span><el-icon><Refresh /></el-icon>智能复习</span>
          <span><el-icon><MagicStick /></el-icon>AI 建议</span>
        </div>
      </section>

      <section class="login-column" aria-labelledby="login-title">
        <div class="login-panel">
          <div class="mobile-brand"><BrandLogo :size="36" /></div>
          <div class="login-heading">
            <span class="eyebrow">WELCOME BACK</span>
            <h2 id="login-title">登录账户</h2>
            <p>继续你的算法训练与复习计划。</p>
          </div>

          <el-radio-group v-model="loginMode" class="mode-switch" size="small">
            <el-radio-button value="password">密码登录</el-radio-button>
            <el-radio-button value="code">验证码登录</el-radio-button>
          </el-radio-group>

          <el-form
            v-if="loginMode === 'password'"
            ref="loginFormRef"
            :model="loginForm"
            :rules="rules"
            label-position="top"
            size="large"
            class="login-form"
            @submit.prevent="handleLogin"
          >
            <el-form-item label="用户名或邮箱" prop="username">
              <el-input
                v-model.trim="loginForm.username"
                :prefix-icon="User"
                autocomplete="username"
                placeholder="请输入用户名或邮箱"
                clearable
              />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="loginForm.password"
                :prefix-icon="Lock"
                type="password"
                autocomplete="current-password"
                placeholder="请输入密码"
                show-password
              />
            </el-form-item>

            <div class="form-options">
              <el-checkbox v-model="loginForm.remember">记住账号</el-checkbox>
              <button type="button" class="text-action" @click="router.push('/forgot-password')">找回密码</button>
            </div>
            <el-button
              type="primary"
              native-type="submit"
              class="login-button"
              :loading="loading"
            >登录</el-button>
            <p class="register-row">
              还没有账号？
              <button type="button" class="text-action strong" @click="router.push('/register')">免费注册</button>
            </p>
          </el-form>

          <el-form
            v-else
            ref="codeFormRef"
            :model="codeForm"
            :rules="codeRules"
            label-position="top"
            size="large"
            class="login-form"
            @submit.prevent="handleCodeLogin"
          >
            <el-form-item label="邮箱" prop="email">
              <el-input
                v-model.trim="codeForm.email"
                :prefix-icon="Message"
                autocomplete="email"
                placeholder="请输入已注册的邮箱"
                clearable
              />
            </el-form-item>
            <el-form-item label="验证码" prop="code">
              <div class="code-row">
                <el-input
                  v-model.trim="codeForm.code"
                  :prefix-icon="Key"
                  autocomplete="one-time-code"
                  placeholder="6 位验证码"
                  maxlength="6"
                />
                <el-button
                  class="code-button"
                  :disabled="countdown > 0 || sendingCode"
                  :loading="sendingCode"
                  @click="sendLoginCode"
                >
                  {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>

            <el-button
              type="primary"
              native-type="submit"
              class="login-button"
              :loading="loading"
            >登录</el-button>
            <p class="register-row">
              还没有账号？
              <button type="button" class="text-action strong" @click="router.push('/register')">免费注册</button>
            </p>
          </el-form>
          <p class="privacy-note">登录即表示你同意平台的使用规范与隐私说明。</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CircleCheck, Key, Lock, MagicStick, Message, Refresh, User } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import userApi from '@/api/userApi'
import { useUserStore } from '@/stores/User'
import type UserDto from '@/types/UserDto'

const REMEMBERED_ACCOUNT_KEY = 'codewise_remembered_account'
const CODE_COUNTDOWN_SECONDS = 60

const loginFormRef = ref<FormInstance>()
const codeFormRef = ref<FormInstance>()
const loading = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const loginMode = ref<'password' | 'code'>('password')
const router = useRouter()
const userStore = useUserStore()
const loginForm = reactive({ username: '', password: '', remember: false })
const codeForm = reactive({ email: '', code: '' })
let countdownTimer: number | undefined

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名或邮箱', trigger: 'blur' },
    { min: 3, message: '账号至少需要 3 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少需要 6 个字符', trigger: 'blur' },
  ],
}

const codeRules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
  ],
}

onMounted(() => {
  const remembered = localStorage.getItem(REMEMBERED_ACCOUNT_KEY)
  if (!remembered) return
  loginForm.username = remembered
  loginForm.remember = true
  // 记住的账号是邮箱时，切到验证码登录可直接复用。
  if (remembered.includes('@')) codeForm.email = remembered
})

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

async function sendLoginCode() {
  if (sendingCode.value || countdown.value > 0) return
  // 只校验邮箱字段，避免未填验证码就报错。
  const valid = await codeFormRef.value?.validateField('email').then(() => true).catch(() => false)
  if (!valid) return

  sendingCode.value = true
  try {
    await userApi.getEmailCode(codeForm.email)
    ElMessage.success('验证码已发送，请查收邮件')
    startCountdown()
  } catch (error) {
    console.error('发送验证码失败:', error)
  } finally {
    sendingCode.value = false
  }
}

/** 登录成功后的共用收尾：落库身份并跳转。 */
async function applyLoginResult(payload: any, rememberAccount?: string) {
  const user = payload?.user
  if (!payload?.token || !user) throw new Error('登录响应缺少用户信息')

  const userDto: UserDto = { ...user, userId: String(user.userId) }
  userStore.setLoginData({ token: String(payload.token), userDto })
  if (rememberAccount) localStorage.setItem(REMEMBERED_ACCOUNT_KEY, rememberAccount)
  else localStorage.removeItem(REMEMBERED_ACCOUNT_KEY)

  ElMessage.success('登录成功')
  const redirect = router.currentRoute.value.query.redirect
  await router.replace(typeof redirect === 'string' && redirect ? redirect : '/home')
}

async function handleCodeLogin() {
  if (!codeFormRef.value || loading.value) return
  const valid = await codeFormRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const response: any = await userApi.emailLoginForCode(codeForm.email, codeForm.code)
    await applyLoginResult(response?.data ?? response, codeForm.email)
  } catch (error) {
    console.error('验证码登录失败:', error)
  } finally {
    loading.value = false
  }
}

async function handleLogin() {
  if (!loginFormRef.value || loading.value) return
  const valid = await loginFormRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const response: any = await userApi.login(loginForm.username, loginForm.password)
    await applyLoginResult(
      response?.data ?? response,
      loginForm.remember ? loginForm.username : undefined,
    )
  } catch (error) {
    console.error('登录失败:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  --ink: var(--cw-text-1);
  --muted: #68707b;
  --accent: var(--cw-brand);
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
  overflow: hidden;
  color: var(--ink);
  background-color: var(--cw-bg-subtle);
  background-image: linear-gradient(rgba(32,33,36,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(32,33,36,.045) 1px, transparent 1px);
  background-size: 28px 28px;
  font-family: var(--cw-font-sans);
}

.brand-bar {
  position: absolute;
  z-index: 5;
  top: 58px;
  left: calc((100% - min(1180px, calc(100% - 48px))) / 2 + 64px);
  display: flex;
  align-items: center;
  gap: 10px;
}

.auth-shell {
  width: min(1180px, calc(100% - 48px));
  min-height: min(720px, calc(100dvh - 64px));
  margin: 32px auto;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(380px, .82fr);
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.72);
  border-radius: 8px;
  box-shadow: 0 24px 70px rgba(37,43,51,.14);
}

.workspace-showcase {
  position: relative;
  min-width: 0;
  padding: 112px 64px 46px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  color: #fff;
  background: #222529;
}
.workspace-showcase::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .12;
  background-image: radial-gradient(#fff .7px, transparent .7px);
  background-size: 18px 18px;
}
.showcase-copy, .editor-window, .feature-strip { position: relative; z-index: 1; }
.eyebrow { display: block; margin-bottom: 14px; color: var(--cw-brand-dark); font-size: 11px; font-weight: 750; }
.showcase-copy h1 { max-width: 560px; margin: 0; font-size: 34px; line-height: 1.3; font-weight: 720; }
.showcase-copy p { margin: 16px 0 0; color: #aeb4bd; font-size: 15px; line-height: 1.8; }

.editor-window {
  width: min(100%, 610px);
  margin: 36px auto 28px;
  overflow: hidden;
  border: 1px solid #454a50;
  border-radius: 6px;
  background: #181a1d;
  box-shadow: 0 22px 50px rgba(0,0,0,.3);
}
.editor-topbar, .editor-status {
  height: 38px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  color: #c8cdd4;
  border-bottom: 1px solid #31353a;
  font-size: 11px;
}
.window-controls { margin-right: 18px; display: flex; gap: 6px; }
.window-controls i { width: 8px; height: 8px; border-radius: 50%; background: #61ae72; }
.window-controls i:first-child { background: #e46d5f; }
.window-controls i:nth-child(2) { background: #dda644; }
.language { margin-left: auto; color: #8d949d; }
.editor-body { min-height: 270px; padding: 18px 0; display: flex; overflow: hidden; }
.line-numbers { flex: 0 0 42px; padding-right: 12px; color: #5f6670; border-right: 1px solid #2b2e33; font: 12px/1.75 Consolas, monospace; text-align: right; }
.editor-body pre { margin: 0; padding: 0 20px; overflow: hidden; color: #d4d8de; font: 12px/1.75 Consolas, monospace; white-space: pre; }
.editor-body b { color: #c79bf0; font-weight: 400; }
.editor-body em { color: #e6c27a; font-style: normal; }
.editor-status { height: 30px; justify-content: space-between; border-top: 1px solid #31353a; border-bottom: 0; color: #818892; }
.editor-status i { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: #62ad72; }
.feature-strip { display: flex; gap: 28px; color: #aeb4bd; font-size: 12px; }
.feature-strip span { display: inline-flex; align-items: center; gap: 6px; }
.feature-strip .el-icon { color: var(--accent); }

.login-column {
  padding: 48px;
  display: flex;
  align-items: center;
  background: rgba(255,255,255,.58);
  backdrop-filter: blur(18px) saturate(120%);
  -webkit-backdrop-filter: blur(18px) saturate(120%);
}
.login-panel { width: 100%; max-width: 390px; margin: auto; }
.mobile-brand { display: none; }
.login-heading h2 { margin: 0; font-size: 28px; line-height: 1.25; font-weight: 740; }
.login-heading p { margin: 10px 0 34px; color: var(--muted); font-size: 14px; }
.login-form :deep(.el-form-item) { margin-bottom: 22px; }
.login-form :deep(.el-form-item__label) { padding-bottom: 7px; color: var(--cw-text-2); font-size: 13px; font-weight: 650; }
.login-form :deep(.el-input__wrapper) { min-height: 46px; border-radius: 6px; background: rgba(255,255,255,.72); box-shadow: 0 0 0 1px rgba(32,33,36,.16) inset; transition: box-shadow .18s ease, background-color .18s ease; }
.login-form :deep(.el-input__wrapper:hover) { box-shadow: 0 0 0 1px rgba(32,33,36,.3) inset; }
.login-form :deep(.el-input__wrapper.is-focus) { background: #fff; box-shadow: 0 0 0 1px var(--accent) inset, 0 0 0 3px rgba(245,166,35,.13); }
.mode-switch { margin-bottom: 20px; }
.code-row { display: flex; gap: 10px; width: 100%; }
.code-row .el-input { flex: 1; min-width: 0; }
.code-button { min-width: 108px; height: 46px; border-radius: 6px; }
.form-options { margin: -2px 0 24px; display: flex; align-items: center; justify-content: space-between; }
.text-action { padding: 0; border: 0; background: transparent; color: var(--cw-brand-deep); font: inherit; font-size: 13px; cursor: pointer; }
.text-action:hover { color: var(--cw-brand-deep); text-decoration: underline; }
.text-action.strong { font-weight: 700; }
.login-button { width: 100%; height: 46px; border-radius: 6px; border-color: var(--ink); background: var(--ink); color: #fff; font-size: 14px; font-weight: 700; }
.login-button:hover, .login-button:focus { border-color: #34363a; background: #34363a; }
.register-row { margin: 22px 0 0; color: var(--muted); font-size: 13px; text-align: center; }
.privacy-note { margin: 46px 0 0; color: var(--cw-text-3); font-size: 11px; line-height: 1.6; text-align: center; }

@media (max-width: 900px) {
  .brand-bar { display: none; }
  .auth-shell { width: 100%; min-height: 100dvh; margin: 0; grid-template-columns: minmax(0,1fr) minmax(350px,.9fr); border: 0; border-radius: 0; }
  .workspace-showcase { padding: 70px 34px 34px; }
  .showcase-copy h1 { font-size: 28px; }
  .editor-body pre { font-size: 11px; }
  .login-column { padding: 36px; }
}
@media (max-width: 680px) {
  .auth-page { overflow-y: auto; }
  .auth-shell { display: block; }
  .workspace-showcase { display: none; }
  .login-column { width: 100%; min-width: 0; min-height: 100dvh; padding: 32px 24px; box-sizing: border-box; background: rgba(255,255,255,.64); }
  .login-panel, .login-form, .login-form :deep(.el-form-item), .login-form :deep(.el-input) { width: 100%; min-width: 0; box-sizing: border-box; }
  .mobile-brand { margin-bottom: 56px; display: flex; align-items: center; gap: 10px; }
  .login-heading h2 { font-size: 26px; }
  .privacy-note { margin-top: 40px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: .01ms !important; }
}
</style>
