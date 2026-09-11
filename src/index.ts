/**
 * dsh-multi-tenant —— DSH 多租户插件（宿主半区）。
 *
 * 功能：
 *  - 项目 ↔ 用户多对多；默认管理员 admin/admin（仅存储为空时种子）；
 *  - 管理员经 Web 控制台新增用户并分配 1~n 个项目；
 *  - 每个成员关系（用户 × 项目）一个成员工作区（项目目录的符号链接视图），
 *    会话按 cwd 桶隔离 —— 用户只能看到自己工作区里的会话；
 *  - JSON API 挂在 /tenant/api；浏览器半区（lib/client.js）挂登录门、
 *    管理控制台与受限侧边栏。
 *
 * 零运行时依赖：存储用 JSON 文件（~/.dsh/dsh-multi-tenant/state.json），
 * cordis / dsh 内核服务全部走结构化类型（structural typing）。
 */
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { TenantService } from './service.ts'
import { JsonFileRepo } from './repo.ts'
import { NodeFsPort } from './fs-port.ts'
import { createTenantApi, type ApiRequest, type ApiResponse, type SessionLister } from './http.ts'
import type { UserRecord } from './records.ts'
import { applyTitleFold, type TitleFoldObservation } from './title-fold.ts'

/** 插件 id（与 cordis.patch.yml 的行一致）。 */
export const name = 'multi-tenant'

/** webserver 承载全部路由。 */
export const inject = ['webServer']

/** 插件配置（cordis.patch.yml 的 config 行；用户可用同 id patch 覆盖）。 */
export interface Config {
  /** 工作区根目录。 */
  workspaceRoot: string
  /** 引导管理员密码（默认 admin）。 */
  adminPassword: string
  /** Bearer 令牌有效期（小时）。 */
  tokenTtlHours: number
  /** 武装浏览器登录门。 */
  guardEnabled: boolean
  /** 追加到成员工作区 AGENTS.md 的额外守则。 */
  agentsRules: string[]
}

function readConfig(raw: Partial<Config> | undefined): Config {
  return {
    workspaceRoot: raw?.workspaceRoot || join(homedir(), '.dsh', 'multi-tenant-ws'),
    adminPassword: raw?.adminPassword || 'admin',
    tokenTtlHours: Number(raw?.tokenTtlHours) > 0 ? Number(raw?.tokenTtlHours) : 72,
    guardEnabled: raw?.guardEnabled !== false,
    agentsRules: Array.isArray(raw?.agentsRules) ? raw.agentsRules : [],
  }
}

/** 持久标题折叠：把持久日志里的标题折进列表行（冷会话也有真实标题）。 */
function foldTitles(rows: Array<Record<string, unknown>>, observations: readonly TitleFoldObservation[]): Array<Record<string, unknown>> {
  return applyTitleFold(
    rows.map((r) => ({ id: String(r.id), ...(typeof r.title === 'string' ? { title: r.title } : {}) })),
    observations,
  )
}

/** 组装插件。 */
export function apply(ctx: Context, rawConfig?: Partial<Config>): void {
  const cfg = readConfig(rawConfig)
  let current: () => Config = () => cfg
  let service: TenantService | undefined
  let sessionLister: SessionLister | undefined
  /** 工作区注册嵌套插件存活时；管理端变更后重新同步。 */
  let syncWorkspaces: (() => Promise<void>) | undefined

  const boot = (): void => {
    void (async () => {
      try {
        service = new TenantService({
          repo: new JsonFileRepo(join(homedir(), '.dsh', 'dsh-multi-tenant', 'state.json')),
          fs: NodeFsPort,
          now: () => Date.now(),
          root: resolve(current().workspaceRoot),
          tokenTtlMs: current().tokenTtlHours * 3_600_000,
          adminPassword: current().adminPassword,
          agentsRules: current().agentsRules,
        })
        await service.init()
        ctx.logger.info('multi-tenant: 就绪（root=%s, guard=%s）', resolve(current().workspaceRoot), current().guardEnabled)
      } catch (error) {
        ctx.logger.error('multi-tenant: 初始化失败（%s）', String(error))
      }
    })()
  }
  boot()

  // ---- 会话列表桥（可选依赖 sessionQuery） ---------------------------------
  ctx.plugin({
    name: 'multi-tenant.sessions',
    inject: ['sessionQuery'],
    apply(sctx) {
      sessionLister = async (cwds) => {
        const sq = (sctx as unknown as {
          sessionQuery: {
            filterSessions(specs: ReadonlyArray<{ kind: 'cwd'; values: readonly string[] }>): Promise<Array<Record<string, unknown>>>
            readTitleSnapshots?(ids: readonly string[]): Promise<readonly TitleFoldObservation[]>
          }
        }).sessionQuery
        const rows = await sq.filterSessions([{ kind: 'cwd', values: cwds }])
        const base = rows
          .filter((r) => (r as { origin?: string }).origin !== 'subagent')
          .map((r) => {
            const header = (r as { header?: { cwd?: string } }).header ?? {}
            return {
              id: String((r as { header?: { id?: string } }).header?.id ?? ''),
              cwd: header.cwd,
              title: (r as { header?: { title?: string } }).header?.title,
            }
          })
          .filter((r) => r.id !== '')
        if (base.length === 0) return []
        try {
          const fold = sq.readTitleSnapshots
          if (!fold) return base
          return foldTitles(base, await fold.call(sq, base.map((r) => r.id)))
        } catch {
          return base
        }
      }
    },
  })

  // ---- 工作区注册（可选依赖 workspaceRegistry） ----------------------------
  ctx.plugin({
    name: 'multi-tenant.workspaces',
    inject: ['workspaceRegistry'],
    apply(sctx) {
      const registry = (sctx as unknown as {
        workspaceRegistry: { create(path: string, title?: string): Promise<unknown> }
      }).workspaceRegistry
      const registerAll = async (): Promise<void> => {
        const svc = service
        if (!svc) return
        const [users, projects] = await Promise.all([svc.listUsers(), svc.listProjects()])
        const nameOf = new Map(projects.map((p) => [p.slug, p.name]))
        for (const u of users) {
          for (const w of u.workspaces) {
            try {
              // 工作区标题 = 项目名（每个用户只见自己的工作区，无需用户名消歧）
              await registry.create(w.path, nameOf.get(w.projectSlug) ?? w.projectSlug)
            } catch {
              /* 已注册或目录异常：逐条忽略 */
            }
          }
        }
      }
      // 服务就绪后先注册一轮；管理端变更后由 syncWorkspaces 幂等补注册。
      const timer = setInterval(() => {
        if (service) {
          void registerAll()
          clearInterval(timer)
        }
      }, 1_000)
      sctx.effect(() => () => clearInterval(timer))
      syncWorkspaces = registerAll
    },
  })

  // ---- 路由 ---------------------------------------------------------------

  const readBody = (req: { on(event: string, cb: (c: Buffer) => void): void }): Promise<Record<string, unknown>> =>
    new Promise((resolveBody) => {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8')
          resolveBody(raw ? (JSON.parse(raw) as Record<string, unknown>) : {})
        } catch {
          resolveBody({})
        }
      })
    })

  const writeJson = (
    res: { writeHead(status: number, headers: Record<string, string>): void; end(body: string): void },
    response: ApiResponse,
  ): void => {
    res.writeHead(response.status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(response.json ?? {}))
  }

  const tokenOf = (header: string | undefined): string | undefined => {
    if (!header?.startsWith('Bearer ')) return undefined
    const t = header.slice(7).trim()
    return t.length > 0 ? t : undefined
  }

  type WireReq = {
    url?: string
    method?: string
    headers: { authorization?: string }
    on(event: string, cb: (c: Buffer) => void): void
  }

  ctx.webServer.register({
    kind: 'prefix',
    path: '/tenant/api',
    handler: async (req: unknown, res: unknown) => {
      const wreq = req as WireReq
      const wres = res as { writeHead(s: number, h: Record<string, string>): void; end(b: string): void }
      try {
        if (!service) {
          writeJson(wres, { status: 503, json: { error: '初始化中，请稍后重试' } })
          return
        }
        const url = new URL(wreq.url ?? '/', 'http://local')
        const path = url.pathname.replace(/^\/tenant\/api/, '') || '/'
        if (path === '/guard-status') {
          writeJson(wres, { status: 200, json: { guardEnabled: current().guardEnabled } })
          return
        }
        const api = createTenantApi({ service, sessionLister })
        const response = await api({
          method: wreq.method ?? 'GET',
          path,
          body: wreq.method === 'POST' ? await readBody(wreq) : undefined,
          token: tokenOf(wreq.headers.authorization),
        } satisfies ApiRequest)
        writeJson(wres, response)
        // 管理端变更可能新建了成员工作区 —— 后台幂等补注册。
        if (response.status < 400 && wreq.method === 'POST' && path.startsWith('/admin/')) {
          void syncWorkspaces?.()
        }
      } catch (err) {
        try {
          writeJson(wres, { status: 500, json: { error: err instanceof Error ? err.message : String(err) } })
        } catch {
          /* headers already sent */
        }
      }
    },
  })

  // ---- 生命周期钩子（给单测/热重载用） --------------------------------------
  ctx.effect?.(() => () => {
    service = undefined
    sessionLister = undefined
    syncWorkspaces = undefined
  })
}

/** 重新导出，便于测试与类型引用。 */
export type { UserRecord }
