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

## 项目结构

```text
src/
├─ api/                         接口封装
├─ components/
│  ├─ favorites/               收藏夹功能组件
│  └─ question-detail/         题目详情、题解和判题结果组件
├─ router/                     页面路由
├─ stores/                     Pinia 状态
├─ types/                      TypeScript 类型
├─ utils/
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
