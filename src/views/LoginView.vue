<template>
  <div class="login-container">
    <!-- 左侧装饰区域 -->
    <div class="left-panel">
      <div class="brand-area">
        <h1 class="brand-title">CodeWise</h1>
        <p class="brand-slogan">Code with Wisdom, Shape the Future.</p>
      </div>
      
      <!-- 装饰性算法树结构 -->
      <div class="tree-decoration">
        <div class="node node-root"></div>
        <div class="line line-left"></div>
        <div class="line line-right"></div>
        <div class="node node-left"></div>
        <div class="node node-right"></div>
        
        <div class="line line-left-left"></div>
        <div class="line line-left-right"></div>
        <div class="node node-left-left"></div>
        <div class="node node-left-right"></div>
      </div>

      <div class="code-bg">
        <pre>
<span class="code-keyword">func</span> twoSum(nums []<span class="code-type">int</span>, target <span class="code-type">int</span>) []<span class="code-type">int</span> {
    m := make(<span class="code-type">map</span>[int]int)
    <span class="code-keyword">for</span> i, num := <span class="code-keyword">range</span> nums {
        <span class="code-keyword">if</span> j, ok := m[target-num]; ok {
            <span class="code-keyword">return</span> []int{j, i}
        }
        m[num] = i
    }
    <span class="code-keyword">return</span> nil
}
        </pre>
      </div>
    </div>

    <!-- 右侧登录表单区域 -->
    <div class="right-panel">
      <div class="login-box">
        <h2 class="welcome-title">Welcome Back</h2>
        <p class="welcome-subtitle">登录到 CodeWise 开始你的刷题之旅</p>

        <el-form
          ref="loginFormRef"
          :model="loginForm"
          :rules="rules"
          label-position="top"
          size="large"
        >
          <el-form-item label="邮箱 / 用户名" prop="username">
            <el-input 
              v-model="loginForm.username" 
              placeholder="请输入您的邮箱或用户名" 
              :prefix-icon="User"
              clearable 
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入您的密码"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <div class="form-options">
            <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
            <el-link type="primary" :underline="false" @click="() => $router.push('/register')">忘记密码？</el-link>
          </div>

          <el-button 
            type="primary" 
            class="login-btn" 
            :loading="loading"
            @click="handleLogin"
          >
            登 录
          </el-button >

          <div class="register-link">
            还没有账号？<el-link type="primary" :underline="false" @click="() => $router.push('/register')">立即注册</el-link>
          </div>

          <el-divider>其他登录方式</el-divider>

          <div class="social-login">
            <el-button circle :icon="() => 'Github'" class="social-btn github-btn"></el-button>
            <el-button circle :icon="() => 'Google'" class="social-btn google-btn"></el-button>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import userApi from '@/api/userApi'
import type userDto  from '@/types/UserDto'
import { useUserStore } from '@/stores/User'


// 表单引用
const loginFormRef = ref<FormInstance>()
const loading = ref(false)
const router = useRouter()

// 表单数据
const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

// 表单校验规则
const rules = reactive<FormRules>({
  username: [
    { required: true, message: '请输入用户名或邮箱', trigger: 'blur' },
    { min: 3, message: '长度至少为 3 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少为 6 个字符', trigger: 'blur' }
  ]
})

// 登录处理函数
// 登录处理函数
const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    await loginFormRef.value.validate()
    loading.value = true

    const res: any = await userApi.login(loginForm.username, loginForm.password)
    const token: string = res.data.token
    const userDto: userDto = {
      ...res.data.user,
      userId: String(res.data.user.userId),
    }

    const userStore = useUserStore()
    userStore.setLoginData({ token, userDto })
    ElMessage.success('登录成功')
    router.push('/home')
  } catch (error) {
    console.error('登录失败:', error)
    ElMessage.error('登录失败，请检查账号密码或网络')
  } finally {
    loading.value = false
  }
}


  

</script>

<style scoped>
/* 整体布局 */
.login-container {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

/* === 左侧装饰面板 === */
.left-panel {
  flex: 1;
  position: relative;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60px;
  overflow: hidden;
}

.brand-area {
  position: relative;
  z-index: 10;
}

.brand-title {
  font-size: 48px;
  color: #FFA116; /* 力扣标志黄 */
  margin-bottom: 16px;
  font-weight: 700;
  letter-spacing: 2px;
}

.brand-slogan {
  color: #a0a0a0;
  font-size: 18px;
  letter-spacing: 1px;
}

/* 算法树装饰 (纯CSS绘制) */
.tree-decoration {
  position: absolute;
  top: 15%;
  right: 10%;
  width: 300px;
  height: 300px;
  z-index: 1;
}

.node {
  position: absolute;
  width: 16px;
  height: 16px;
  background: #FFA116;
  border-radius: 50%;
  box-shadow: 0 0 15px #FFA116;
}
.node-root { top: 0; left: 50%; transform: translateX(-50%); }
.node-left { top: 35%; left: 20%; }
.node-right { top: 35%; right: 20%; }
.node-left-left { top: 70%; left: 0%; }
.node-left-right { top: 70%; left: 40%; }

.line {
  position: absolute;
  background: rgba(255, 161, 22, 0.4);
  height: 2px;
  transform-origin: 0 0;
}
.line-left { top: 10px; left: 50%; width: 120px; transform: rotate(150deg); }
.line-right { top: 10px; left: 50%; width: 120px; transform: rotate(30deg); }
.line-left-left { top: 115px; left: 60px; width: 100px; transform: rotate(150deg); }
.line-left-right { top: 115px; left: 60px; width: 100px; transform: rotate(30deg); }

/* 背景代码装饰 */
.code-bg {
  position: absolute;
  bottom: 40px;
  left: 40px;
  opacity: 0.15;
  font-family: 'Fira Code', monospace;
  font-size: 14px;
  line-height: 1.5;
  z-index: 0;
}
.code-keyword { color: #c678dd; }
.code-type { color: #e5c07b; }

/* === 右侧表单面板 === */
.right-panel {
  width: 520px;
  background: #1f1f1f; /* 深色背景 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-box {
  width: 400px;
  padding: 40px;
}

.welcome-title {
  color: #ffffff;
  font-size: 32px;
  margin-bottom: 12px;
  font-weight: 600;
}

.welcome-subtitle {
  color: #909399;
  font-size: 14px;
  margin-bottom: 40px;
}

/* Element Plus 深色表单样式覆盖 */
:deep(.el-form-item__label) {
  color: #c0c4cc !important;
  font-weight: 500;
}

:deep(.el-input__wrapper) {
  background-color: #2a2a2a;
  box-shadow: 0 0 0 1px #3a3a3a inset !important;
  border-radius: 8px;
  height: 48px;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #FFA116 inset !important;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #FFA116 inset !important;
}

:deep(.el-input__inner) {
  color: #ffffff;
}

:deep(.el-input__inner::placeholder) {
  color: #606266;
}

/* 选项区 */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  color: #909399;
}

:deep(.el-checkbox__label) {
  color: #909399;
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  background-color: #FFA116;
  border-color: #FFA116;
  border-radius: 8px;
  color: #1a1a2e;
}

.login-btn:hover,
.login-btn:focus {
  background-color: #FFB13D;
  border-color: #FFB13D;
  color: #1a1a2e;
}

/* 注册链接 */
.register-link {
  text-align: center;
  margin-top: 24px;
  color: #909399;
  font-size: 14px;
}

/* 分割线 */
:deep(.el-divider__text) {
  background-color: #1f1f1f;
  color: #606266;
  font-size: 12px;
}

:deep(.el-divider) {
  border-color: #3a3a3a;
  margin: 32px 0;
}

/* 社交登录按钮 */
.social-login {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.social-btn {
  width: 44px !important;
  height: 44px !important;
  background-color: #2a2a2a !important;
  border-color: #3a3a3a !important;
  color: #ffffff !important;
  font-weight: bold;
}

.social-btn:hover {
  border-color: #FFA116 !important;
  color: #FFA116 !important;
}
</style>
