/**
 * 把模型选择器上的选择翻译成 `/api/ai/advice/ask` 的模型参数。
 *
 * 线上契约是三选一，后端据此分派（见 service-ai 的 `AdviceConversationService`）：
 *
 * - 两个都不传 → AUTO：平台按服务商轮转，模型用被借到端点的默认模型
 * - 只传 `modelName` → 平台指定模型：按「模型 → 端点」路由，不轮转、不兜底
 * - 两个都传 → 用户自带配置 + 该分组内的模型
 *
 * **最容易错的一条：选了 AUTO 时绝不能带上 `userAiConfigId`。** 后端无法区分
 * "AUTO 误带了 configId" 与 "用户真的选了某个分组"——两者传参形状完全相同——
 * 于是会静默走用户自带配置，表现得像是 AUTO 失效。
 */

export interface AiModelSelection {
  /** 用户自带配置的 id；选了平台模型或 AUTO 时为 undefined */
  userConfigId?: number
  /** 具体模型名；AUTO 时为空 */
  modelName?: string
}

export interface AiModelParams {
  userAiConfigId?: number
  modelName?: string
}

export function buildAiModelParams(selection: AiModelSelection): AiModelParams {
  const params: AiModelParams = {}

  const modelName = (selection.modelName || '').trim()
  if (modelName) {
    params.modelName = modelName
  }
  // 用 != null 而不是真值判断：配置 id 为 0 时不该被丢掉（当前是自增主键，取不到 0，
  // 但真值判断是这类"偶尔静默丢参"的常见来源）
  if (selection.userConfigId != null) {
    params.userAiConfigId = selection.userConfigId
  }

  return params
}
