/**
 * 普通用户的受限座位（影子覆盖原生条目，单一种类座位渲染最低优先级者）：
 *  - sidebar.workspaces：**按工作区（= 项目）分组的会话列表**，与原生
 *    WorkspaceBrowser 同构同观感 —— 每个项目一行、其会话挂在行下；
 *    只列 cwd ∈ 用户成员工作区集合 的会话（会话隔离）；
 *  - sidebar.settings：渲染 null —— 设置入口消失；
 *  - conversation.hero.workspace：只提供用户自己的工作区。
 *
 * 注意：样式类名统一取自 MT（sidebar-styles.ts），不要在组件里用同名局部
 * 变量遮蔽（历史 bug：局部 `projectName` 字符串遮蔽了同名样式常量，导致
 * style 收到字符串 → React #62 → 座位被 abdicate → 原生列表顶上泄数据）。
 */
import type { RefObject } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { callApi, logout, readStoredToken, type ClientDeps, type WhoAmI } from './api.ts'
import type { TenantLocaleKey } from './locales.ts'
import { MT, cx } from './sidebar-styles.ts'
import { ArrowIcon, FolderIcon, PlusIcon } from './icons.tsx'

export type Translate = (key: TenantLocaleKey) => string

export interface SessionsState {
  ids: readonly string[]
  byId: Record<string, SessionRow | undefined>
  current?: string
}

export interface SessionRow {
  id: string
  displayTitle: string
  title?: string
  cwd?: string
  running?: boolean
  blank?: boolean
  origin?: 'subagent'
}

/** 宿主工作区投影（dsh-client-runtime 的 WorkspaceRuntime.list）。 */
export interface WorkspaceItem {
  workspaceId: string
  path: string
  title: string
  sessionIds?: readonly string[]
  createdAt?: string
}

export interface WorkspacesState {
  items: readonly WorkspaceItem[]
  archivedSessionIds?: readonly string[]
  phase?: string
}

export type SessionsHook = <T>(selector: (state: SessionsState) => T) => T
export type WorkspacesHook = <T>(selector: (state: WorkspacesState) => T) => T

/** cwd 是否属于该用户的成员工作区集合。 */
function isOwnCwd(user: WhoAmI, cwd: string | undefined): boolean {
  if (!cwd) return false
  return user.workspaces.some((w) => w.path === cwd)
}

export interface RestrictedWorkspacesViewProps {
  t: Translate
  wide: boolean
  useSessions: SessionsHook
  useWorkspaces: WorkspacesHook
  openSession: (sessionId: string) => void
  newSession: (workspaceId: string) => void
  user: WhoAmI
  titles?: Readonly<Record<string, string>>
}

interface WorkspaceGroup {
  key: string
  id: string
  name: string
  rows: SessionRow[]
  active: boolean
}

/**
 * 工作区（= 项目）列表：一个用户的项目各占一行，会话挂在各自项目行下，
 * 结构与原生 WorkspaceBrowser 一致（36px 表头 + 34px 项目行 + 32px 会话行）。
 */
export function RestrictedWorkspacesView(props: RestrictedWorkspacesViewProps): React.ReactElement {
  const listState = props.useSessions((s) => s)
  const wsState = props.useWorkspaces((s) => s)
  const [collapsed, setCollapsed] = useState<Readonly<Record<string, boolean>>>({})

  const ownPaths = new Set(props.user.workspaces.map((w) => w.path))
  const archived = new Set(wsState.archivedSessionIds ?? [])
  const visible = (row: SessionRow | undefined): row is SessionRow =>
    row !== undefined &&
    row.origin !== 'subagent' &&
    !archived.has(row.id) &&
    (row.blank !== true || listState.current === row.id)

  const accounted = new Set<string>()
  const groups: WorkspaceGroup[] = wsState.items
    .filter((w) => ownPaths.has(w.path))
    .map((w) => {
      const rows: SessionRow[] = []
      for (const id of w.sessionIds ?? []) {
        if (accounted.has(id)) continue
        accounted.add(id)
        const row = listState.byId[id]
        if (visible(row)) rows.push(row)
      }
      // 兜底：cwd 属于该工作区但不在 sessionIds 里的会话（注册时序差异）。
      for (const id of listState.ids) {
        if (accounted.has(id)) continue
        const row = listState.byId[id]
        if (row?.cwd !== w.path || !visible(row)) continue
        accounted.add(id)
        rows.push(row)
      }
      return {
        key: w.workspaceId,
        id: w.workspaceId,
        name: w.title !== '' ? w.title : w.path,
        rows,
        active: listState.current !== undefined && rows.some((r) => r.id === listState.current),
      }
    })

  const toggle = (key: string): void => {
    setCollapsed((prev) => ({ ...prev, [key]: !(prev[key] === true) }))
  }

  return (
    <div className={MT.root} data-wide={props.wide ? 'true' : undefined}>
      <div className={MT.header}>
        <span>{props.t('browser.section')}</span>
      </div>
      {groups.length === 0 ? (
        <p className={MT.empty}>
          {wsState.phase !== undefined && wsState.phase !== 'ready'
            ? props.t('browser.loading')
            : props.t('browser.noProjects')}
        </p>
      ) : (
        <div className={MT.list} role="tree" aria-label={props.t('browser.section')}>
          {groups.map((g) => {
            const open = collapsed[g.key] !== true
            return (
              <div className={MT.group} key={g.key}>
                <div
                  className={cx(MT.project, g.active && MT.projectActive)}
                  role="treeitem"
                  aria-expanded={open}
                  tabIndex={0}
                  onClick={() => toggle(g.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggle(g.key)
                    }
                  }}
                >
                  <span className={cx(MT.slot, MT.folder)}>
                    <FolderIcon open={open} />
                  </span>
                  <span className={cx(MT.slot, MT.chevron)}>
                    <ArrowIcon open={open} className={cx(MT.arrow, open && MT.arrowOpen)} />
                  </span>
                  <span className={MT.title}>{g.name}</span>
                  <span className={MT.actions}>
                    <button
                      type="button"
                      className={MT.iconButton}
                      title={props.t('browser.newSession')}
                      aria-label={props.t('browser.newSession')}
                      onClick={(event) => {
                        event.stopPropagation()
                        props.newSession(g.id)
                      }}
                    >
                      <PlusIcon />
                    </button>
                  </span>
                </div>
                {open
                  ? g.rows.map((r) => (
                      <div
                        key={r.id}
                        className={cx(MT.session, listState.current === r.id && MT.sessionSelected)}
                        role="treeitem"
                        aria-selected={listState.current === r.id}
                        onClick={() => props.openSession(r.id)}
                      >
                        <span className={MT.slot}>
                          {r.running === true ? <span className={MT.dot} aria-hidden="true" /> : null}
                        </span>
                        <span className={MT.sessionTitle}>
                          {r.blank === true
                            ? props.t('browser.newSession')
                            : r.title ?? props.titles?.[r.id] ?? r.displayTitle}
                        </span>
                      </div>
                    ))
                  : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** 一次性拉取持久标题（best effort）。 */
export function useColdSessionTitles(
  user: WhoAmI | undefined,
  deps: Pick<ClientDeps, 'fetch' | 'storage'>,
): Readonly<Record<string, string>> {
  const [titles, setTitles] = useState<Record<string, string>>({})
  useEffect(() => {
    setTitles({})
    if (user === undefined) return
    let cancelled = false
    const token = readStoredToken(deps.storage)
    if (token === null) return
    void callApi(deps.fetch, '/tenant/api/my/sessions', { token })
      .then((res) => {
        if (cancelled) return
        const sessions = (res as { sessions?: Array<{ id?: string; title?: string }> }).sessions ?? []
        const map: Record<string, string> = {}
        for (const s of sessions) {
          if (typeof s.id === 'string' && typeof s.title === 'string' && s.title.length > 0) map[s.id] = s.title
        }
        setTitles(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.slug])
  return titles
}

/** 渲染 null —— 设置入口对普通用户消失。 */
export function RestrictedSettingsView(): React.ReactElement | null {
  return null
}

/** 原生"恢复上次会话"守卫：外来 cwd 的当前会话一律清除。 */
export function guardCurrentSession(
  list: { current?: string; byId: Record<string, { cwd?: string } | undefined> },
  allowedCwds: readonly string[],
  clear: () => void,
): boolean {
  if (list.current === undefined) return false
  const currentRow = list.byId[list.current]
  if (currentRow !== undefined && currentRow.cwd !== undefined && allowedCwds.includes(currentRow.cwd)) return false
  clear()
  return true
}

export interface RestrictedPickerViewProps {
  t: Translate
  open: boolean
  anchorRef: RefObject<HTMLElement | null> | undefined
  selectedId: string | undefined
  onPick: (workspaceId: string) => void
  onClose: () => void
  useWorkspaces: WorkspacesHook
  user: WhoAmI
}

const PICKER_GAP = 6
const PICKER_MAX_HEIGHT = 320
const PICKER_MIN_LEFT = 8

/** 锚点下方落菜单，越界翻转，钳制在视口内。 */
export function pickerPosition(
  rect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width'>,
  viewport: { height: number },
): { top: number; left: number; minWidth: number } {
  const dropTop = rect.bottom + PICKER_GAP
  const flipUp = dropTop + PICKER_MAX_HEIGHT > viewport.height
  const rawTop = flipUp ? rect.top - PICKER_GAP - PICKER_MAX_HEIGHT : dropTop
  const top = Math.max(rawTop, PICKER_MIN_LEFT)
  const left = Math.max(rect.left, PICKER_MIN_LEFT)
  return { top, left, minWidth: Math.max(Math.round(rect.width), 200) }
}

/** 工作区选择器：只提供用户自己的工作区（每项目一项，标题即项目名）。 */
export function RestrictedPickerView(props: RestrictedPickerViewProps): React.ReactElement | null {
  const [anchorBox, setAnchorBox] = useState<{ top: number; left: number; minWidth: number } | undefined>()
  useLayoutEffect(() => {
    if (!props.open) return
    const el = props.anchorRef?.current
    if (!el) {
      setAnchorBox(undefined)
      return
    }
    setAnchorBox(pickerPosition(el.getBoundingClientRect(), { height: window.innerHeight }))
  }, [props.open, props.anchorRef])
  const items = props.useWorkspaces((s) => s.items)
  if (!props.open) return null
  const mine = items.filter((w) => isOwnCwd(props.user, w.path))
  const anchored = anchorBox !== undefined
  return (
    <div
      className={MT.picker}
      style={anchored ? { top: anchorBox.top, left: anchorBox.left, minWidth: anchorBox.minWidth } : undefined}
      role="menu"
      aria-label={props.t('browser.section')}
    >
      {mine.length === 0 ? (
        <p className={MT.empty}>{props.t('picker.missing')}</p>
      ) : (
        mine.map((w) => (
          <div
            key={w.workspaceId}
            className={cx(MT.session, props.selectedId === w.workspaceId && MT.sessionSelected)}
            role="menuitem"
            tabIndex={0}
            onClick={() => { props.onPick(w.workspaceId); props.onClose() }}
          >
            <span className={MT.slot}>
              <FolderIcon open={false} />
            </span>
            <span className={MT.sessionTitle}>{w.title !== '' ? w.title : w.path}</span>
          </div>
        ))
      )}
    </div>
  )
}

export interface UserBadgeViewProps {
  t: Translate
  user: WhoAmI
  deps: ClientDeps
}

/** 身份徽标 + 单向退出（清令牌 + 硬刷新）。 */
export function UserBadgeView(props: UserBadgeViewProps): React.ReactElement {
  return (
    <div className={MT.badge}>
      <span className={MT.badgeName}>{props.user.name}</span>
      <button type="button" className={MT.logout} onClick={() => logout(props.deps)}>
        {props.t('badge.logout')}
      </button>
    </div>
  )
}
