# CodeWise 前端

CodeWise 是一个面向算法学习、刷题、复习和技术交流的在线编程平台。本仓库为 Vue 3 前端项目，整体采用类似 LeetCode 的浅色工作台风格，重点关注题目浏览、在线编码、收藏复习和社区内容阅读效率。

## 技术栈

- Vue 3 + TypeScript
- Vite
- Vue Router
- Pinia
- Element Plus
- Monaco Editor
- Axios
- STOMP WebSocket
- Marked + KaTeX + Highlight.js
- DOMPurify

## 主要功能

### 题库与在线做题

- 题目游标分页、难度筛选和状态展示。
- Monaco 在线编辑器，支持多种编程语言。
- 自定义测试用例、代码调试和提交判题。
- WebSocket 接收判题结果。
- 按用户、题目和语言保存本地代码草稿。

### 题解

- 题解与社区讨论帖使用独立的数据模型和接口。
- 只有用户首次点击题目页顶部“题解”时才加载题解列表。
- 题解详情保持在题目页面左栏展示，右侧代码编辑器不会被替换。
- 题解正文复用社区 Markdown 渲染器，支持 KaTeX、代码高亮和 GFM。
- 支持发布、修改、删除和点赞题解。
- 题解评论不会随详情一起请求，用户滚动到正文底部附近后才加载。
- 题解列表和评论均使用游标分页。

### 收藏夹

- 创建、修改和删除收藏夹。
- 添加或移出收藏题目。
- 显示收藏夹完成进度和题目状态。
- 从收藏夹进入题目后，返回操作会回到原收藏夹。

### 智能复习

- 根据 SM-2 算法安排每日复习。
- 提供轻松、标准和紧张三种复习配置。
- 高级参数按需展开。
- 从复习页进入题目后，提交代码会携带 `submitScene: "REVIEW"`。

### 社区讨论

- 帖子游标分页、热门排行、标题搜索和标签筛选。
- 发布、修改和删除 Markdown 帖子。
- 评论、回复、点赞及作者权限操作。
- 支持从讨论区搜索题目并进入在线做题页面。

### 用户主页

- 用户头像和个人资料展示、编辑。
- 做题记录和状态统计。
- 题目记录使用游标分页，详情按需加载。

## Markdown 能力

帖子和题解统一使用 [`src/utils/markdown.ts`](src/utils/markdown.ts) 渲染，避免不同页面产生展示差异。

当前支持：

- 标题、引用、列表、表格、删除线和任务列表。
- KaTeX 行内公式 `$x = 1$` 和块级公式 `$$...$$`。
- Java、JavaScript、TypeScript、Python、C++、SQL、HTML、CSS、JSON 和 Shell 代码高亮。
- 外部链接安全打开和图片懒加载。
- DOMPurify HTML 安全过滤。

完整测试内容见 [`markdown-render-test.md`](markdown-render-test.md)。

## 平台声明（使用规范与隐私说明）

正文以纯 HTML 维护在 `src/content/legal/*.html`，构建期通过 Vite `?raw` 内联进产物，运行时不再发请求。

- 展示形态有两种，**共用同一份正文**：登录页/注册页/忘记密码/个人主页用弹窗（`components/legal/LegalDocDialog.vue`），分享或站外访问走公开路由 `/legal/usage`、`/legal/privacy`（`views/LegalView.vue`）。
- 渲染统一在 `components/legal/LegalDocContent.vue`：先经 DOMPurify 清洗再 `v-html`，与 Markdown 渲染保持同一套安全策略。
- 文档标识与路径这类纯逻辑在 `utils/legalKeys.ts`（可被 Node 直接单测），正文登记在 `utils/legalDocs.ts`。
- 正文里的跨文档链接写成 `<a href="/legal/xxx" data-legal="xxx">`，弹窗内切换文档、独立页改路由都由 `data-legal` 派发，不会整页刷新。
- 新增一份声明：加一个 `.html` 正文 → 在 `utils/legalKeys.ts` 的 `LEGAL_DOC_KEYS` 与 `utils/legalDocs.ts` 的 `LEGAL_DOCS` 登记 → 确认 `/legal/:doc` 能取到；`tests/legal-docs.test.mjs` 会校验条款完整性与内链一致性。

### 入口

声明必须在"用户需要它的那一刻"就能点到，因此入口分三层：

| 场景 | 组件 | 位置 |
| --- | --- | --- |
| 桌面常驻 | `LegalHelpMenu.vue` | 五个导航栏右侧的「?」下拉（AppNavBar / 复习 / 讨论 / 个人主页 / 做题页顶栏） |
| 手机常驻 | `LegalDrawerLinks.vue` | 各页导航抽屉底部（桌面档自动隐藏）；做题页没有抽屉，收进顶栏「更多」下拉 |
| 就地提示 | `LegalNotice.vue` | 发帖页、评论框、题解编辑器、AI 面板；一句话告知 + 可点开对应声明 |

- 桌面入口在手机档由 `.cw-hide-phone` 收起，手机入口由 `.cw-only-phone` 显示，两者断点必须同为 768px —— `tests/legal-docs.test.mjs` 会卡这个成对关系，避免出现"两边都没有入口"的空窗。
- 收起的原因：375px 下顶栏右侧簇本来就很挤，多一个 40px 触屏目标会把搜索框从 ~80px 压到 ~43px。
- 对外邮箱只在 `utils/legalDocs.ts` 的 `LEGAL_CONTACT_EMAIL` 里写一次，测试会与《隐私说明》正文比对。

## 项目结构

```text
src/
├─ api/                         接口封装
├─ components/
│  ├─ favorites/               收藏夹功能组件
│  ├─ legal/                   平台声明弹窗、正文渲染与各档入口
│  └─ question-detail/         题目详情、题解和判题结果组件
├─ content/legal/              使用规范与隐私说明正文（HTML）
├─ router/                     页面路由
├─ stores/                     Pinia 状态
├─ types/                      TypeScript 类型
├─ utils/
│  ├─ legalDocs.ts             声明正文与展示元数据
│  ├─ legalKeys.ts             声明文档标识与路径（纯逻辑）
│  ├─ markdown.ts              Markdown、KaTeX、代码高亮和内容过滤
│  └─ WebSocket.ts             判题 WebSocket
└─ views/                      页面级组件
```

## 本地开发

仓库位置不限；与后端一起构建部署时，须与 `CodeWise` 仓库处于同级目录（`deploy/docker-compose.yml` 中前端镜像的构建上下文是 `../../CodeWise-frontend`）。

安装依赖：

```bash
pnpm install
```

启动开发环境：

```bash
pnpm dev
```

默认地址：

```text
http://localhost:5173
```

类型检查：

```bash
pnpm type-check
```

生产构建：

```bash
pnpm build
```

## 接口约定

- 普通 HTTP 请求统一通过共享 `request` 实例访问网关 `/api`。
- 前端不直接连接具体微服务端口。
- 社区、帖子和题解接口统一经过 `/api/community/**`。
- 收藏与复习接口经过 `/api/review/**`。
- WebSocket 暂时保留现有连接方式。
- 雪花算法生成的 `userId` 必须以字符串保存和比较，避免 JavaScript 整数精度丢失。
- 后端 `Result<String>` 的业务字符串可能位于 `message`，一次性 `requestId` 按该规则读取。
- 大列表优先使用 `nextCursor` 和 `hasNext`，不强依赖精确 `total`。

## 题解接口

当前前端使用以下网关接口：

```text
GET    /api/community/solutions
GET    /api/community/solutions/{solutionId}
POST   /api/community/solutions
PUT    /api/community/solutions/{solutionId}
DELETE /api/community/solutions/{solutionId}
PUT    /api/community/likes/solution/{solutionId}
GET    /api/community/comments?type=SOLUTION
POST   /api/community/comments
```

题解评论请求体和查询参数必须标明 `type: "SOLUTION"`，避免与普通社区帖子评论混用。

## 开发约定

1. 页面不要直接拼接微服务地址，新接口先添加到对应的 `src/api/*Api.ts`。
2. 组件按完整功能区域拆分，避免把页面拆成大量微小组件。
3. 用户归属判断统一使用字符串 ID，前端隐藏按钮不能代替后端权限校验。
4. 题解、评论和大列表继续使用懒加载与游标分页。
5. Markdown 能力统一维护在 `src/utils/markdown.ts`。
6. 修改后至少运行 `pnpm type-check`；涉及路由、依赖或构建配置时运行 `pnpm build`。

## 更多文档

- [前端阶段总结与维护说明](docs/frontend-stage-summary.md)
- [Markdown 完整渲染测试](markdown-render-test.md)
