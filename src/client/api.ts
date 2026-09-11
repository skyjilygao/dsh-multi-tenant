/**
 * 浏览器侧 API 封装：/tenant/api 上的 fetch 包装、令牌存取、门禁决策与
 * 认证事件总线。全部环境依赖可注入（fetch/storage），便于单测。
 */

export interface FetchLike {
  (input: string, init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>
}

export interface TokenStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/** localStorage 令牌键。 */
export const TOKEN_KEY = 'dsh-multi-tenant-token'

export async function callApi(
  fetchLike: FetchLike,
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {},
): Promise<unknown> {
  const headers: Record<string, string> = {}
  let body: string | undefined
  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  const res = await fetchLike(path, { method: opts.method ?? 'GET', headers, body })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError(res.status, typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
  return json
}

export function readStoredToken(storage: TokenStorage): string | null {
  return storage.getItem(TOKEN_KEY)
}

export function writeStoredToken(storage: TokenStorage, token: string): void {
  storage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(storage: TokenStorage): void {
  storage.removeItem(TOKEN_KEY)
}

/** /whoami 与 /login 返回的用户投影。 */
export interface WhoAmI {
  slug: string
  name: string
  role: 'admin' | 'user'
  projects: Array<{ slug: string; name: string }>
  /** 该用户的全部成员工作区（cwd 桶）。 */
  workspaces: Array<{ projectSlug: string; path: string }>
}

export interface ClientDeps {
  fetch: FetchLike
  storage: TokenStorage
  reload(): void
}

export const browserDeps: ClientDeps = {
  fetch: (input, init) => globalThis.fetch(input, init),
  storage: globalThis.localStorage,
  reload: () => globalThis.location?.reload(),
}

/** 解析当前用户；无令牌或令牌失效返回 null。 */
export async function whoAmI(deps: ClientDeps): Promise<WhoAmI | null> {
  const token = readStoredToken(deps.storage)
  if (!token) return null
  try {
    const res = await callApi(deps.fetch, '/tenant/api/whoami', { token }) as { user?: WhoAmI }
    return res.user ?? null
  } catch {
    return null
  }
}

/** 登录：持久化令牌并广播认证事件。 */
export async function login(deps: ClientDeps, username: string, password: string): Promise<WhoAmI> {
  const res = await callApi(deps.fetch, '/tenant/api/login', {
    method: 'POST',
    body: { username, password },
  }) as { token: string; user: WhoAmI }
  writeStoredToken(deps.storage, res.token)
  authEvents.emit('changed')
  return res.user
}

/** 登出：清令牌 + 硬刷新（让门禁与受限座位重新装填）。 */
export function logout(deps: ClientDeps): void {
  clearStoredToken(deps.storage)
  authEvents.emit('changed')
  deps.reload()
}

class AuthEventBus {
  private readonly target = typeof EventTarget !== 'undefined' ? new EventTarget() : undefined
  private readonly handlers = new Set<() => void>()

  on(event: 'changed', handler: () => void): () => void {
    if (this.target) {
      this.target.addEventListener(event, handler)
      return () => this.target.removeEventListener(event, handler)
    }
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(event: 'changed'): void {
    if (this.target) {
      this.target.dispatchEvent(new Event(event))
    } else {
      for (const h of [...this.handlers]) h()
    }
  }
}

export const authEvents = new AuthEventBus()
