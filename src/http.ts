/**
 * 传输无关的 API 分发器。webServer 路由把 node req/res 适配成
 * ApiRequest/ApiResponse；这里保持纯函数、可单测。
 *
 * 会话隔离：/my/sessions 只返回当前令牌用户各成员工作区（cwd 桶）内的会话。
 */
import type { TenantService } from './service.ts'

export interface ApiRequest {
  method: string
  path: string
  body?: Record<string, unknown>
  token?: string
}

export interface ApiResponse {
  status: number
  json?: unknown
}

/** 对 ctx.sessionQuery.filterSessions 的桥接（cwd 多值桶）。 */
export type SessionLister = (cwds: readonly string[]) => Promise<Array<Record<string, unknown>>>

export interface ApiDeps {
  service: TenantService
  sessionLister?: SessionLister
}

function json(status: number, body: unknown): ApiResponse {
  return { status, json: body }
}

function fail(status: number, error: string): ApiResponse {
  return { status, json: { error } }
}

interface Auth {
  role: 'admin' | 'user'
  slug: string
  name: string
  cwds: string[]
}

interface Route {
  method: string
  pattern: RegExp
  user?: boolean
  admin?: boolean
  handler(m: RegExpMatchArray, req: ApiRequest, deps: ApiDeps, auth: Auth): Promise<ApiResponse>
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

const routes: Route[] = [
  {
    method: 'POST',
    pattern: /^\/login$/,
    async handler(_m, req, deps) {
      const username = str(req.body?.username)
      const password = str(req.body?.password)
      if (!username || !password) return fail(400, 'username 与 password 必填')
      try {
        return json(200, await deps.service.login(username, password))
      } catch (e) {
        return fail(401, (e as Error).message)
      }
    },
  },
  {
    method: 'GET',
    pattern: /^\/whoami$/,
    user: true,
    async handler(_m, _req, deps, auth) {
      const users = await deps.service.listUsers()
      const me = users.find((u) => u.slug === auth.slug)
      return json(200, {
        user: {
          slug: auth.slug,
          name: auth.name,
          role: auth.role,
          projects: me?.projects ?? [],
          workspaces: me?.workspaces ?? [],
        },
      })
    },
  },
  {
    method: 'GET',
    pattern: /^\/my\/sessions$/,
    user: true,
    async handler(_m, _req, _deps, auth) {
      if (auth.cwds.length === 0) return json(200, { sessions: [] })
      const lister = _deps.sessionLister
      if (!lister) return fail(501, 'sessionQuery 不可用')
      try {
        return json(200, { sessions: await lister(auth.cwds) })
      } catch (e) {
        return fail(500, (e as Error).message)
      }
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/overview$/,
    admin: true,
    async handler(_m, _req, deps) {
      return json(200, {
        projects: await deps.service.listProjects(),
        users: await deps.service.listUsers(),
      })
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/projects$/,
    admin: true,
    async handler(_m, req, deps) {
      const name = str(req.body?.name)
      const workspacePath = str(req.body?.workspacePath)
      if (!name) return fail(400, 'name 必填')
      try {
        const project = await deps.service.createProject(name, workspacePath || undefined)
        return json(201, { project })
      } catch (e) {
        return fail(409, (e as Error).message)
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/users$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username)
      const password = str(req.body?.password)
      const projects = strList(req.body?.projects)
      if (!username || !password) return fail(400, 'username/password 必填')
      if (projects.length < 1) return fail(400, '至少分配 1 个项目')
      try {
        return json(201, { user: await deps.service.createUser(username, password, projects) })
      } catch (e) {
        return fail(409, (e as Error).message)
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/users\/assign$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username)
      const projects = strList(req.body?.projects)
      if (!username) return fail(400, 'username 必填')
      if (projects.length < 1) return fail(400, '至少分配 1 个项目')
      try {
        return json(200, { user: await deps.service.assignProjects(username, projects) })
      } catch (e) {
        return fail(409, (e as Error).message)
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/users\/password$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username)
      const password = str(req.body?.password)
      if (!username || !password) return fail(400, 'username/password 必填')
      try {
        await deps.service.setPassword(username, password)
        return json(200, { ok: true })
      } catch (e) {
        return fail(409, (e as Error).message)
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/users\/status$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username)
      const status = str(req.body?.status)
      if (!username) return fail(400, 'username 必填')
      if (status !== 'active' && status !== 'disabled') return fail(400, 'status 必须是 active|disabled')
      try {
        await deps.service.setStatus(username, status)
        return json(200, { ok: true })
      } catch (e) {
        return fail(409, (e as Error).message)
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/sync$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username)
      const project = str(req.body?.project)
      if (!username || !project) return fail(400, 'username/project 必填')
      try {
        await deps.service.syncMembership(username, project)
        return json(200, { ok: true })
      } catch (e) {
        return fail(404, (e as Error).message)
      }
    },
  },
]

/** 构建纯 API 分发器。 */
export function createTenantApi(deps: ApiDeps): (req: ApiRequest) => Promise<ApiResponse> {
  return async (req) => {
    const route = routes.find((r) => r.pattern.test(req.path) && r.method === req.method)
    if (!route) {
      const pathHit = routes.find((r) => r.pattern.test(req.path))
      if (pathHit) return fail(405, 'method not allowed')
      return fail(404, 'not found')
    }
    let auth: Auth | undefined
    if (route.user || route.admin) {
      if (!req.token) return fail(401, 'missing token')
      let u
      try {
        u = await deps.service.authenticate(req.token)
      } catch (e) {
        return fail(401, (e as Error).message)
      }
      auth = {
        role: u.role,
        slug: u.slug,
        name: u.name,
        cwds: Object.values(u.workspaces),
      }
      if (route.admin && auth.role !== 'admin') return fail(403, '需要管理员')
    }
    const m = req.path.match(route.pattern)!
    return route.handler(m, req, deps, auth ?? { role: 'user', slug: '', name: '', cwds: [] })
  }
}
