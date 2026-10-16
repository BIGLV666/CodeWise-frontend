import { computed } from 'vue'
import { useMediaQuery } from './useMediaQuery'

/**
 * 全站断点，与 styles/tokens.css 里的文档保持一致。
 * 媒体查询里不能用 CSS 变量，所以这是 JS 侧的唯一来源；
 * 新增媒体查询只允许用这四个值（由 tests/responsive-contract.test.mjs 锁死）。
 */
export const BREAKPOINTS = {
  /** 窄手机 */
  narrowPhone: 560,
  /** 手机：顶部导航收起、页面级侧栏转抽屉、弹窗自适应 */
  phone: 768,
  /** 平板：多栏退单栏、侧栏收窄成图标轨 */
  tablet: 1024,
  /** 宽屏收窄：大桌面三栏退两栏，不属于移动档 */
  wide: 1280,
} as const

export type BreakpointName = keyof typeof BREAKPOINTS

/** 断点名 → media query 字符串。纯函数，便于单测。 */
export function breakpointQuery(name: BreakpointName): string {
  return `(max-width: ${BREAKPOINTS[name]}px)`
}

/**
 * 语义断点状态。
 *
 * - `isNarrowPhone`：≤560
 * - `isPhone`：≤768（含窄手机）
 * - `isTablet`：769–1024
 * - `isDesktop`：>1024
 *
 * 只在 CSS 表达不了的地方使用（例如做题页要在「双栏 / 单栏切换」之间换 DOM 结构、
 * 表格要在窄屏换成卡片列表）。纯样式差异一律写媒体查询，不要用这个。
 */
export function useBreakpoint() {
  const isNarrowPhone = useMediaQuery(breakpointQuery('narrowPhone'))
  const isPhone = useMediaQuery(breakpointQuery('phone'))
  const isAtMostTablet = useMediaQuery(breakpointQuery('tablet'))

  const isTablet = computed(() => isAtMostTablet.value && !isPhone.value)
  const isDesktop = computed(() => !isAtMostTablet.value)

  return {
    isNarrowPhone,
    isPhone,
    isTablet,
    isDesktop,
    /** 手机或平板（≤1024），即「非桌面」 */
    isCompact: isAtMostTablet,
  }
}
