/**
 * TenantService：领域核心。纯编排（Repo/FsPort/时钟全部注入），可单测。
 *
 * 模型：
 *  - 用户是全局账号（用户名全局唯一），role = admin | user；
 *  - 用户与项目**多对多**：user.projectSlugs（普通用户 1~n 个）；
 *  - 每个成员关系（用户 × 项目）一个成员工作区 `<root>/<project>-<user>`，
 *    条目是指向项目工作区的符号链接 ⇒ 会话按 cwd 桶隔离；
 *  - 默认管理员 admin（密码取配置，仅用户存储为空时种子）。
 *
 * 威胁模型：防君子不防小人。真正的硬边界在 DSH 前面的隧道/反代层。
 */
import { hashPassword, verifyPassword, newToken, tokenFingerprint } from './crypto.ts'
import { slug } from './slug.ts'
import { isAbsolute, resolve } from 'node:path'
import { projectWorkspacePath, planMembership } from './paths.ts'
import { renderAgentsMd } from './agents-md.ts'
import type { Repo } from './repo.ts'
import type { FsPort } from './fs-port.ts'
import type { ProjectRecord, TokenRecord, UserRecord } from './records.ts'

/** 注入的端口与参数。 */
export interface ServiceDeps {
  repo: Repo
  fs: FsPort
  now(): number
  /** 所有项目/成员工作区的根目录。 */
  root: string
  tokenTtlMs: number
  /** 引导管理员密码，仅用户存储为空时生效。 */
  adminPassword?: string
  /** 追加到每个成员工作区 AGENTS.md 的额外守则。 */
  agentsRules?: readonly string[]
}

/** 登录结果（令牌只显示一次）。 */
export interface LoginSession {
  token: string
  user: PublicUser
}

export interface PublicProject {
  slug: string
  name: string
  workspacePath: string
}

export interface PublicWorkspace {
  projectSlug: string
  path: string
}

/** 用户投影（不含口令散列）。 */
export interface PublicUser {
  slug: string
  name: string
  role: 'admin' | 'user'
  status: 'active' | 'disabled'
  projectSlugs: string[]
  projects: PublicProject[]
  /** 成员工作区列表（多对多 ⇒ 1~n 个；管理员为空）。 */
  workspaces: PublicWorkspace[]
  createdAt: number
}

function publicUser(u: UserRecord, projects: ProjectRecord[]): PublicUser {
  const byslug = new Map(projects.map((p) => [p.slug, p]))
  return {
    slug: u.slug,
    name: u.name,
    role: u.role,
    status: u.status,
    projectSlugs: [...u.projectSlugs],
    projects: u.projectSlugs
      .map((s) => byslug.get(s))
      .filter((p): p is ProjectRecord => p !== undefined)
      .map((p) => ({ slug: p.slug, name: p.name, workspacePath: p.workspacePath })),
    workspaces: u.projectSlugs
      .map((s) => byslug.get(s))
      .filter((p): p is ProjectRecord => p !== undefined)
      .map((p) => ({ projectSlug: p.slug, path: u.workspaces[p.slug] ?? '' }))
      .filter((w) => w.path !== ''),
    createdAt: u.createdAt,
  }
}

export class TenantService {
  private readonly deps: ServiceDeps
  constructor(deps: ServiceDeps) {
    this.deps = deps
  }

  /** 种子引导管理员。幂等。 */
  async init(): Promise<void> {
    const users = await this.deps.repo.list('users')
    if (users.length === 0 && this.deps.adminPassword) {
      await this.deps.repo.put('users', 'admin', {
        slug: 'admin',
        name: 'admin',
        role: 'admin',
        passwordHash: hashPassword(this.deps.adminPassword),
        status: 'active',
        projectSlugs: [],
        workspaces: {},
        createdAt: this.deps.now(),
      } satisfies UserRecord)
    }
  }

  // ------------------------------------------------------------ 项目

  /** 创建项目；工作区自动创建，或绑定既有目录（绝对路径）。 */
  async createProject(name: string, workspacePath?: string): Promise<ProjectRecord> {
    const s = slug(name)
    if (await this.deps.repo.get('projects', s)) throw new Error(`项目 ${s} 已存在`)
    let wsPath: string
    if (workspacePath !== undefined && workspacePath !== '') {
      if (!isAbsolute(workspacePath)) throw new Error('绑定的工作区路径必须是绝对路径')
      wsPath = resolve(workspacePath)
      if (!(await this.deps.fs.exists(wsPath))) throw new Error(`绑定的工作区目录不存在: ${wsPath}`)
    } else {
      wsPath = projectWorkspacePath(this.deps.root, name)
      await this.deps.fs.mkdir(wsPath)
    }
    const record: ProjectRecord = { slug: s, name, workspacePath: wsPath, createdAt: this.deps.now() }
    await this.deps.repo.put('projects', s, record)
    return record
  }

  async listProjects(): Promise<ProjectRecord[]> {
    const rows = await this.deps.repo.list('projects')
    return rows.map(([, v]) => v as ProjectRecord).sort((a, b) => a.slug.localeCompare(b.slug))
  }

  // ------------------------------------------------------------ 用户

  private async getUser(userSlug: string): Promise<UserRecord> {
    const u = (await this.deps.repo.get('users', userSlug)) as UserRecord | undefined
    if (!u) throw new Error('用户不存在')
    return u
  }

  private async allProjects(): Promise<ProjectRecord[]> {
    return this.listProjects()
  }

  /** 建立成员工作区（幂等：已存在的链接跳过）。 */
  private async ensureMembership(user: UserRecord, project: ProjectRecord): Promise<string> {
    const existing = user.workspaces[project.slug]
    if (existing) return existing
    const entries = await this.deps.fs.readdir(project.workspacePath).catch(() => [] as string[])
    const plan = planMembership(project.workspacePath, user.name, entries, ['AGENTS.md'])
    await this.deps.fs.mkdir(plan.membershipWorkspacePath)
    for (const link of plan.symlinks) {
      if (await this.deps.fs.exists(link.linkPath)) continue
      try {
        await this.deps.fs.symlink(link.targetPath, link.linkPath)
      } catch {
        // Windows 无符号链接权限等场景：跳过该条目（成员工作区仍可用）
      }
    }
    await this.deps.fs.writeFile(
      `${plan.membershipWorkspacePath}/AGENTS.md`,
      renderAgentsMd({ userName: user.name, projectName: project.name, customRules: this.deps.agentsRules }),
    )
    user.workspaces[project.slug] = plan.membershipWorkspacePath
    return plan.membershipWorkspacePath
  }

  /**
   * 新增用户并分配项目（多对多核心入口）。projects 必须是 1~n 个已存在项目。
   */
  async createUser(username: string, password: string, projectSlugs: readonly string[]): Promise<PublicUser> {
    const name = username.trim()
    if (!name) throw new Error('用户名不能为空')
    if (!password) throw new Error('密码不能为空')
    if (projectSlugs.length < 1) throw new Error('至少分配 1 个项目')
    const userSlug = slug(name)
    if (await this.deps.repo.get('users', userSlug)) throw new Error(`用户名重名：${name} 已存在`)
    const projects = await this.allProjects()
    const chosen = projectSlugs.map((s) => {
      const p = projects.find((x) => x.slug === slug(s))
      if (!p) throw new Error(`项目 ${s} 不存在`)
      return p
    })
    const user: UserRecord = {
      slug: userSlug,
      name,
      role: 'user',
      passwordHash: hashPassword(password),
      status: 'active',
      projectSlugs: chosen.map((p) => p.slug),
      workspaces: {},
      createdAt: this.deps.now(),
    }
    for (const p of chosen) await this.ensureMembership(user, p)
    await this.deps.repo.put('users', userSlug, user)
    return publicUser(user, projects)
  }

  /** 重新指派用户的 1~n 个项目（多对多编辑）。 */
  async assignProjects(username: string, projectSlugs: readonly string[]): Promise<PublicUser> {
    if (projectSlugs.length < 1) throw new Error('至少分配 1 个项目')
    const user = await this.getUser(slug(username))
    const projects = await this.allProjects()
    const chosen = projectSlugs.map((s) => {
      const p = projects.find((x) => x.slug === slug(s))
      if (!p) throw new Error(`项目 ${s} 不存在`)
      return p
    })
    user.projectSlugs = chosen.map((p) => p.slug)
    for (const p of chosen) await this.ensureMembership(user, p)
    // 被移除的项目：工作区保留在磁盘上但不再注册/不再属于该用户视图
    await this.deps.repo.put('users', user.slug, user)
    return publicUser(user, projects)
  }

  /** 重置用户密码。 */
  async setPassword(username: string, password: string): Promise<void> {
    if (!password) throw new Error('密码不能为空')
    const user = await this.getUser(slug(username))
    if (user.role === 'admin') throw new Error('不能修改管理员密码')
    user.passwordHash = hashPassword(password)
    await this.deps.repo.put('users', user.slug, user)
  }

  async setStatus(username: string, status: 'active' | 'disabled'): Promise<void> {
    const user = await this.getUser(slug(username))
    if (user.role === 'admin') throw new Error('不能变更管理员状态')
    user.status = status
    await this.deps.repo.put('users', user.slug, user)
  }

  async listUsers(): Promise<PublicUser[]> {
    const [rows, projects] = await Promise.all([this.deps.repo.list('users'), this.allProjects()])
    return rows
      .map(([, v]) => v as UserRecord)
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((u) => publicUser(u, projects))
  }

  // ------------------------------------------------------------ 认证

  /** 校验凭据并铸造 Bearer 令牌。 */
  async login(username: string, password: string): Promise<LoginSession> {
    const user = (await this.deps.repo.get('users', slug(username))) as UserRecord | undefined
    if (!user || !verifyPassword(password, user.passwordHash)) throw new Error('用户名或密码错误')
    if (user.status === 'disabled') throw new Error('用户已被禁用')
    const token = newToken()
    const record: TokenRecord = {
      fingerprint: tokenFingerprint(token),
      userSlug: user.slug,
      createdAt: this.deps.now(),
      expiresAt: this.deps.now() + this.deps.tokenTtlMs,
      revoked: false,
    }
    await this.deps.repo.put('tokens', record.fingerprint, record)
    return { token, user: publicUser(user, await this.allProjects()) }
  }

  /** Bearer 令牌 → 活跃用户；任何失败都抛错。 */
  async authenticate(token: string): Promise<UserRecord> {
    const record = (await this.deps.repo.get('tokens', tokenFingerprint(token))) as TokenRecord | undefined
    if (!record || record.revoked) throw new Error('token 无效')
    if (record.expiresAt <= this.deps.now()) throw new Error('token 已过期')
    const user = (await this.deps.repo.get('users', record.userSlug)) as UserRecord | undefined
    if (!user) throw new Error('token 指向的用户不存在')
    if (user.status === 'disabled') throw new Error('用户已被禁用')
    return user
  }

  /** 幂等重建某个成员工作区的符号链接与 AGENTS.md（项目新增文件后调用）。 */
  async syncMembership(username: string, projectSlug: string): Promise<void> {
    const user = await this.getUser(slug(username))
    const project = (await this.deps.repo.get('projects', slug(projectSlug))) as ProjectRecord | undefined
    if (!project) throw new Error('项目不存在')
    user.workspaces[project.slug] = '' // 强制重建
    delete user.workspaces[project.slug]
    await this.ensureMembership(user, project)
    await this.deps.repo.put('users', user.slug, user)
  }
}
