/**
 * 领域记录类型。纯类型 + 工厂，无运行时依赖。
 *
 * 与参考实现的关键差异：用户是**全局账号**（用户名全局唯一），通过
 * `projectSlugs: string[]` 与项目建立**多对多**关系（1~n 个项目）；
 * 每个成员关系（用户 × 项目）对应一个独立工作区。
 */

export interface ProjectRecord {
  slug: string
  name: string
  /** 项目真实工作区（自动创建或绑定的既有目录）。 */
  workspacePath: string
  createdAt: number
}

export interface UserRecord {
  slug: string
  name: string
  role: 'admin' | 'user'
  passwordHash: string
  status: 'active' | 'disabled'
  /** 所属项目 slug 列表（普通用户 1~n 个；管理员为空）。 */
  projectSlugs: string[]
  /** 每个成员关系一个工作区：`<projectSlug> -> 绝对路径`。管理员为空。 */
  workspaces: Record<string, string>
  createdAt: number
}

export interface TokenRecord {
  /** Bearer 令牌的 sha256 指纹 —— 落盘的唯一形态。 */
  fingerprint: string
  userSlug: string
  createdAt: number
  expiresAt: number
  revoked: boolean
}

/** 逻辑表名。 */
export type RepoTable = 'projects' | 'users' | 'tokens'
