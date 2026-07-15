<template>
	<div class="register-container">
		<!-- 背景装饰 -->
		<div class="bg-decoration">
			<div class="circle circle-1"></div>
			<div class="circle circle-2"></div>
			<div class="circle circle-3"></div>
		</div>

		<!-- 注册卡片 -->
		<el-card class="register-card" shadow="hover">
			<!-- Logo 和标题 -->
			<div class="register-header">
				<div class="logo">
					<el-icon :size="40" color="#409eff">
						<Edit />
					</el-icon>
					<span class="logo-text">CodeWise</span>
				</div>
				<h2>创建账号</h2>
				<p class="subtitle">开始你的编程之旅</p>
			</div>

			<!-- 注册表单 -->
			<el-form ref="registerFormRef" :model="registerForm" :rules="registerRules" label-width="80px" size="large"
				class="register-form">
				<!-- 用户名 -->
				<el-form-item label="用户名" prop="username">
					<el-input v-model="registerForm.username" placeholder="请设置用户名（4-16位字母或数字）" prefix-icon="User"
						clearable />
				</el-form-item>

				<!-- 邮箱 -->
				<el-form-item label="邮箱" prop="email">
					<el-input v-model="registerForm.email" placeholder="请输入邮箱地址" prefix-icon="Message" clearable />
				</el-form-item>

				<!-- 密码 -->
				<el-form-item label="密码" prop="password">
					<el-input v-model="registerForm.password" type="password" placeholder="请设置密码（6-20位）"
						prefix-icon="Lock" show-password clearable />
					<!-- 密码强度指示器 -->
					<div class="password-strength" v-if="registerForm.password">
						<el-progress :percentage="passwordStrength.score" :color="passwordStrength.color"
							:stroke-width="6" :show-text="false" />
						<span class="strength-text" :style="{ color: passwordStrength.color }">
							{{ passwordStrength.text }}
						</span>
					</div>
				</el-form-item>

				<!-- 确认密码 -->
				<el-form-item label="确认密码" prop="confirmPassword">
					<el-input v-model="registerForm.confirmPassword" type="password" placeholder="请再次输入密码"
						prefix-icon="Lock" show-password clearable />
				</el-form-item>

				<!-- 验证码 -->
				<el-form-item label="验证码" prop="captcha">
					<div class="captcha-wrapper">
						<el-input v-model="registerForm.captcha" placeholder="请输入验证码" prefix-icon="Key" clearable
							style="flex: 1;" />
						<el-button type="primary" :disabled="isCaptchaDisabled" @click="sendCaptcha"
							class="captcha-btn">
							{{ captchaButtonText }}
						</el-button>
					</div>
				</el-form-item>

				<!-- 用户协议 -->
				<el-form-item>
					<el-checkbox v-model="registerForm.agree">
						我已阅读并同意
						<el-link type="primary" :underline="'hover'">《用户协议》</el-link>
						<el-link type="primary" :underline="'hover'">《隐私政策》</el-link>
					</el-checkbox>
				</el-form-item>

				<!-- 注册按钮 -->
				<el-form-item>
					<el-button type="primary" size="large" :loading="loading" @click="handleRegister"
						class="register-btn">
						注册
					</el-button>
				</el-form-item>

				<!-- 跳转登录 -->

				<div class="register-footer" style="display: flex; justify-content: space-between; width: 100%;">
					<span>已有账号？<el-link type="primary" @click="goToLogin">立即登录</el-link></span>
					<el-link type="primary" @click="showResetDialog">忘记密码</el-link>
				</div>

			</el-form>
		</el-card>
			

		<!-- 忘记密码对话框 -->
		<el-dialog v-model="resetDialogVisible" title="找回密码" width="460px" :before-close="handleResetDialogClose">
			<el-form ref="resetFormRef" :model="resetForm" :rules="resetRules" label-width="80px" size="large">
				<el-form-item label="邮箱" prop="email">
					<el-input v-model="resetForm.email" placeholder="请输入注册时使用的邮箱" prefix-icon="Message" clearable />
				</el-form-item>
				<el-form-item label="验证码" prop="captcha">
					<div class="captcha-wrapper">
						<el-input v-model="resetForm.captcha" placeholder="请输入验证码" prefix-icon="Key" clearable style="flex: 1;" />
						<el-button type="primary" :disabled="isResetCaptchaDisabled" @click="sendResetCaptcha" class="captcha-btn">
							{{ resetCaptchaButtonText }}
						</el-button>
					</div>
				</el-form-item>
				<el-form-item label="新密码" prop="password">
					<el-input v-model="resetForm.password" type="password" placeholder="请设置新密码（6-20位）" prefix-icon="Lock" show-password clearable />
				</el-form-item>
				<el-form-item label="确认密码" prop="confirmPassword">
					<el-input v-model="resetForm.confirmPassword" type="password" placeholder="请再次输入新密码" prefix-icon="Lock" show-password clearable />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="handleResetDialogClose">取消</el-button>
				<el-button type="primary" :loading="resetLoading" @click="handleResetPassword">确认修改</el-button>
			</template>
		</el-dialog>
	</div>

</template>

<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, User, Message, Phone, Lock, Key } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import userApi from '@/api/userApi'
// ====== 路由 ======
const router = useRouter()

// ====== 表单引用 ======
const registerFormRef = ref<FormInstance>()

// ====== 表单数据 ======
const registerForm = reactive({
	username: '',
	email: '',
	phone: '',
	password: '',
	confirmPassword: '',
	captcha: '',
	agree: false
})

// ====== 加载状态 ======
const loading = ref(false)


// ====== 密码强度计算 ======
const passwordStrength = computed(() => {
	const pwd = registerForm.password
	let score = 0
	let text = '弱'
	let color = '#f56c6c'

	if (pwd.length >= 6) {
		score += 20
		if (pwd.length >= 10) score += 20
	}
	if (/[a-z]/.test(pwd)) score += 20
	if (/[A-Z]/.test(pwd)) score += 20
	if (/[0-9]/.test(pwd)) score += 20
	if (/[^a-zA-Z0-9]/.test(pwd)) score += 20

	if (score >= 80) { text = '强'; color = '#67c23a' }
	else if (score >= 50) { text = '中'; color = '#e6a23c' }
	else if (score > 0) { text = '弱'; color = '#f56c6c' }

	return { score, text, color }
})

// ====== 表单验证规则 ======
const validateConfirmPassword = (rule: any, value: string, callback: any) => {
	if (value !== registerForm.password) {
		callback(new Error('两次输入的密码不一致'))
	} else {
		callback()
	}
}

const validateAgree = (rule: any, value: any, callback: any) => {
	if (!registerForm.agree) {
		callback(new Error('请先阅读并同意用户协议'))
	} else {
		callback()
	}
}

const registerRules: FormRules = {
	username: [
		{ required: true, message: '请输入用户名', trigger: 'blur' },
		{ min: 4, max: 16, message: '用户名长度为 4-16 位', trigger: 'blur' },
		{ pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' }
	],
	email: [
		{ required: true, message: '请输入邮箱地址', trigger: 'blur' },
		{ type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
	],
	phone: [
		{ required: true, message: '请输入手机号', trigger: 'blur' },
		{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
	],
	password: [
		{ required: true, message: '请输入密码', trigger: 'blur' },
		{ min: 6, max: 20, message: '密码长度为 6-20 位', trigger: 'blur' }
	],
	confirmPassword: [
		{ required: true, message: '请再次输入密码', trigger: 'blur' },
		{ validator: validateConfirmPassword, trigger: 'blur' }
	],
	captcha: [
		{ required: true, message: '请输入验证码', trigger: 'blur' },
	],
	agree: [
		{ validator: validateAgree, trigger: 'change' }
	]
}
// ====== 验证码 ======
const isCaptchaDisabled = ref(false)
const captchaButtonText = ref('获取验证码')
const countdownSeconds = ref(60)
let countdownTimer: ReturnType<typeof setInterval> | null = null
/// ====== 发送验证码 ======
const sendCaptcha = async () => {
	if (!registerForm.email) {
		ElMessage.warning('请先输入邮箱地址')
		return
	}
	if (!/^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(registerForm.email)) {
		ElMessage.warning('请输入正确的邮箱地址')
		return
	}



	try {
		// ✅ 发送验证码请求
		const response: any = await userApi.emailRegister(registerForm.email, registerForm.password, registerForm.username)


		if (response.code === 200) {
			// 成功：开始倒计时
			// ✅ 禁用按钮，开始倒计时
			isCaptchaDisabled.value = true
			countdownSeconds.value = 60
			captchaButtonText.value = `${countdownSeconds.value}s`

			ElMessage.success('验证码已发送到您的手机')

			countdownTimer = setInterval(() => {
				// ✅ 每秒减 1
				countdownSeconds.value--

				if (countdownSeconds.value <= 0) {
					// ✅ 倒计时结束
					if (countdownTimer) {
						clearInterval(countdownTimer)
						countdownTimer = null
					}
					isCaptchaDisabled.value = false
					captchaButtonText.value = '获取验证码'
				} else {
					// ✅ 更新按钮文字
					captchaButtonText.value = `${countdownSeconds.value}s`
				}

			}, 1000)

		} else {
			// ❌ 后端返回错误（如：邮箱已注册）
			ElMessage.error(response.message || '发送验证码失败')
			// 不启动倒计时，按钮保持可用状态
		}
	} catch (error) {

		// 不启动倒计时
	}
}


// ====== 忘记密码相关 ======
const resetDialogVisible = ref(false)
const resetFormRef = ref<FormInstance>()
const resetLoading = ref(false)

const resetForm = reactive({
	email: '',
	captcha: '',
	password: '',
	confirmPassword: ''
})

const validateResetConfirmPassword = (rule: any, value: string, callback: any) => {
	if (value !== resetForm.password) {
		callback(new Error('两次输入的密码不一致'))
	} else {
		callback()
	}
}

const resetRules: FormRules = {
	email: [
		{ required: true, message: '请输入邮箱地址', trigger: 'blur' },
		{ type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
	],
	captcha: [
		{ required: true, message: '请输入验证码', trigger: 'blur' },
	],
	password: [
		{ required: true, message: '请输入新密码', trigger: 'blur' },
		{ min: 6, max: 20, message: '密码长度为 6-20 位', trigger: 'blur' }
	],
	confirmPassword: [
		{ required: true, message: '请再次输入新密码', trigger: 'blur' },
		{ validator: validateResetConfirmPassword, trigger: 'blur' }
	]
}


onBeforeUnmount(() => {
	if (countdownTimer) {
		clearInterval(countdownTimer)
		countdownTimer = null
		console.log('🧹 定时器已清除')
	}
	if (resetCountdownTimer) {
		clearInterval(resetCountdownTimer)
		resetCountdownTimer = null
		console.log('🧹 重置密码定时器已清除')
	}
})





const isResetCaptchaDisabled = ref(false)
const resetCaptchaButtonText = ref('获取验证码')
const resetCountdownSeconds = ref(60)
let resetCountdownTimer: ReturnType<typeof setInterval> | null = null

const showResetDialog = () => {
	resetDialogVisible.value = true
}

const handleResetDialogClose = () => {
	resetFormRef.value?.resetFields()
	resetDialogVisible.value = false
}



onBeforeUnmount(() => {
	if (countdownTimer) {
		clearInterval(countdownTimer)
		countdownTimer = null
		console.log('🧹 定时器已清除')
	}
	if (resetCountdownTimer) {
		clearInterval(resetCountdownTimer)
		resetCountdownTimer = null
		console.log('🧹 重置密码定时器已清除')
	}
})

// ====== 注册提交 ======
const handleRegister = async () => {
	if (!registerFormRef.value) return

	await registerFormRef.value.validate(async (valid) => {
		if (!valid) return

		loading.value = true
		try {
			const res: any = await userApi.register(registerForm.email, registerForm.captcha)
			if (res.code === 200) {
				ElMessage.success('注册成功，请登录')

			}

		} catch (error) {
			ElMessage.error('注册失败，请稍后重试')
		} finally {
			loading.value = false
		}
	})
}

onBeforeUnmount(() => {
	if (countdownTimer) {
		clearInterval(countdownTimer)
		countdownTimer = null
		console.log('🧹 定时器已清除')
	}
	if (resetCountdownTimer) {
		clearInterval(resetCountdownTimer)
		resetCountdownTimer = null
		console.log('🧹 重置密码定时器已清除')
	}
})


// ====== 忘记密码相关 ======



const sendResetCaptcha = async () => {
	if (!resetForm.email) {
		ElMessage.warning('请先输入邮箱地址')
		return
	}
	if (!/^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(resetForm.email)) {
		ElMessage.warning('请输入正确的邮箱地址')
		return
	}

	try {
		// 调用发送重置密码验证码的API，请根据实际后端接口调整
		const response: any = await userApi.updataPasswordForEmail(resetForm.email,resetForm.password)
		if (response.code === 200) {
			isResetCaptchaDisabled.value = true
			resetCountdownSeconds.value = 60
			resetCaptchaButtonText.value = `${resetCountdownSeconds.value}s`
			ElMessage.success('验证码已发送到您的邮箱')

			resetCountdownTimer = setInterval(() => {
				resetCountdownSeconds.value--
				if (resetCountdownSeconds.value <= 0) {
					if (resetCountdownTimer) {
						clearInterval(resetCountdownTimer)
						resetCountdownTimer = null
					}
					isResetCaptchaDisabled.value = false
					resetCaptchaButtonText.value = '获取验证码'
				} else {
					resetCaptchaButtonText.value = `${resetCountdownSeconds.value}s`
				}	
			}, 1000)
		} else {
			ElMessage.error(response.message || '发送验证码失败')
		}
	} catch (error) {
		ElMessage.error('发送验证码失败，请稍后重试')
	}
}

const handleResetPassword = async () => {
	if (!resetFormRef.value) return
	await resetFormRef.value.validate(async (valid) => {
		if (!valid) return
		
		resetLoading.value = true
		try {
			// 调用重置密码的API，请根据实际后端接口调整
			const res: any = await userApi.updatefromcode(resetForm.email, resetForm.captcha)
			if (res.code === 200) {
				ElMessage.success('密码修改成功，请登录')
				handleResetDialogClose()
				router.replace('/login')
			} else {
				ElMessage.error(res.message || '密码修改失败')
			}
		} catch (error) {
			ElMessage.error('密码修改失败，请稍后重试')
		} finally {
			resetLoading.value = false
		}
	})
}

// ====== 跳转登录 ======
const goToLogin = () => {
	router.replace('/login')
}
</script>

<style scoped>
/* ====== 容器 ====== */
.register-container {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #e8f0fe 0%, #d4e4f7 100%);
	padding: 20px;
	position: relative;
	overflow: hidden;
}

/* ====== 背景装饰 ====== */
.bg-decoration {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	overflow: hidden;
}

.circle {
	position: absolute;
	border-radius: 50%;
	background: rgba(64, 158, 255, 0.08);
}

.circle-1 {
	width: 400px;
	height: 400px;
	top: -100px;
	right: -100px;
}

.circle-2 {
	width: 300px;
	height: 300px;
	bottom: -50px;
	left: -50px;
}

.circle-3 {
	width: 200px;
	height: 200px;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

/* ====== 注册卡片 ====== */
.register-card {
	width: 480px;
	max-width: 100%;
	border-radius: 16px;
	position: relative;
	z-index: 1;
}

.register-card :deep(.el-card__body) {
	padding: 40px 36px 32px;
}

/* ====== 头部 ====== */
.register-header {
	text-align: center;
	margin-bottom: 32px;
}

.logo {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12px;
	margin-bottom: 16px;
}

.logo-text {
	font-size: 28px;
	font-weight: 700;
	background: linear-gradient(135deg, #409eff, #36d399);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
}

.register-header h2 {
	font-size: 24px;
	font-weight: 600;
	color: #303133;
	margin: 0 0 4px 0;
}

.register-header .subtitle {
	font-size: 14px;
	color: #909399;
	margin: 0;
}

/* ====== 表单 ====== */
.register-form {
	margin-top: 8px;
}

.register-form :deep(.el-form-item) {
	margin-bottom: 22px;
}

.register-form :deep(.el-input__wrapper) {
	border-radius: 8px;
	transition: all 0.3s;
}

.register-form :deep(.el-input__wrapper:hover) {
	box-shadow: 0 0 0 1px #409eff;
}

.register-form :deep(.el-input__wrapper.is-focus) {
	box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.25);
}

/* ====== 密码强度 ====== */
.password-strength {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-top: 6px;
}

.password-strength .el-progress {
	flex: 1;
}

.password-strength .strength-text {
	font-size: 13px;
	font-weight: 500;
	min-width: 20px;
}

/* ====== 验证码 ====== */
.captcha-wrapper {
	display: flex;
	gap: 12px;
	width: 100%;
}

.captcha-btn {
	flex-shrink: 0;
	border-radius: 8px;
	font-size: 14px;
}

/* ====== 注册按钮 ====== */
.register-btn {
	width: 100%;
	border-radius: 8px;
	height: 48px;
	font-size: 16px;
	font-weight: 500;
}

/* ====== 底部 ====== */
.register-footer {
	text-align: center;
	font-size: 14px;
	color: #909399;
	margin-top: 8px;
}

.register-footer .el-link {
	font-weight: 500;
}

/* ====== 响应式 ====== */
@media (max-width: 576px) {
	.register-card {
		padding: 0;
		box-shadow: none !important;
	}

	.register-card :deep(.el-card__body) {
		padding: 24px 20px;
	}

	.captcha-wrapper {
		flex-direction: column;
	}

	.captcha-btn {
		width: 100%;
	}

	.logo-text {
		font-size: 22px;
	}

	.register-header h2 {
		font-size: 20px;
	}
}
</style>
