/**
 * 客户端身份控制器：共享解析"这个浏览器是谁"（guard 探测 + 存储令牌 +
 * /whoami），驱动所有受限座位。失败一律 fail-open —— 插件 API 挂了绝不
 * 拖累原生客户端。
 */
import { authEvents, readStoredToken, type ClientDeps, type WhoAmI } from './api.ts'

export type IdentityState =
  | { kind: 'resolving' }
  | { kind: 'user'; user: WhoAmI }
  | { kind: 'admin'; user: WhoAmI }
  | { kind: 'anonymous' }
  | { kind: 'guard-off' }

/** 解析一次：guard 探测 → 令牌 → /whoami 角色。 */
export async function resolveIdentity(deps: ClientDeps): Promise<IdentityState> {
  let guardEnabled = false
  try {
    const res = await deps.fetch('/tenant/api/guard-status', { method: 'GET' })
    const json = (await res.json().catch(() => ({}))) as { guardEnabled?: boolean }
    guardEnabled = res.ok && json.guardEnabled === true
  } catch {
    return { kind: 'guard-off' }
  }
  if (!guardEnabled) return { kind: 'guard-off' }
  const token = readStoredToken(deps.storage)
  if (token === null) return { kind: 'anonymous' }
  try {
    const res = await deps.fetch('/tenant/api/whoami', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { kind: 'anonymous' }
    const json = (await res.json()) as { user?: WhoAmI }
    const user = json.user
    if (!user || (user.role !== 'user' && user.role !== 'admin')) return { kind: 'anonymous' }
    return user.role === 'admin' ? { kind: 'admin', user } : { kind: 'user', user }
  } catch {
    return { kind: 'anonymous' }
  }
}

/** 只有普通用户获得受限 UI。 */
export function shouldRestrictUi(state: IdentityState): boolean {
  return state.kind === 'user'
}

/** 跨认证变更监听身份；返回清理函数。 */
export function watchIdentity(deps: ClientDeps, publish: (state: IdentityState) => void): () => void {
  let disposed = false
  publish({ kind: 'resolving' })
  const rerun = (): void => {
    void resolveIdentity(deps).then((state) => {
      if (!disposed) publish(state)
    })
  }
  rerun()
  const off = authEvents.on('changed', rerun)
  return () => {
    disposed = true
    off()
  }
}
