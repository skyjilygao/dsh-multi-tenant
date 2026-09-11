# dsh-multi-tenant

DeepSeek Harness（DSH）多租户管理插件 —— 项目与用户**多对多**，默认管理员
`admin / admin`，管理员在 Web 控制台新增用户并分配 **1~n 个项目**；每个用户
只能看到**自己**的会话（即使与其他用户同属一个项目）。

## 安装

```sh
# 从 GitHub（发布仓库自带构建产物，无需本地构建）
dsh plugin --profile web add github:<your-name>/dsh-multi-tenant

# 或从本地目录开发安装
dsh plugin --profile web add C:\path\to\dsh-multi-tenant
```

重启 DSH（`dsh --profile web`），日志出现
`multi-tenant: 就绪（root=…, guard=true）` 即安装成功。
`dsh plugin add` 会自动把插件加入 profile 的 `dsh.profile.bundles` 清单。

## 功能

| 需求 | 实现 |
| --- | --- |
| 项目与用户多对多 | 用户全局账号，`projectSlugs` 指向 1~n 个项目；`user_projects` 语义落在成员工作区上 |
| 默认管理员 admin/admin | 用户存储为空时自动种子；密码可经 cordis.patch.yml 覆盖（`adminPassword`） |
| admin 新增用户并分配项目 | Web 设置页「多租户：项目与用户」控制台：建项目、建用户（勾选 ≥1 个项目，0 个会被拒绝）、改派项目、重置密码、禁用/启用 |
| 会话隔离 | 每个成员关系（用户 × 项目）一个**成员工作区** `<root>/<project>-<user>`（项目目录的符号链接视图 + AGENTS.md 守则），会话按 cwd 桶隔离；侧边栏由客户端影子座位过滤为 `cwd ∈ 用户自己的工作区集合`，host 侧 `/tenant/api/my/sessions` 亦按同一集合过滤 |
| 工作区式侧边栏 | 普通用户与 admin 同构：左侧为「工作区」列表，**每个项目一行**（文件夹图标 + 项目名，当前会话所在项目高亮），会话挂在各自项目行下；样式走 DSH 主题令牌 + 官方图标原语，浅色/深色主题自动跟随，项目行 hover 出现「新会话」按钮 |

## 配置（cordis.patch.yml 覆盖）

```yaml
- id: multi-tenant
  name: 'dsh-multi-tenant'
  config:
    adminPassword: 'admin'      # 引导管理员密码
    guardEnabled: true          # 武装登录门（关掉则原生 UI 直接放行）
    tokenTtlHours: 72           # Bearer 令牌有效期
    agentsRules: []             # 追加到成员工作区 AGENTS.md 的额外守则
```

## API（/tenant/api）

```
POST /login                    {username, password} → {token, user}
GET  /whoami                   → 当前用户（项目 + 成员工作区）
GET  /my/sessions              → 仅当前用户 cwd 桶内的会话
POST /admin/projects           {name, workspacePath?}      （admin）
POST /admin/users              {username, password, projects[]} （admin，≥1 个项目）
POST /admin/users/assign       {username, projects[]}      （admin，改派）
POST /admin/users/password     {username, password}        （admin，重置密码）
POST /admin/users/status       {username, active|disabled} （admin）
POST /admin/sync               {username, project}         （admin，重建链接）
GET  /guard-status             登录门探测（fail-open）
```

## 威胁模型

防君子不防小人：cwd 过滤是查询投影、浏览器令牌可被技术用户伪造、
Agent 层隔离是提示词级软约束。对外暴露请在前置反代/隧道层加真正的认证。

## 开发

```sh
npm install          # esbuild / typescript / react 类型
npm run build        # 产出 lib/index.js（宿主）+ lib/client.js（浏览器）
npm test             # node --test 单测（9 项）
node test/e2e-live.mjs http://127.0.0.1:8000   # 对运行中的 DSH 做 18 项端到端验证
# 浏览器端隔离回归（需要 playwright-core + 本机 Edge/Chrome）：
#   先 node test/seed.mjs 造数据（项目 aa/bb，用户 t1→aa、t2→aa+bb）
PLAYWRIGHT_CORE=<playwright-core/index.js> \
TENANT_USER=t2 TENANT_PASS=t2pass EXPECT_PROJECTS=aa,bb \
node test/ui-check.mjs
```

> 受限座位（影子覆盖）一旦渲染崩溃，slot 错误边界会把它 abdicate，原生
> WorkspaceBrowser 顶上，用户就会看到别人工作区。改动 `src/client/restricted.tsx`
> 后务必跑一次 `test/ui-check.mjs`。注意别让局部变量遮蔽模块级的样式常量
> （`style={常量}` 变成传字符串会触发 React #62）。

结构：`src/` 宿主半区（service / http / repo / workspace）+ `src/client/`
浏览器半区（登录门 / 管理台 / 受限侧边栏，React slots）。零运行时依赖。

数据与重置：状态存于 `~/.dsh/dsh-multi-tenant/state.json`，工作区在
`~/.dsh/multi-tenant-ws/`。删除这两者即可重置（先停 dsh）。
