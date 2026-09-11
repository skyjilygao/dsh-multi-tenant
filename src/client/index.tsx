/**
 * dsh-multi-tenant —— 浏览器半区。
 *
 * 贡献的官方座位：
 *  - shell.overlay：登录门（guard 武装且无有效令牌时全帧登录卡）；
 *  - settings.section：管理控制台（项目 / 用户 / 分配项目）；
 *  - sidebar.footer.action：身份徽标 + 退出。
 *
 * 普通用户受限模式（官方座位遮蔽语义：单一种类座位渲染最低优先级条目）：
 *  - sidebar.workspaces 遮蔽：只列出 cwd ∈ 用户成员工作区集合 的会话；
 *  - sidebar.settings 遮蔽：设置入口消失；
 *  - conversation.hero.workspace 遮蔽：只提供用户自己的工作区；
 *  - 外来当前会话守卫 + 登录后自动连接自己的工作区。
 */
import { useSyncExternalStore } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { AuthGateView, type AuthGateMode } from './auth-gate.tsx'
import { AdminSectionView } from './admin-section.tsx'
import {
  RestrictedPickerView,
  RestrictedSettingsView,
  RestrictedWorkspacesView,
  UserBadgeView,
  guardCurrentSession,
  useColdSessionTitles,
} from './restricted.tsx'
import { browserDeps, type WhoAmI } from './api.ts'
import { watchIdentity, type IdentityState } from './identity.ts'
import { zh, en } from './locales.ts'
import { ensureTenantStyles } from './sidebar-styles.ts'

/** 需要的服务（座位注册表、语言、会话打开、工作区）。 */
export const inject = ['slots', 'locale', 'sessions', 'workspaces']

interface IdentitySource {
  subscribe(fn: () => void): () => void
  get(): IdentityState
}

function useIdentity(source: IdentitySource): IdentityState {
  return useSyncExternalStore(source.subscribe, source.get)
}

function createIdentitySource(): { source: IdentitySource; stop(): void } {
  let state: IdentityState = { kind: 'resolving' }
  const listeners = new Set<() => void>()
  const userOf = (s: IdentityState): WhoAmI | undefined =>
    s.kind === 'user' || s.kind === 'admin' ? s.user : undefined
  const stop = watchIdentity(browserDeps, (next) => {
    const a = userOf(state)
    const b = userOf(next)
    if (next.kind === state.kind && a?.slug === b?.slug && a?.workspaces.length === b?.workspaces.length) return
    state = next
    for (const listener of [...listeners]) listener()
  })
  return {
    source: {
      subscribe(fn) {
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      },
      get: () => state,
    },
    stop,
  }
}

/** 挂载全部浏览器表面。 */
export function apply(ctx: ClientContext): void {
  ensureTenantStyles()
  ctx.effect(() => ctx.locale.register('multi-tenant', { zh, en }), 'multi-tenant: dictionaries')

  const identity = createIdentitySource()
  ctx.effect(() => identity.stop, 'multi-tenant: identity watcher')
  const source = identity.source

  const sessionsFace = (ctx as unknown as { sessions: { open(id: string): void; clear?(): void; list?: SessionsListFace } }).sessions
  interface SessionsListFace {
    getSnapshot?(): { byId: Record<string, { cwd?: string } | undefined>; current?: string }
    subscribe?(fn: () => void): () => void
  }
  const sessionsList = sessionsFace?.list

  /** 清除外来的当前会话选择。 */
  function guardForeignCurrentSession(user: WhoAmI): void {
    if (user.workspaces.length === 0) return
    const snapshot = typeof sessionsList?.getSnapshot === 'function' ? sessionsList.getSnapshot() : undefined
    if (!snapshot) return
    guardCurrentSession(snapshot, user.workspaces.map((w) => w.path), () => {
      sessionsFace.clear?.()
    })
  }

  function subscribeForeignGuard(user: WhoAmI): () => void {
    if (typeof sessionsList?.subscribe !== 'function') return () => {}
    return sessionsList.subscribe(() => guardForeignCurrentSession(user))
  }

  const workspacesFace = (ctx as unknown as {
    workspaces?: {
      list?: { getSnapshot?(): { items?: Array<{ workspaceId: string; path: string; title: string }> } }
      connectWorkspace?(workspaceId: string): Promise<string>
    }
  }).workspaces

  let autoConnectedFor: string | undefined

  /** 在指定工作区开始会话：复用该工作区的空会话，否则新建（宿主会话创建）。 */
  async function startSessionIn(workspaceId: string): Promise<void> {
    try {
      const sessionId = await workspacesFace?.connectWorkspace?.(workspaceId)
      if (sessionId !== undefined) sessionsFace.open(sessionId)
    } catch {
      /* best effort */
    }
  }

  /** 身份解析后自动接入用户的工作区（多项目时接第一个未连接的）。 */
  function autoConnectWorkspace(user: WhoAmI): void {
    if (user.workspaces.length === 0) return
    if (autoConnectedFor === user.slug) return
    autoConnectedFor = user.slug
    void (async () => {
      try {
        const snapshot = workspacesFace?.list?.getSnapshot?.()
        const mine = (snapshot?.items ?? []).filter((w) => user.workspaces.some((m) => m.path === w.path))
        if (mine.length === 0) return
        const currentId = sessionsList?.getSnapshot?.()?.current
        const currentCwd = currentId !== undefined ? sessionsList?.getSnapshot?.()?.byId?.[currentId]?.cwd : undefined
        if (currentCwd !== undefined && user.workspaces.some((m) => m.path === currentCwd)) return
        const sessionId = await workspacesFace?.connectWorkspace?.(mine[0]!.workspaceId)
        if (sessionId !== undefined) sessionsFace.open(sessionId)
      } catch {
        /* best effort */
      }
    })()
  }

  // ---- 常驻座位 -------------------------------------------------------------

  type GateProps = PropsRuntime<'shell.overlay'> & PropsLocale<'multi-tenant'>
  function AuthGateEntry(props: GateProps): React.ReactElement | null {
    const state = useIdentity(source)
    const mode: AuthGateMode =
      state.kind === 'resolving' ? 'checking' : state.kind === 'anonymous' ? 'form' : 'hidden'
    return <AuthGateView t={props.t} deps={browserDeps} mode={mode} />
  }

  type AdminProps = PropsRuntime<'settings.section'> & PropsLocale<'multi-tenant'>
  function AdminSectionEntry(props: AdminProps): React.ReactElement {
    return <AdminSectionView t={props.t} close={props.close} deps={browserDeps} />
  }

  type BadgeProps = PropsRuntime<'sidebar.footer.action'> & PropsLocale<'multi-tenant'>
  function UserBadgeEntry(props: BadgeProps): React.ReactElement | null {
    const state = useIdentity(source)
    if (state.kind !== 'user' && state.kind !== 'admin') return null
    return <UserBadgeView t={props.t} user={state.user} deps={browserDeps} />
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'multi-tenant-auth-gate', order: 0, locale: 'multi-tenant' },
    AuthGateEntry,
  ))

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'multi-tenant-admin',
      order: 200,
      locale: 'multi-tenant',
      label: () => ctx.locale.bind('multi-tenant')('section.title'),
    },
    AdminSectionEntry,
  ))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'multi-tenant-user-badge', order: 0, locale: 'multi-tenant' },
    UserBadgeEntry,
  ))

  // ---- 普通用户影子座位（动态注册/注销） ------------------------------------

  type WorkspacesProps = PropsRuntime<'sidebar.workspaces'> & PropsLocale<'multi-tenant'>
  function RestrictedWorkspacesEntry(props: WorkspacesProps): React.ReactElement | null {
    const state = useIdentity(source)
    const titles = useColdSessionTitles(state.kind === 'user' ? state.user : undefined, browserDeps)
    if (state.kind !== 'user') return null
    return (
      <RestrictedWorkspacesView
        t={props.t}
        wide={props.wide}
        useSessions={(selector) => props.useSessions(selector as never) as never}
        useWorkspaces={(selector) => props.useWorkspaces(selector as never) as never}
        openSession={(sessionId) => sessionsFace.open(sessionId)}
        newSession={(workspaceId) => startSessionIn(workspaceId)}
        user={state.user}
        titles={titles}
      />
    )
  }

  type SettingsProps = PropsRuntime<'sidebar.settings'> & PropsLocale<'multi-tenant'>
  function RestrictedSettingsEntry(_props: SettingsProps): React.ReactElement | null {
    return <RestrictedSettingsView />
  }

  type PickerProps = PropsRuntime<'conversation.hero.workspace'> & PropsLocale<'multi-tenant'>
  function RestrictedPickerEntry(props: PickerProps): React.ReactElement | null {
    const state = useIdentity(source)
    if (state.kind !== 'user') return null
    return (
      <RestrictedPickerView
        t={props.t}
        open={props.open}
        anchorRef={props.anchorRef}
        selectedId={props.selectedId === undefined ? undefined : String(props.selectedId)}
        onPick={(workspaceId) => props.onPick(workspaceId as never)}
        onClose={props.onClose}
        useWorkspaces={(selector) => props.useWorkspaces(selector as never) as never}
        user={state.user}
      />
    )
  }

  function shadowWhenUser(seat: keyof import('@deepseek-ai/dsh-client-ui-slots').SlotMap & string, onUser: () => () => void): void {
    ctx.slots.inject(seat, () => {
      let disposeShadow: (() => void) | undefined
      let disposeGuard: (() => void) | undefined
      const sync = (state: IdentityState): void => {
        if (state.kind === 'user') {
          guardForeignCurrentSession(state.user)
          autoConnectWorkspace(state.user)
          disposeGuard ??= subscribeForeignGuard(state.user)
          disposeShadow ??= onUser()
        } else {
          disposeShadow?.()
          disposeShadow = undefined
          disposeGuard?.()
          disposeGuard = undefined
        }
      }
      sync(source.get())
      const off = source.subscribe(() => sync(source.get()))
      return () => {
        off()
        disposeShadow?.()
        disposeShadow = undefined
        disposeGuard?.()
        disposeGuard = undefined
      }
    })
  }

  shadowWhenUser('sidebar.workspaces', () => ctx.slots.register(
    { name: 'sidebar.workspaces', priority: -10, locale: 'multi-tenant' },
    RestrictedWorkspacesEntry,
  ))
  shadowWhenUser('sidebar.settings', () => ctx.slots.register(
    { name: 'sidebar.settings', priority: -10, locale: 'multi-tenant' },
    RestrictedSettingsEntry,
  ))
  shadowWhenUser('conversation.hero.workspace', () => ctx.slots.register(
    { name: 'conversation.hero.workspace', priority: -10, locale: 'multi-tenant' },
    RestrictedPickerEntry,
  ))
}
