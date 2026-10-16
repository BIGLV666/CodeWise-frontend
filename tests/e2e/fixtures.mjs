// E2E 桩服务器的接口 fixture 模块。
//
// 每个规则命中 pathname + method 时返回「信封里的 data」——桩服务器负责把它包进
// { code: 200, message: 'ok', data }（信封形状见 src/api/request.ts 的 ApiResult）。
//
// 约定：
// - test 用正则匹配「不含 query string」的路径部分，必须整段匹配（^...$）；
// - method 省略表示任意方法都命中，同一路径 GET/POST 形状不同时显式区分；
// - 顺序即优先级，越具体的规则越靠前（例如 /review/note/list 必须排在 /review/note/:id 之前）；
// - 列表接口一律给 3 条形状完整的记录，hasNext=false / nextCursor=null，避免静态桩无法翻页时
//   前端反复请求同一批数据造成重复渲染；
// - 兜底原则是「宁可少给也不要给错形状」：拿不准的接口返回 null，绝不返回会让页面抛异常的结构。

/** 固定时间戳，方便断言；不要用 Date.now()，否则每次渲染都在变。 */
const T = '2026-10-15 09:30:00'
const T_DAY = '2026-10-15'

/** 当前登录用户（roleId 2 = 管理员，便于 E2E 打开 /admin 下的页面；要测普通用户改这里）。 */
const currentUser = {
  userId: '1001',
  userName: 'alice_coder',
  nickName: '爱丽丝',
  email: 'alice@example.com',
  phone: '13800000001',
  bio: '专注算法训练与工程能力提升，持续复盘，稳定进步。',
  avatarUrl: '',
  birthday: '2000-05-18',
  roleId: 2,
  status: 1,
  openId: '',
  totalSubmit: 128,
  totalAc: 96,
  rating: 1820,
  createTime: '2026-08-01 10:00:00',
  updateTime: T,
  lastLoginIp: '127.0.0.1',
  lastLoginTime: '2026-10-15 08:30:00',
  banTime: '',
}

/** 首页/详情页共用的题目列表项（消费方：HomeView.normalizeQuestion、DiscussionView.mapQuestion）。 */
const questionBriefs = [
  {
    questionId: 1,
    title: '两数之和',
    questionType: 'ACM',
    difficulty: 1,
    passRate: 62.5,
    totalSubmit: 1240,
    totalAc: 775,
    status: 1,
    tags: '["数组","哈希表"]',
  },
  {
    questionId: 2,
    title: '接雨水',
    questionType: 'ACM',
    difficulty: 3,
    passRate: 38.2,
    totalSubmit: 860,
    totalAc: 328,
    status: 0,
    tags: '["双指针","动态规划"]',
  },
  {
    questionId: 3,
    title: '合并两个有序链表',
    questionType: 'ACM',
    difficulty: 1,
    passRate: 71.4,
    totalSubmit: 990,
    totalAc: 707,
    status: 1,
    tags: '["链表","递归"]',
  },
]

/** 提交记录（消费方：ProfileView.normalizeRecord、QuestionInfoTabs 提交记录表）。 */
const submitRecords = [
  {
    submitRecordId: '1001',
    userId: '1001',
    questionId: 1,
    questionTitle: '两数之和',
    language: 'java',
    submitStatus: 'AC',
    submitContent: 'class Solution { public int[] twoSum(int[] nums, int target) { /* ... */ } }',
    timeUsed: 42,
    memoryUsed: 38912,
    failIndex: 0,
    errorMsg: '',
    submitTime: '2026-10-15 09:12:00',
    createTime: '2026-10-15 09:12:00',
  },
  {
    submitRecordId: '1002',
    userId: '1001',
    questionId: 2,
    questionTitle: '接雨水',
    language: 'cpp',
    submitStatus: 'WA',
    submitContent: 'class Solution { public: int trap(vector<int>& h) { /* ... */ } };',
    timeUsed: 55,
    memoryUsed: 41024,
    failIndex: 7,
    errorMsg: '第 7 组用例未通过',
    submitTime: '2026-10-14 21:40:00',
    createTime: '2026-10-14 21:40:00',
  },
  {
    submitRecordId: '1003',
    userId: '1001',
    questionId: 3,
    questionTitle: '合并两个有序链表',
    language: 'python',
    submitStatus: 'AC',
    submitContent: 'class Solution:\n    def mergeTwoLists(self, l1, l2):\n        ...',
    timeUsed: 38,
    memoryUsed: 22528,
    failIndex: 0,
    errorMsg: '',
    submitTime: '2026-10-13 18:05:00',
    createTime: '2026-10-13 18:05:00',
  },
]

/** 收藏夹（消费方：FavoritesView.mapFavorite、HomeView.mapFavorite）。 */
const favoriteCollections = [
  {
    favoritesId: '9001',
    favoritesName: '我的收藏',
    favoritesType: 'DEFAULT',
    favoritesContent: '算法刷题主力题单',
    userId: '1001',
    questionIds: [1, 2, 3],
    createTime: '2026-08-02 11:20:00',
    updateTime: '2026-10-10 15:05:00',
  },
  {
    favoritesId: '9002',
    favoritesName: '面试高频',
    favoritesType: 'CUSTOM',
    favoritesContent: '面试前一周集中过一遍',
    userId: '1001',
    questionIds: [2, 3],
    createTime: '2026-09-12 09:00:00',
    updateTime: '2026-10-08 20:30:00',
  },
  {
    favoritesId: '9003',
    favoritesName: '动态规划专题',
    favoritesType: 'CUSTOM',
    favoritesContent: '区间 DP 与线性 DP',
    userId: '1001',
    questionIds: [2],
    createTime: '2026-09-20 14:10:00',
    updateTime: '2026-09-30 10:00:00',
  },
]

/** 收藏夹里的题目（消费方：FavoritesView.mapQuestion、ReviewView.normalizeListResponse）。 */
const favoriteQuestions = [
  {
    questionId: '1',
    title: '两数之和',
    questionTitle: '两数之和',
    difficulty: 1,
    passRate: 62.5,
    totalSubmit: 1240,
    totalAc: 775,
    status: 1,
    tags: '数组,哈希表',
  },
  {
    questionId: '2',
    title: '接雨水',
    questionTitle: '接雨水',
    difficulty: 3,
    passRate: 38.2,
    totalSubmit: 860,
    totalAc: 328,
    status: 0,
    tags: '双指针,动态规划',
  },
  {
    questionId: '3',
    title: '合并两个有序链表',
    questionTitle: '合并两个有序链表',
    difficulty: 1,
    passRate: 71.4,
    totalSubmit: 990,
    totalAc: 707,
    status: 1,
    tags: '链表,递归',
  },
]

/** 社区帖子（消费方：DiscussionView.mapPost、DiscussionDetailView.mapPost）。 */
const communityPosts = [
  {
    postId: '2001',
    postTitle: '如何系统准备算法面试？三个月从零到 offer',
    postContent: '先按专题刷，再按频次刷。推荐从数组、链表、二叉树开始，每天固定 2-3 题并写题解复盘。',
    tags: ['面试', '算法'],
    userId: '1002',
    userName: 'bob_dev',
    avatarUrl: '',
    likeCount: 42,
    commentCount: 8,
    viewCount: 320,
    isLike: false,
    createTime: '2026-10-12 20:10:00',
    updateTime: '2026-10-12 20:10:00',
  },
  {
    postId: '2002',
    postTitle: '接雨水的三种解法对比（双指针 / 单调栈 / DP）',
    postContent: '双指针最容易在面试里写对，单调栈更通用，DP 思路最直观但空间是 O(n)。',
    tags: ['算法', '技术交流'],
    userId: '1003',
    userName: 'carol_ai',
    avatarUrl: '',
    likeCount: 28,
    commentCount: 5,
    viewCount: 210,
    isLike: true,
    createTime: '2026-10-11 15:42:00',
    updateTime: '2026-10-13 09:00:00',
  },
  {
    postId: '2003',
    postTitle: '分享一份后端实习内推（附面经）',
    postContent: '团队做在线判题系统，要求熟悉 Java 与分布式基础，面经里重点问了消息队列与幂等。',
    tags: ['内推', '面试复盘'],
    userId: '1002',
    userName: 'bob_dev',
    avatarUrl: '',
    likeCount: 61,
    commentCount: 12,
    viewCount: 540,
    isLike: false,
    createTime: '2026-10-09 10:05:00',
    updateTime: '2026-10-09 10:05:00',
  },
]

/** 帖子评论（消费方：DiscussionDetailView.mapComment、QuestionSolutionPanel.mapComment）。 */
const communityComments = [
  {
    commentId: '2101',
    comment: '谢谢分享，专题刷的思路很有帮助。',
    postId: '2001',
    rootCommentId: '-1',
    userId: '1003',
    userName: 'carol_ai',
    replyUserId: null,
    replyUserName: null,
    likeCount: 3,
    isLike: false,
    createTime: '2026-10-13 08:15:00',
  },
  {
    commentId: '2102',
    comment: '双指针写法的边界条件能再展开讲讲吗？',
    postId: '2001',
    rootCommentId: '-1',
    userId: '1001',
    userName: 'alice_coder',
    replyUserId: null,
    replyUserName: null,
    likeCount: 1,
    isLike: false,
    createTime: '2026-10-13 09:02:00',
  },
  {
    commentId: '2103',
    comment: '主要注意 left 和 right 相遇时的判断，先移动再更新答案。',
    postId: '2001',
    rootCommentId: '2101',
    userId: '1002',
    userName: 'bob_dev',
    replyUserId: '1003',
    replyUserName: 'carol_ai',
    likeCount: 0,
    isLike: false,
    createTime: '2026-10-13 09:40:00',
  },
]

/** 题解列表/详情（消费方：QuestionSolutionPanel.mapSummary / mapDetail）。 */
const communitySolutions = [
  {
    solutionId: '2201',
    questionId: 1,
    solutionTitle: '哈希表一遍扫描：O(n) 解决两数之和',
    solutionContent: '遍历数组时把 target - nums[i] 记在哈希表里，命中即返回下标。',
    solutionUserId: '1003',
    userDto: { userId: '1003', userName: 'carol_ai', nickName: '卡罗尔', avatarUrl: '' },
    likeCount: 24,
    lookCount: 310,
    commentCount: 4,
    tags: ['哈希表', 'Java'],
    isLike: false,
    createTime: '2026-10-08 19:20:00',
  },
  {
    solutionId: '2202',
    questionId: 1,
    solutionTitle: '暴力枚举的边界与优化思路',
    solutionContent: '两层循环 O(n^2) 只是起点，重点在解释为什么需要哈希表降复杂度。',
    solutionUserId: '1002',
    userDto: { userId: '1002', userName: 'bob_dev', nickName: '鲍勃', avatarUrl: '' },
    likeCount: 9,
    lookCount: 120,
    commentCount: 1,
    tags: ['枚举'],
    isLike: false,
    createTime: '2026-10-07 12:00:00',
  },
  {
    solutionId: '2203',
    questionId: 2,
    solutionTitle: '接雨水：双指针 O(1) 空间解法',
    solutionContent: '维护左右最大高度，每次移动较小的一侧并累加差值。',
    solutionUserId: '1001',
    userDto: { userId: '1001', userName: 'alice_coder', nickName: '爱丽丝', avatarUrl: '' },
    likeCount: 17,
    lookCount: 205,
    commentCount: 3,
    tags: ['双指针', 'C++'],
    isLike: true,
    createTime: '2026-10-06 21:30:00',
  },
]

/** 审核台内容详情（消费方：CheckDetail，帖子/题解/评论共用）。 */
const checkDetailBase = {
  userId: '1002',
  userName: 'bob_dev',
  userDto: { userId: '1002', userName: 'bob_dev', nickName: '鲍勃', avatarUrl: '' },
  likeCount: 42,
  commentCount: 8,
  createTime: '2026-10-12 20:10:00',
  updateTime: '2026-10-12 20:10:00',
}

const checkDetailPost = ({
  ...checkDetailBase,
  targetId: '2001',
  type: 'POST',
  title: '如何系统准备算法面试？三个月从零到 offer',
  content: '先按专题刷，再按频次刷。推荐从数组、链表、二叉树开始，每天固定 2-3 题并写题解复盘。',
  status: 0,
  tags: ['面试', '算法'],
  postId: null,
  rootCommentId: null,
  questionId: null,
  checkReason: null,
})
const checkDetailSolution = ({
  ...checkDetailBase,
  targetId: '2201',
  type: 'SOLUTION',
  title: '哈希表一遍扫描：O(n) 解决两数之和',
  content: '遍历数组时把 target - nums[i] 记在哈希表里，命中即返回下标。',
  status: 0,
  tags: ['哈希表', 'Java'],
  postId: null,
  rootCommentId: null,
  questionId: '1',
  checkReason: null,
})
const checkDetailComment = ({
  ...checkDetailBase,
  targetId: '2101',
  type: 'COMMENT',
  title: null,
  content: '谢谢分享，专题刷的思路很有帮助。',
  status: 1,
  tags: null,
  postId: '2001',
  rootCommentId: '-1',
  questionId: null,
  checkReason: '请文明讨论',
})

/** 待审核/已发布内容列表项（消费方：PendingPostList / PendingSolutionList / PublishedCommentList）。 */
const pendingPosts = [
  { postId: '2001', postTitle: '如何系统准备算法面试？三个月从零到 offer', postContent: '先按专题刷，再按频次刷。', userId: '1002', userName: 'bob_dev', tags: ['面试', '算法'], status: 0, likeCount: 42, commentCount: 8, createTime: '2026-10-12 20:10:00' },
  { postId: '2002', postTitle: '接雨水的三种解法对比', postContent: '双指针 / 单调栈 / DP 的取舍。', userId: '1003', userName: 'carol_ai', tags: ['算法', '技术交流'], status: 0, likeCount: 28, commentCount: 5, createTime: '2026-10-11 15:42:00' },
  { postId: '2003', postTitle: '分享一份后端实习内推（附面经）', postContent: '团队做在线判题系统。', userId: '1002', userName: 'bob_dev', tags: ['内推'], status: 0, likeCount: 61, commentCount: 12, createTime: '2026-10-09 10:05:00' },
]
const pendingSolutions = [
  { solutionId: '2201', solutionTitle: '哈希表一遍扫描：O(n) 解决两数之和', solutionContent: '遍历数组时维护哈希表。', questionId: '1', solutionUserId: '1003', userId: '1003', userName: 'carol_ai', status: 0, likeCount: 24, createTime: '2026-10-08 19:20:00' },
  { solutionId: '2202', solutionTitle: '暴力枚举的边界与优化思路', solutionContent: '两层循环只是起点。', questionId: '1', solutionUserId: '1002', userId: '1002', userName: 'bob_dev', status: 0, likeCount: 9, createTime: '2026-10-07 12:00:00' },
  { solutionId: '2203', solutionTitle: '接雨水：双指针 O(1) 空间解法', solutionContent: '维护左右最大高度。', questionId: '2', solutionUserId: '1001', userId: '1001', userName: 'alice_coder', status: 0, likeCount: 17, createTime: '2026-10-06 21:30:00' },
]
const publishedComments = [
  { commentId: '2101', comment: '谢谢分享，专题刷的思路很有帮助。', postId: '2001', rootCommentId: '-1', userId: '1003', userName: 'carol_ai', status: 1, likeCount: 3, createTime: '2026-10-13 08:15:00' },
  { commentId: '2102', comment: '双指针写法的边界条件能再展开讲讲吗？', postId: '2001', rootCommentId: '-1', userId: '1001', userName: 'alice_coder', status: 1, likeCount: 1, createTime: '2026-10-13 09:02:00' },
  { commentId: '2103', comment: '主要注意 left 和 right 相遇时的判断。', postId: '2001', rootCommentId: '2101', userId: '1002', userName: 'bob_dev', status: 1, likeCount: 0, createTime: '2026-10-13 09:40:00' },
]

/**
 * 一条 fixture 规则：命中 path+method 时返回 data（信封里的 payload）。
 * 顺序即优先级，越具体越靠前。
 */
export const fixtures = [
  // ==================== 用户 / 认证 ====================
  // 登录：LoginView 用 response.data 取出 { token, user } 交给 applyLoginResult。
  {
    method: 'POST',
    test: /^\/api\/user\/login$/,
    data: { token: 'e2e-token-alice', user: currentUser },
  },
  {
    method: 'POST',
    test: /^\/api\/user\/emailloginforcode$/,
    data: { token: 'e2e-token-alice', user: currentUser },
  },
  { method: 'POST', test: /^\/api\/user\/emailregister$/, data: null },
  { method: 'POST', test: /^\/api\/user\/register$/, data: null },
  { method: 'POST', test: /^\/api\/user\/getemailcode$/, data: null },
  { method: 'POST', test: /^\/api\/user\/updatepasswordforemail$/, data: null },
  { method: 'POST', test: /^\/api\/user\/updatefromcode$/, data: null },
  // 当前登录用户 / 指定用户公开信息（HomeView、ProfileView、User store.ensureRoleId）。
  { method: 'GET', test: /^\/api\/user\/getuserbyid$/, data: currentUser },
  { method: 'GET', test: /^\/api\/user\/info\/[^/]+$/, data: currentUser },
  { method: 'POST', test: /^\/api\/user\/updatepassword$/, data: null },
  { method: 'POST', test: /^\/api\/user\/freeze$/, data: null },
  { method: 'POST', test: /^\/api\/user\/delete$/, data: null },
  // 资料更新返回更新后的用户对象（ProfileView: res?.data || res 之后 applyUserInfo）。
  { method: 'PUT', test: /^\/api\/user\/nickname$/, data: currentUser },
  { method: 'PUT', test: /^\/api\/user\/bio$/, data: currentUser },
  { method: 'PUT', test: /^\/api\/user\/birthday$/, data: currentUser },
  // 头像上传返回新的头像地址字符串。
  { method: 'POST', test: /^\/api\/user\/avatar$/, data: 'https://cdn.codewise.dev/avatar/1001.png' },

  // ---- 管理端用户 ----
  // 顺序：ban/detail 与 appeal/* 必须排在 ban、detail 之前。
  { method: 'GET', test: /^\/api\/user\/admin\/ban\/detail$/, data: { ...currentUser, userId: '1002', userName: 'bob_dev', nickName: '鲍勃', email: null, phone: null, roleId: 1, status: 0, banTime: '2026-10-01 00:00:00' } },
  { method: 'GET', test: /^\/api\/user\/admin\/appeal\/list$/, data: [
    { userAppealId: 7001, userId: 1002, appealReason: '账号被盗后误发广告，申请解封', reasonEmail: null, status: 0, createTime: '2026-10-02 09:00:00', updateTime: null, processResult: null, operatorId: null },
    { userAppealId: 7002, userId: 1003, appealReason: '内容被误判为违规，已自行删除', reasonEmail: null, status: 0, createTime: '2026-10-03 14:20:00', updateTime: null, processResult: null, operatorId: null },
    { userAppealId: 7003, userId: 1004, appealReason: '申诉：封禁理由与实际行为不符', reasonEmail: null, status: 1, createTime: '2026-09-28 11:10:00', updateTime: '2026-09-29 10:00:00', processResult: '已核实并解封', operatorId: 1 },
  ] },
  { method: 'GET', test: /^\/api\/user\/admin\/appeal\/detail$/, data: { userAppealId: 7001, userId: 1002, appealReason: '账号被盗后误发广告，申请解封', reasonEmail: null, status: 0, createTime: '2026-10-02 09:00:00', updateTime: null, processResult: null, operatorId: null, banTime: '2026-10-01 00:00:00', banReason: '发布大量重复广告内容' } },
  { method: 'POST', test: /^\/api\/user\/admin\/appeal\/process$/, data: null },
  { method: 'GET', test: /^\/api\/user\/admin\/user$/, data: { ...currentUser, userId: '1002', userName: 'bob_dev', nickName: '鲍勃', email: null, phone: null, roleId: 1, status: 1, totalSubmit: 210, totalAc: 150 } },
  { method: 'GET', test: /^\/api\/user\/admin\/detail$/, data: { ...currentUser, userId: '1002', userName: 'bob_dev', nickName: '鲍勃', email: null, phone: null, roleId: 1, status: 1, totalSubmit: 210, totalAc: 150, lastLoginIp: '203.0.113.8', lastLoginTime: '2026-10-14 22:10:00', banTime: null } },
  { method: 'POST', test: /^\/api\/user\/admin\/ban$/, data: null },
  { method: 'POST', test: /^\/api\/user\/admin\/unban$/, data: null },

  // ==================== 题目 ====================
  { method: 'GET', test: /^\/api\/question\/cursorquestions$/, data: { records: questionBriefs, nextCursor: null, hasNext: false, total: 3 } },
  { method: 'GET', test: /^\/api\/question\/total$/, data: 3 },
  // 题目详情：AdminTestCasesView 会校验返回的 questionId 与请求一致，所以这里固定返回 1 号题，
  // 管理端用例列表请从 /api/question/getallquestion 里选 questionId=1 的那一行。
  {
    method: 'GET',
    test: /^\/api\/question\/getquestionbyid$/,
    data: {
      questionId: 1,
      title: '两数之和',
      questionType: 'ACM',
      difficulty: 1,
      description: '给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值的那两个整数，并返回它们的数组下标。\n\n你可以假设每种输入只会对应一个答案，且不能重复利用同一个元素。',
      inputDesc: '第一行是数组 nums，第二行是目标值 target。',
      outputDesc: '输出两个下标，按从小到大排列，空格分隔。',
      hint: '可以用哈希表把查找降到 O(1)，避免两层循环。',
      sampleInput: '2 7 11 15\n9',
      sampleOutput: '0 1',
      tags: '["数组","哈希表"]',
      timeLimit: 1000,
      memoryLimit: 256,
      totalSubmit: 1240,
      totalAc: 775,
      status: 1,
      createTime: '2026-08-05 10:00:00',
      testCases: [
        { caseId: 1, questionId: 1, inputData: '2 7 11 15\n9', expectedOutput: '0 1', isSample: 1, isHidden: 0, sortOrder: 1, scoreWeight: 50, timeLimit: 1000, memoryLimit: 256 },
        { caseId: 2, questionId: 1, inputData: '3 2 4\n6', expectedOutput: '1 2', isSample: 1, isHidden: 0, sortOrder: 2, scoreWeight: 50, timeLimit: 1000, memoryLimit: 256 },
        { caseId: 3, questionId: 1, inputData: '3 3\n6', expectedOutput: '0 1', isSample: 0, isHidden: 1, sortOrder: 3, scoreWeight: 100, timeLimit: 2000, memoryLimit: 512 },
      ],
    },
  },
  // 判题：submitCode 期望拿到 submitRecordId（number）。
  { method: 'POST', test: /^\/api\/question\/judge$/, data: 1001 },
  // 调试：期望字符串结果。
  { method: 'POST', test: /^\/api\/question\/debug$/, data: '调试完成：3 组用例全部通过' },
  // 某题的提交记录：QuestionDetailView 直接当作数组用。
  { method: 'GET', test: /^\/api\/question\/getsubmitrecordsbyquestionid$/, data: submitRecords },
  // 某用户的提交记录：消费方读 payload.records（HomeView 提交日历、ProfileView 提交列表）。
  { method: 'GET', test: /^\/api\/question\/getsubmitrecordsbyuserid$/, data: { records: submitRecords, nextCursor: null, hasNext: false } },
  // 测试点概览：末尾汇总行靠 total 字段识别。
  { method: 'GET', test: /^\/api\/question\/getallquestion$/, data: [
    { question_id: 1, count: 5 },
    { question_id: 2, count: 3 },
    { question_id: 3, count: 2 },
    { total: 3, questions: 3 },
  ] },
  { method: 'GET', test: /^\/api\/question\/gettestcasesbyquestionid$/, data: [
    { caseId: 1, questionId: 1, inputData: '2 7 11 15\n9', expectedOutput: '0 1', isSample: 1, isHidden: 0, sortOrder: 1, scoreWeight: 50, timeLimit: 1000, memoryLimit: 256, createTime: '2026-08-05 10:10:00', updateTime: '2026-08-05 10:10:00' },
    { caseId: 2, questionId: 1, inputData: '3 2 4\n6', expectedOutput: '1 2', isSample: 1, isHidden: 0, sortOrder: 2, scoreWeight: 50, timeLimit: 1000, memoryLimit: 256, createTime: '2026-08-05 10:11:00', updateTime: '2026-08-05 10:11:00' },
    { caseId: 3, questionId: 1, inputData: '3 3\n6', expectedOutput: '0 1', isSample: 0, isHidden: 1, sortOrder: 3, scoreWeight: 100, timeLimit: 2000, memoryLimit: 512, createTime: '2026-08-05 10:12:00', updateTime: '2026-08-05 10:12:00' },
  ] },
  { method: 'GET', test: /^\/api\/question\/gettestcasebyid$/, data: { caseId: 1, questionId: 1, inputData: '2 7 11 15\n9', expectedOutput: '0 1', isSample: 1, isHidden: 0, sortOrder: 1, scoreWeight: 50, timeLimit: 1000, memoryLimit: 256 } },
  { method: 'POST', test: /^\/api\/question\/addquestion$/, data: { questionId: 4, title: '有效的括号' } },
  { method: 'POST', test: /^\/api\/question\/addtestcase$/, data: null },
  { method: 'PUT', test: /^\/api\/question\/updatetestcase$/, data: null },
  { method: 'DELETE', test: /^\/api\/question\/deletetestcase$/, data: null },

  // ---- 函数题：LeetCode 导入与测试用例生成 ----
  // 顺序：更具体的 artifacts / test-cases 路径不受 /question/function/leetcode$ 影响（都锚定了 $）。
  { method: 'GET', test: /^\/api\/question\/function\/test-cases\/generate\/status$/, data: { taskId: 'task-fn-1', questionId: 1, userId: '1001', status: 'SUCCESS', requestedCount: 10, generatedCount: 10, seed: '12345', createTime: T, finishTime: T } },
  { method: 'POST', test: /^\/api\/question\/function\/test-cases\/generate$/, data: { taskId: 'task-fn-1', questionId: 1, userId: '1001', status: 'PENDING', requestedCount: 10, generatedCount: 0, seed: '12345', createTime: T } },
  { method: 'POST', test: /^\/api\/question\/function\/test-cases\/batch$/, data: 3 },
  { method: 'GET', test: /^\/api\/question\/function\/leetcode\/artifacts\/status$/, data: { taskId: 'task-lc-1', titleSlug: 'two-sum', questionId: 1, userId: '1001', status: 'SUCCESS', generatedCount: 50, artifactDirectory: 'data/function-artifacts/two-sum', createTime: T, finishTime: T } },
  { method: 'POST', test: /^\/api\/question\/function\/leetcode\/artifacts\/generate$/, data: { taskId: 'task-lc-1', titleSlug: 'two-sum', questionId: 1, userId: '1001', status: 'PENDING', generatedCount: 0, createTime: T } },
  { method: 'GET', test: /^\/api\/question\/function\/leetcode$/, data: {
    title: '两数之和',
    description: '给定一个整数数组 nums 和一个整数目标值 target，返回和为目标值的两个下标。',
    inputDesc: 'nums 数组与 target 目标值。',
    outputDesc: '两个下标组成的数组。',
    hint: '用哈希表存已访问元素。',
    source: 'LeetCode',
    difficulty: 1,
    tags: '数组,哈希表',
    timeLimit: 2000,
    memoryLimit: 256,
    className: 'Solution',
    methodName: 'twoSum',
    parameterConfig: '[{"type":"int[]","name":"nums"},{"type":"int","name":"target"}]',
    outputType: 'int[]',
    samples: [
      { input: '[2,7,11,15]\n9', output: '[0,1]' },
      { input: '[3,2,4]\n6', output: '[1,2]' },
    ],
  } },
  { method: 'POST', test: /^\/api\/question\/function$/, data: 4 },

  // ==================== 复习 / 收藏 ====================
  // 顺序：requestId / questions / list 必须排在 /review/favorites$ 之前（都锚定 $，实际不冲突，仍按具体程度排）。
  { method: 'GET', test: /^\/api\/review\/favorites\/requestId$/, data: '4d1f0c9a-3f2e-4b7a-9c11-8f2a6d5e7001' },
  { method: 'GET', test: /^\/api\/review\/favorites\/questions$/, data: favoriteQuestions },
  { method: 'GET', test: /^\/api\/review\/favorites\/list$/, data: favoriteCollections },
  { method: 'POST', test: /^\/api\/review\/favorites$/, data: null },
  { method: 'PUT', test: /^\/api\/review\/favorites$/, data: null },
  { method: 'DELETE', test: /^\/api\/review\/favorites$/, data: null },
  { method: 'POST', test: /^\/api\/review\/favorites\/question$/, data: null },
  { method: 'DELETE', test: /^\/api\/review\/favorites\/question$/, data: null },

  // 今日复习：TodayReviewResponse（ReviewView 兼容数组与对象两种形态，这里给对象）。
  {
    method: 'GET',
    test: /^\/api\/review\/review\/today$/,
    data: {
      reviewRecord: {
        reviewRecordId: '8001',
        userId: '1001',
        pendingReviewQuestionIds: [1, 2, 3],
        completedReviewQuestionIds: [],
        acQuestionIds: [1, 3],
        reviewDays: 12,
        reviewDate: T_DAY,
        createTime: T,
      },
      questions: favoriteQuestions,
    },
  },
  {
    method: 'GET',
    test: /^\/api\/review\/review\/config$/,
    data: {
      reviewConfigId: '7001',
      userId: '1001',
      reviewCount: 20,
      enableAutoReview: 1,
      countCompileError: 1,
      minEasinessFactor: 1.3,
      initialEasinessFactor: 2.5,
      masteredIntervalDays: 30,
      createTime: '2026-08-20 09:00:00',
      updateTime: T,
    },
  },
  { method: 'PUT', test: /^\/api\/review\/review\/config$/, data: {
    reviewConfigId: '7001',
    userId: '1001',
    reviewCount: 20,
    enableAutoReview: 1,
    countCompileError: 1,
    minEasinessFactor: 1.3,
    initialEasinessFactor: 2.5,
    masteredIntervalDays: 30,
  } },
  { method: 'GET', test: /^\/api\/review\/review\/allrecord$/, data: [
    { reviewRecordId: '8001', userId: '1001', pendingReviewQuestionIds: [1, 2], completedReviewQuestionIds: [3], acQuestionIds: [1, 3], reviewDays: 12, reviewDate: T_DAY, createTime: T },
    { reviewRecordId: '8002', userId: '1001', pendingReviewQuestionIds: [2], completedReviewQuestionIds: [1], acQuestionIds: [1], reviewDays: 11, reviewDate: '2026-10-14', createTime: '2026-10-14 09:00:00' },
    { reviewRecordId: '8003', userId: '1001', pendingReviewQuestionIds: [], completedReviewQuestionIds: [2, 3], acQuestionIds: [2, 3], reviewDays: 10, reviewDate: '2026-10-13', createTime: '2026-10-13 09:00:00' },
  ] },
  { method: 'GET', test: /^\/api\/review\/review\/record\/[^/]+$/, data: {
    reviewRecordId: '8001',
    userId: '1001',
    pendingReviewQuestionIds: [1, 2],
    completedReviewQuestionIds: [3],
    acQuestionIds: [1, 3],
    reviewDays: 12,
    reviewDate: T_DAY,
    createTime: T,
    allQuestionIds: [1, 2, 3],
    allQuestionTitles: { 1: '两数之和', 2: '接雨水', 3: '合并两个有序链表' },
  } },
  { method: 'GET', test: /^\/api\/review\/review\/allreview$/, data: [
    { reviewId: '6001', userId: '1001', questionId: '1', questionTitle: '两数之和', weight: 0, easinessFactor: 2.5, repetitions: 3, intervalDays: 7, lastQuality: 4, lastReviewTime: '2026-10-10 09:00:00', nextReviewTime: '2026-10-17 09:00:00', reviewCount: 4, status: 0, createTime: '2026-09-01 09:00:00', updateTime: T },
    { reviewId: '6002', userId: '1001', questionId: '2', questionTitle: '接雨水', weight: 1, easinessFactor: 2.36, repetitions: 2, intervalDays: 3, lastQuality: 3, lastReviewTime: '2026-10-13 09:00:00', nextReviewTime: '2026-10-16 09:00:00', reviewCount: 3, status: 1, createTime: '2026-09-05 09:00:00', updateTime: T },
    { reviewId: '6003', userId: '1001', questionId: '3', questionTitle: '合并两个有序链表', weight: 0, easinessFactor: 2.6, repetitions: 4, intervalDays: 14, lastQuality: 5, lastReviewTime: '2026-10-01 09:00:00', nextReviewTime: '2026-10-20 09:00:00', reviewCount: 5, status: 2, createTime: '2026-08-25 09:00:00', updateTime: T },
  ] },
  { method: 'PUT', test: /^\/api\/review\/review\/review\/[^/]+$/, data: { reviewId: '6001', userId: '1001', questionId: '1', questionTitle: '两数之和', weight: 0, status: 0, nextReviewTime: '2026-10-17 09:00:00' } },
  { method: 'POST', test: /^\/api\/review\/review\/addquestiontoreview$/, data: null },

  // ---- 笔记 ----
  // 顺序：list 与 folders 系列必须排在 /review/note/:id 之前（否则 ":id" 会吃掉 "list"/"folders"）。
  { method: 'GET', test: /^\/api\/review\/note\/folders$/, data: [
    { folderId: '3001', folderName: '算法模板', noteCount: 5, createTime: '2026-08-10 10:00:00', updateTime: T },
    { folderId: '3002', folderName: '面试复盘', noteCount: 3, createTime: '2026-08-15 10:00:00', updateTime: T },
    { folderId: '3003', folderName: '系统设计', noteCount: 0, createTime: '2026-09-01 10:00:00', updateTime: T },
  ] },
  { method: 'POST', test: /^\/api\/review\/note\/folders$/, data: { folderId: '3004', folderName: '新建文件夹', noteCount: 0, createTime: T, updateTime: T } },
  { method: 'PUT', test: /^\/api\/review\/note\/folders\/[^/]+$/, data: { folderId: '3001', folderName: '算法模板', noteCount: 5, createTime: '2026-08-10 10:00:00', updateTime: T } },
  { method: 'DELETE', test: /^\/api\/review\/note\/folders\/[^/]+$/, data: null },
  { method: 'GET', test: /^\/api\/review\/note\/list$/, data: {
    items: [
      { noteId: '4001', title: '二分查找的边界处理', folderId: '3001', contentType: 'MD', preview: '总结 lower_bound 与 upper_bound 的写法差异，避免死循环。', createTime: '2026-10-01 20:00:00', updateTime: '2026-10-13 21:10:00' },
      { noteId: '4002', title: '接雨水：双指针推导', folderId: '3001', contentType: 'MD', preview: '为什么每次移动较小的一侧是正确的——用不变量证明。', createTime: '2026-10-03 09:30:00', updateTime: '2026-10-12 22:00:00' },
      { noteId: '4003', title: '消息队列幂等设计', folderId: '3003', contentType: 'MD', preview: '消费者侧唯一键 + 去重表，配合生产者重试与死信队列。', createTime: '2026-10-05 14:00:00', updateTime: '2026-10-05 14:00:00' },
    ],
    nextCursor: null,
    hasNext: false,
    total: 3,
  } },
  { method: 'POST', test: /^\/api\/review\/note\/[^/]+\/move$/, data: null },
  { method: 'GET', test: /^\/api\/review\/note\/[^/]+$/, data: { noteId: '4001', title: '二分查找的边界处理', folderId: '3001', contentType: 'MD', content: '# 二分查找的边界处理\n\n`lower_bound` 返回第一个 `>= target` 的位置，`upper_bound` 返回第一个 `> target` 的位置。\n\n```java\nint lo = 0, hi = n;\nwhile (lo < hi) {\n  int mid = lo + (hi - lo) / 2;\n  if (a[mid] < target) lo = mid + 1;\n  else hi = mid;\n}\n```', createTime: '2026-10-01 20:00:00', updateTime: '2026-10-13 21:10:00' } },
  { method: 'POST', test: /^\/api\/review\/note$/, data: { noteId: '4004', title: '新建笔记', folderId: null, contentType: 'MD', content: '正文', createTime: T, updateTime: T } },
  { method: 'PUT', test: /^\/api\/review\/note\/[^/]+$/, data: { noteId: '4001', title: '二分查找的边界处理', folderId: '3001', contentType: 'MD', content: '正文（已更新）', createTime: '2026-10-01 20:00:00', updateTime: T } },
  { method: 'DELETE', test: /^\/api\/review\/note\/[^/]+$/, data: null },

  // ---- 学习计划 ----
  { method: 'GET', test: /^\/api\/review\/progress\/calendar\/month$/, data: [
    { date: '2026-10-01', total: 2, completed: 2 },
    { date: '2026-10-08', total: 3, completed: 1 },
    { date: '2026-10-15', total: 3, completed: 1 },
  ] },
  { method: 'GET', test: /^\/api\/review\/progress\/report\/week$/, data: {
    startDate: '2026-10-13',
    endDate: '2026-10-19',
    totalPlanned: 12,
    completedCount: 7,
    inProgressCount: 3,
    expiredCount: 2,
    daily: [
      { date: '2026-10-13', total: 2, completed: 2 },
      { date: '2026-10-14', total: 3, completed: 2 },
      { date: '2026-10-15', total: 3, completed: 1 },
    ],
    completedItems: [
      { questionId: '1', title: '两数之和', summaryContent: '一遍哈希即可，注意先查后存。' },
      { questionId: '3', title: '合并两个有序链表', summaryContent: '虚拟头结点能省掉大量边界判断。' },
    ],
  } },
  { method: 'GET', test: /^\/api\/review\/progress\/list$/, data: [
    { progressId: '5001', userId: '1001', questionId: '1', submitIds: ['1001'], status: 2, notesContent: '复习哈希表', summaryContent: '掌握了一遍哈希解法', beginTime: T_DAY, createTime: T, updateTime: T },
    { progressId: '5002', userId: '1001', questionId: '2', submitIds: ['1002'], status: 1, notesContent: '双指针与单调栈都要会', summaryContent: '', beginTime: T_DAY, createTime: T, updateTime: T },
    { progressId: '5003', userId: '1001', questionId: '3', submitIds: [], status: 0, notesContent: '明天开始', summaryContent: '', beginTime: T_DAY, createTime: T, updateTime: T },
  ] },
  { method: 'POST', test: /^\/api\/review\/progress\/create$/, data: { progressId: '5004', userId: '1001', questionId: '1', status: 0, beginTime: T_DAY, createTime: T, updateTime: T } },
  { method: 'POST', test: /^\/api\/review\/progress\/update$/, data: null },
  { method: 'POST', test: /^\/api\/review\/progress\/delete$/, data: null },

  // ==================== 社区 ====================
  { method: 'GET', test: /^\/api\/community\/request-id$/, data: '9c2b0d41-77aa-4f0e-8fbc-2d3a5e6b8001' },
  // 顺序：hot / search / tag 必须排在 /community/posts/:postId 之前（都锚定 $，靠前置保证语义清晰）。
  { method: 'GET', test: /^\/api\/community\/posts\/hot$/, data: communityPosts },
  { method: 'GET', test: /^\/api\/community\/posts\/search$/, data: communityPosts },
  { method: 'GET', test: /^\/api\/community\/posts\/tag$/, data: communityPosts },
  { method: 'GET', test: /^\/api\/community\/posts$/, data: { records: communityPosts, nextCursor: null, hasNext: false } },
  { method: 'POST', test: /^\/api\/community\/posts$/, data: null },
  // 详情帖归当前登录用户所有（userId 1001），这样详情页的编辑/删除入口才会渲染。
  { method: 'GET', test: /^\/api\/community\/posts\/[^/]+$/, data: { ...communityPosts[0], userId: '1001', userName: 'alice_coder', userDto: { userId: '1001', userName: 'alice_coder', nickName: '爱丽丝', avatarUrl: '' }, relatedPost: { 算法: { 2002: '接雨水的三种解法对比', 2003: '分享一份后端实习内推（附面经）' } } } },
  { method: 'PUT', test: /^\/api\/community\/posts\/[^/]+$/, data: null },
  { method: 'DELETE', test: /^\/api\/community\/posts\/[^/]+$/, data: null },

  // 我的内容：消费方同时读 records 与 list，靠 id/targetId 计算游标。
  { method: 'GET', test: /^\/api\/community\/mine$/, data: {
    records: [
      { id: '2001', targetId: '2001', type: 'POST', title: '如何系统准备算法面试？三个月从零到 offer', content: '先按专题刷，再按频次刷。', status: 1, tags: ['面试', '算法'], rootId: null, rootType: null, questionId: null, createTime: '2026-10-12 20:10:00', updateTime: '2026-10-12 20:10:00', rejectReason: null, checkReason: null },
      { id: '2201', targetId: '2201', type: 'SOLUTION', title: '哈希表一遍扫描：O(n) 解决两数之和', content: '遍历数组时维护哈希表。', status: 1, tags: ['哈希表'], rootId: null, rootType: null, questionId: '1', createTime: '2026-10-08 19:20:00', updateTime: '2026-10-08 19:20:00', rejectReason: null, checkReason: null },
      { id: '2102', targetId: '2102', type: 'COMMENT', title: null, content: '双指针写法的边界条件能再展开讲讲吗？', status: 2, tags: [], rootId: '2001', rootType: 'POST', questionId: null, createTime: '2026-10-13 09:02:00', updateTime: '2026-10-13 09:02:00', rejectReason: '内容被判定为重复提问', checkReason: '内容被判定为重复提问' },
    ],
    list: null,
    nextCursor: null,
    hasNext: false,
    hasMore: false,
  } },

  { method: 'GET', test: /^\/api\/community\/comments$/, data: { records: communityComments, nextCursor: null, hasNext: false } },
  { method: 'POST', test: /^\/api\/community\/comments$/, data: null },
  { method: 'DELETE', test: /^\/api\/community\/comments\/[^/]+$/, data: null },

  { method: 'GET', test: /^\/api\/community\/solutions$/, data: { records: communitySolutions, nextCursor: null, hasNext: false } },
  { method: 'POST', test: /^\/api\/community\/solutions$/, data: null },
  // 题解详情同样归当前登录用户，便于渲染 owner（编辑/删除）入口。
  { method: 'GET', test: /^\/api\/community\/solutions\/[^/]+$/, data: { ...communitySolutions[0], solutionUserId: '1001', userDto: { userId: '1001', userName: 'alice_coder', nickName: '爱丽丝', avatarUrl: '' } } },
  { method: 'PUT', test: /^\/api\/community\/solutions\/[^/]+$/, data: null },
  { method: 'DELETE', test: /^\/api\/community\/solutions\/[^/]+$/, data: null },

  // 点赞开关：返回切换后的布尔状态。
  { method: 'PUT', test: /^\/api\/community\/likes\/posts\/[^/]+$/, data: true },
  { method: 'PUT', test: /^\/api\/community\/likes\/comments\/[^/]+$/, data: true },
  { method: 'PUT', test: /^\/api\/community\/likes\/solution\/[^/]+$/, data: true },

  // 申诉：submit / my / 详情，注意前缀规则都要排在 /community/appeal/:appealId 之前。
  { method: 'POST', test: /^\/api\/community\/appeal\/submit$/, data: null },
  { method: 'GET', test: /^\/api\/community\/appeal\/my$/, data: { records: [
    { appealId: 3001, postId: 2001, postType: 'POST', title: '如何系统准备算法面试？三个月从零到 offer', reason: '内容为原创，误判为广告', takeDownReason: '疑似广告', status: 0, user: { userId: '1001', userName: 'alice_coder' }, createTime: '2026-10-13 10:00:00', updateTime: '2026-10-13 10:00:00' },
    { appealId: 3002, postId: 2201, postType: 'SOLUTION', title: '哈希表一遍扫描：O(n) 解决两数之和', reason: '题解被误删', takeDownReason: null, status: 2, user: { userId: '1001', userName: 'alice_coder' }, createTime: '2026-10-09 09:30:00', updateTime: '2026-10-10 09:30:00' },
    { appealId: 3003, postId: 2102, postType: 'COMMENT', title: null, reason: '评论被误判为重复提问', takeDownReason: '重复提问', status: 1, user: { userId: '1001', userName: 'alice_coder' }, createTime: '2026-10-05 18:00:00', updateTime: '2026-10-06 09:00:00' },
  ], nextCursor: null, hasNext: false, total: 3 } },
  { method: 'GET', test: /^\/api\/community\/appeal\/[^/]+$/, data: { appealId: 3001, postId: 2001, postType: 'POST', title: '如何系统准备算法面试？三个月从零到 offer', reason: '内容为原创，误判为广告', takeDownReason: '疑似广告', status: 0, user: { userId: '1001', userName: 'alice_coder' }, createTime: '2026-10-13 10:00:00', updateTime: '2026-10-13 10:00:00' } },

  // 申诉管理：列表走社区服务的游标分页（records/nextCursor/hasNext/total）。
  { method: 'GET', test: /^\/api\/community\/appeal-admin\/list$/, data: { records: [
    { appealId: 3001, postId: 2001, postType: 'POST', title: '如何系统准备算法面试？三个月从零到 offer', reason: '内容为原创，误判为广告', takeDownReason: '疑似广告', status: 0, user: { userId: '1001', userName: 'alice_coder' }, createTime: '2026-10-13 10:00:00', updateTime: '2026-10-13 10:00:00' },
    { appealId: 3002, postId: 2201, postType: 'SOLUTION', title: '哈希表一遍扫描：O(n) 解决两数之和', reason: '题解被误删', takeDownReason: null, status: 0, user: { userId: '1001', userName: 'alice_coder' }, createTime: '2026-10-09 09:30:00', updateTime: '2026-10-09 09:30:00' },
    { appealId: 3003, postId: 2102, postType: 'COMMENT', title: null, reason: '评论被误判为重复提问', takeDownReason: '重复提问', status: 0, user: { userId: '1001', userName: 'alice_coder' }, createTime: '2026-10-05 18:00:00', updateTime: '2026-10-05 18:00:00' },
  ], nextCursor: null, hasNext: false, total: 3 } },
  { method: 'POST', test: /^\/api\/community\/appeal-admin\/handle$/, data: null },

  // ---- 内容审核台 ----
  // 列表同时给 list 与 records + hasMore/hasNext，兼容两个不同的消费方。
  { method: 'GET', test: /^\/api\/community\/check\/post\/list$/, data: { list: pendingPosts, records: pendingPosts, hasMore: false, hasNext: false, nextCursor: null, total: 3 } },
  { method: 'GET', test: /^\/api\/community\/check\/post\/detail$/, data: checkDetailPost },
  { method: 'POST', test: /^\/api\/community\/check\/post\/status$/, data: null },
  { method: 'POST', test: /^\/api\/community\/check\/post$/, data: null },
  { method: 'GET', test: /^\/api\/community\/check\/solution\/list$/, data: { list: pendingSolutions, records: pendingSolutions, hasMore: false, hasNext: false, nextCursor: null, total: 3 } },
  { method: 'GET', test: /^\/api\/community\/check\/solution\/detail$/, data: checkDetailSolution },
  { method: 'POST', test: /^\/api\/community\/check\/solution\/status$/, data: null },
  { method: 'POST', test: /^\/api\/community\/check\/solution$/, data: null },
  { method: 'GET', test: /^\/api\/community\/check\/comment\/list$/, data: { list: publishedComments, records: publishedComments, hasMore: false, hasNext: false, nextCursor: null, total: 3 } },
  { method: 'GET', test: /^\/api\/community\/check\/comment\/detail$/, data: checkDetailComment },
  { method: 'POST', test: /^\/api\/community\/check\/comment\/status$/, data: null },
  { method: 'GET', test: /^\/api\/community\/check\/detail$/, data: checkDetailPost },

  // ==================== 消息通知 ====================
  // 顺序：unread-count / read-all 必须排在 /message/notifications/:id 之前。
  { method: 'GET', test: /^\/api\/message\/notifications\/unread-count$/, data: 3 },
  { method: 'PUT', test: /^\/api\/message\/notifications\/read-all$/, data: null },
  { method: 'GET', test: /^\/api\/message\/notifications$/, data: { records: [
    { notificationCenterId: '1101', messageId: 'm-1', title: '你的帖子收到一条点赞', type: 'LIKE', businessType: 'POST', businessId: '2001', userId: '1002', isRead: 0, createTime: '2026-10-15 08:50:00' },
    { notificationCenterId: '1102', messageId: 'm-2', title: '今天有 3 道题待复习', type: 'REVIEW', businessType: 'REVIEW_RECORD', businessId: '8001', userId: '1001', isRead: 0, createTime: '2026-10-15 07:30:00' },
    { notificationCenterId: '1103', messageId: 'm-3', title: '你的题解已通过审核', type: 'CHECKED', businessType: 'SOLUTION', businessId: '2201', userId: '1001', isRead: 1, createTime: '2026-10-13 16:20:00' },
  ], nextCursor: null, hasNext: false } },
  { method: 'GET', test: /^\/api\/message\/notifications\/[^/]+$/, data: {
    notificationCenterId: '1101',
    messageId: 'm-1',
    title: '你的帖子收到一条点赞',
    type: 'LIKE',
    businessType: 'POST',
    businessId: '2001',
    userId: '1002',
    isRead: 0,
    createTime: '2026-10-15 08:50:00',
    content: 'bob_dev 点赞了你的帖子「如何系统准备算法面试？三个月从零到 offer」。',
    extraData: {
      userId: '1002',
      userName: 'bob_dev',
      nickName: '鲍勃',
      avatarUrl: '',
      rootId: '2001',
      rootType: 'POST',
      rootCommentId: null,
      questionId: null,
    },
  } },
  { method: 'DELETE', test: /^\/api\/message\/notifications\/[^/]+$/, data: null },

  // ==================== 判题 / 容器 ====================
  // 顺序：containers 精确路径在前，带路径参数的在后。
  { method: 'GET', test: /^\/api\/judge\/containers$/, data: [
    { language: 'java', total: 2, idle: 1, busy: 1, waiting: 0, configuredCapacity: 2, idleContainerIds: ['c-java-idle-1'], busyContainerIds: ['c-java-busy-1'] },
    { language: 'python', total: 1, idle: 1, busy: 0, waiting: 0, configuredCapacity: 1, idleContainerIds: ['c-python-idle-1'], busyContainerIds: [] },
    { language: 'cpp', total: 1, idle: 0, busy: 1, waiting: 2, configuredCapacity: 1, idleContainerIds: [], busyContainerIds: ['c-cpp-busy-1'] },
  ] },
  { method: 'GET', test: /^\/api\/judge\/failure\/[^/]+\/list$/, data: [
    { failureSubmitId: 1, submitRecordId: 1001, status: 0, retryCount: 0, lastError: '容器池繁忙，暂无法调度', createTime: '2026-10-15 09:20:00', retryTime: null },
    { failureSubmitId: 2, submitRecordId: 1002, status: 3, retryCount: 3, lastError: '编译超时', createTime: '2026-10-14 22:10:00', retryTime: '2026-10-14 22:25:00' },
    { failureSubmitId: 3, submitRecordId: 1003, status: 2, retryCount: 1, lastError: null, createTime: '2026-10-14 20:00:00', retryTime: '2026-10-14 20:05:00' },
  ] },
  { method: 'POST', test: /^\/api\/judge\/failure\/retry\/[^/]+$/, data: null },
  { method: 'DELETE', test: /^\/api\/judge\/containers\/[^/]+\/[^/]+$/, data: null },
  { method: 'POST', test: /^\/api\/judge\/containers\/[^/]+$/, data: null },

  // ==================== AI（service-ai，走 /api 前缀）====================
  // 顺序：configs/models 必须排在 configs/:configId 之前。
  { method: 'POST', test: /^\/api\/ai\/configs\/models$/, data: ['glm-4.5', 'glm-4.5-air', 'glm-4.5-flash'] },
  { method: 'GET', test: /^\/api\/ai\/models$/, data: ['glm-4.5', 'glm-4.5-air'] },
  { method: 'GET', test: /^\/api\/ai\/configs$/, data: [
    { userConfigId: 1, groupName: '默认分组', modelNames: ['glm-4.5', 'glm-4.5-air'] },
    { userConfigId: 2, groupName: '快速分组', modelNames: ['glm-4.5-flash'] },
    { userConfigId: 3, groupName: '长上下文分组', modelNames: ['glm-4.5-long'] },
  ] },
  { method: 'POST', test: /^\/api\/ai\/configs$/, data: { userAiConfigId: 4, groupName: '新建分组', modelNames: ['glm-4.5'], aiUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKey: 'sk-****', createTime: T, updateTime: T } },
  { method: 'GET', test: /^\/api\/ai\/configs\/[^/]+$/, data: { userAiConfigId: 1, groupName: '默认分组', modelNames: ['glm-4.5', 'glm-4.5-air'], aiUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKey: 'sk-****', createTime: '2026-08-02 11:00:00', updateTime: T } },
  { method: 'PUT', test: /^\/api\/ai\/configs\/[^/]+$/, data: { userAiConfigId: 1, groupName: '默认分组', modelNames: ['glm-4.5', 'glm-4.5-air'], aiUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKey: 'sk-****', createTime: '2026-08-02 11:00:00', updateTime: T } },
  { method: 'DELETE', test: /^\/api\/ai\/configs\/[^/]+$/, data: null },
  // 会话列表 / 消息（AiAssistantPanel：listConversations 找 questionId 匹配、getMessages 读 items）。
  { method: 'GET', test: /^\/api\/ai\/advice$/, data: [
    { conversationId: '9001', questionId: '1', userId: '1001', conversationName: '两数之和 追问' },
    { conversationId: '9002', questionId: '2', userId: '1001', conversationName: '接雨水 追问' },
    { conversationId: '9003', questionId: '3', userId: '1001', conversationName: '合并链表 追问' },
  ] },
  { method: 'GET', test: /^\/api\/ai\/advice\/[^/]+\/messages$/, data: { items: [
    { messageId: '9101', conversationId: '9001', content: '这道题可以用哈希表把查找降到 O(1)。', userId: '1001', currentCode: '', role: 'ASSISTANT', createTime: '2026-10-15 09:20:00' },
    { messageId: '9102', conversationId: '9001', content: '如果数组里有重复元素怎么办？', userId: '1001', currentCode: '', role: 'USER', createTime: '2026-10-15 09:22:00' },
    { messageId: '9103', conversationId: '9001', content: '题目保证唯一解，所以不需要额外处理重复值。', userId: '1001', currentCode: '', role: 'ASSISTANT', createTime: '2026-10-15 09:23:00' },
  ], nextCursor: null, hasMore: false } },
  // 实时分析建议：GET 返回字符串数组（RealtimeAdviceWidget 逐条 String()），POST 返回字符串。
  { method: 'GET', test: /^\/api\/ai\/advice\/task$/, data: ['第 12 行循环边界可能越界，建议改成 i < n。', '变量命名可以更语义化，tmp -> prefixSum。', '这里可以用哈希表把内层循环消掉。'] },
  { method: 'POST', test: /^\/api\/ai\/advice\/task$/, data: 'ok' },
  // 追问是 SSE 流（fetch + text/event-stream），静态桩无法伪造事件流，这里只兜住请求不 404。
  { method: 'POST', test: /^\/api\/ai\/advice\/ask$/, data: null },

  // ==================== Agent（codewise-agent，走 /agentapi 前缀）====================
  // 前端 agentApi 的 baseURL 是 VITE_AGENT_BASE_URL=/agentapi，自身路径以 /api/agent 开头，
  // 所以完整路径是 /agentapi/api/agent/...。正则同时兼容带/不带前缀两种形式。
  { method: 'GET', test: /^\/(?:agentapi\/)?api\/agent\/agent_conversation$/, data: [
    { agent_conversation_id: 1, user_id: '1001', agent_conversation_name: '两数之和 调试', create_time: '2026-10-14 10:00:00', update_time: '2026-10-15 09:00:00' },
    { agent_conversation_id: 2, user_id: '1001', agent_conversation_name: '接雨水 复杂度分析', create_time: '2026-10-13 15:30:00', update_time: '2026-10-13 15:50:00' },
    { agent_conversation_id: 3, user_id: '1001', agent_conversation_name: '链表题通用模板', create_time: '2026-10-12 09:10:00', update_time: '2026-10-12 09:30:00' },
  ] },
  { method: 'POST', test: /^\/(?:agentapi\/)?api\/agent\/conversation$/, data: { agent_conversation_id: 9, user_id: '1001', agent_conversation_name: '新对话', create_time: T, update_time: T } },
  { method: 'PUT', test: /^\/(?:agentapi\/)?api\/agent\/conversation\/[^/]+\/name$/, data: null },
  { method: 'DELETE', test: /^\/(?:agentapi\/)?api\/agent\/conversation\/[^/]+$/, data: null },
  { method: 'GET', test: /^\/(?:agentapi\/)?api\/agent\/messages\/[^/]+$/, data: [
    { agent_message_id: 1, agent_conversation_id: 1, user_id: '1001', role: 'USER', content: '帮我看看这段两数之和的代码有没有问题。', create_time: '2026-10-15 08:58:00' },
    { agent_message_id: 2, agent_conversation_id: 1, user_id: '1001', role: 'ASSISTANT', content: '整体没问题，注意哈希表要先查再存，避免和自己配对。', create_time: '2026-10-15 08:59:00' },
    { agent_message_id: 3, agent_conversation_id: 1, user_id: '1001', role: 'USER', content: '时间复杂度还能再降吗？', create_time: '2026-10-15 09:00:00' },
  ] },
  { method: 'POST', test: /^\/(?:agentapi\/)?api\/agent\/call$/, data: { conversation_id: 1, content: '这段代码的时间复杂度是 O(n)。' } },
  // Agent 流式回答同样是 SSE，只兜住请求。
  { method: 'POST', test: /^\/(?:agentapi\/)?api\/agent\/stream$/, data: null },
]

/** 未命中任何规则时的兜底 data：宁可返回 null 也不返回会让页面崩溃的形状。 */
export const fallbackData = null
