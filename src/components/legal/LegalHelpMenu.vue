<template>
  <!--
    全站常驻的「帮助」入口。

    为什么是导航栏菜单而不是页脚：题库/收藏/计划/笔记/Agent/题目详情都是「整页高度 + overflow:hidden」
    的应用壳（内部各面板自己滚），页脚会被直接裁掉；
    要放真页脚得重构 5 个布局，代价远大于收益。导航栏是这些页面唯一「永远可见」的位置。

    弹窗自己带，调用方只写一行 <LegalHelpMenu />，不需要各自维护 open/close 状态。
  -->
  <el-dropdown
    trigger="click"
    placement="bottom-end"
    popper-class="legal-help-popper"
    class="legal-help-menu"
    v-bind="attrs"
    @command="handleCommand"
  >
    <button class="legal-help-button cw-tap" type="button" aria-label="帮助与平台声明" title="帮助">
      <el-icon><QuestionFilled /></el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-for="doc in LEGAL_DOC_LIST" :key="doc.key" :command="doc.key">
          《{{ doc.title }}》
        </el-dropdown-item>
        <el-dropdown-item divided disabled>联系邮箱：{{ LEGAL_CONTACT_EMAIL }}</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <LegalDocDialog v-model="visible" :doc="activeDoc" />
</template>

<script setup lang="ts">
import { ref, useAttrs } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOC_LIST,
  resolveLegalDocKey,
  type LegalDocKey,
} from '@/utils/legalDocs'
import LegalDocDialog from './LegalDocDialog.vue'

/** 多根组件不会自动继承 class/attrs，手动落到按钮所在的根节点上（同 LegalNotice）。 */
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const visible = ref(false)
const activeDoc = ref<LegalDocKey>('usage')

function handleCommand(command: string | number | object) {
  activeDoc.value = resolveLegalDocKey(command)
  visible.value = true
}
</script>

<style scoped>
.legal-help-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--cw-text-3);
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s;
}

.legal-help-button:hover,
.legal-help-button:focus-visible {
  background: var(--cw-bg-subtle);
  color: var(--cw-text-1);
}

/*
 * 手机档由调用方用 .cw-hide-phone（responsive.css，≤768px）收起，桌面档显示。
 *
 * 收起的原因：顶部右侧簇在 375px 已经很挤（搜索框 + 收件箱 + 管理员 + 头像），
 * 再塞一个 40px 触屏目标会把搜索框从 ~80px 压到 ~43px。手机端的入口改为：
 *  - 有导航抽屉的页面 → 抽屉里的 LegalDrawerLinks；
 *  - 做题页顶栏 → 自己的「更多」下拉。
 * 隐藏与显示两侧必须同一断点（768px），否则中间会出现"两边都没有入口"的空窗。
 */
</style>
