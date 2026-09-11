/**
 * settings.section 管理控制台：项目管理 + 用户管理（新增用户并分配
 * 1~n 个项目、改派项目、重置密码、禁用/启用、同步链接）。非管理员只见
 * 身份与拒绝说明。表单一律非受控（提交时读 FormData）。
 */
import { useEffect, useState, type FormEvent, type CSSProperties } from 'react'
import {
  ApiError,
  callApi,
  logout,
  readStoredToken,
  whoAmI,
  type ClientDeps,
  type WhoAmI,
} from './api.ts'
import type { TenantLocaleKey } from './locales.ts'

export type Translate = (key: TenantLocaleKey) => string

interface ProjectRow { slug: string; name: string; workspacePath?: string }
interface UserRow {
  slug: string
  name: string
  role: 'admin' | 'user'
  status: 'active' | 'disabled'
  projectSlugs: string[]
}

export interface AdminSectionViewProps {
  t: Translate
  close: () => void
  deps: ClientDeps
}

interface Message { kind: 'error' | 'ok'; text: string }

const section: CSSProperties = { padding: 20, fontFamily: 'inherit', fontSize: 13, maxWidth: 860 }
const header: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }
const title: CSSProperties = { fontSize: 17, margin: 0 }
const identity: CSSProperties = { color: '#6b7689', fontSize: 12, margin: '4px 0 0' }
const block: CSSProperties = { border: '1px solid #e3e8f0', borderRadius: 10, padding: 16, marginBottom: 14 }
const blockTitle: CSSProperties = { fontSize: 14, margin: '0 0 10px' }
const form: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 10 }
const label: CSSProperties = { display: 'block', fontSize: 12, color: '#6b7689', margin: '0 0 4px' }
const fieldWrap: CSSProperties = { display: 'flex', flexDirection: 'column' }
const input: CSSProperties = {
  padding: '8px 10px', border: '1px solid #e3e8f0', borderRadius: 8, fontSize: 13, outline: 'none',
}
const primary: CSSProperties = {
  padding: '8px 16px', background: '#3b6cf6', color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, cursor: 'pointer',
}
const secondary: CSSProperties = {
  padding: '5px 12px', background: '#fff', border: '1px solid #e3e8f0', borderRadius: 8,
  fontSize: 12, cursor: 'pointer', color: 'inherit',
}
const listEl: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 }
const rowEl: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
  padding: '8px 2px', borderBottom: '1px solid #f0f2f7',
}
const dim: CSSProperties = { color: '#8a93a6' }
const note: CSSProperties = { color: '#6b7689', fontSize: 13 }
const okStyle: CSSProperties = { color: '#2f9e6e', fontSize: 13, margin: '0 0 10px' }
const errorStyle: CSSProperties = { color: '#e5484d', fontSize: 13, margin: '0 0 10px' }
const checkboxes: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }
const slugStyle: CSSProperties = { color: '#8a93a6', fontSize: 11, fontFamily: 'monospace' }

export function AdminSectionView(props: AdminSectionViewProps): React.ReactElement | null {
  const t = props.t
  const [identity, setIdentity] = useState<WhoAmI | null>()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [message, setMessage] = useState<Message | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const token = () => readStoredToken(props.deps.storage) ?? ''
  const api = (path: string, body: Record<string, unknown>): Promise<unknown> =>
    callApi(props.deps.fetch, path, { method: 'POST', body, token: token() })

  const refresh = async (): Promise<void> => {
    const overview = await callApi(props.deps.fetch, '/tenant/api/admin/overview', { token: token() }) as {
      projects?: ProjectRow[]
      users?: UserRow[]
    }
    setProjects(overview.projects ?? [])
    setUsers(overview.users ?? [])
  }

  useEffect(() => {
    let alive = true
    void whoAmI(props.deps).then(async (me) => {
      if (!alive) return
      setIdentity(me)
      if (me?.role === 'admin') await refresh().catch(() => {})
    })
    return () => { alive = false }
  }, [props.deps])

  if (identity === undefined) return null
  if (identity === null) return <p style={note} role="status">{t('admin.notSignedIn')}</p>

  const run = (action: () => Promise<void>, okText?: string): void => {
    setMessage(null)
    void action()
      .then(async () => {
        if (okText) setMessage({ kind: 'ok', text: okText })
        await refresh()
      })
      .catch((err: unknown) => {
        setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : String(err) })
      })
  }

  const onCreateProject = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const body: Record<string, unknown> = { name: String(data.get('name') ?? '') }
    const path = String(data.get('workspacePath') ?? '').trim()
    if (path) body.workspacePath = path
    run(async () => { await api('/tenant/api/admin/projects', body) })
  }

  const onCreateUser = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const chosen = [...form.querySelectorAll<HTMLInputElement>('input[name="projects"]:checked')].map((c) => c.value)
    run(async () => {
      await api('/tenant/api/admin/users', {
        username: String(data.get('username') ?? ''),
        password: String(data.get('password') ?? ''),
        projects: chosen,
      })
      form.reset()
    })
  }

  const onAssign = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (editing === null) return
    const chosen = [...event.currentTarget.querySelectorAll<HTMLInputElement>('input[name="projects"]:checked')].map((c) => c.value)
    run(async () => { await api('/tenant/api/admin/users/assign', { username: editing, projects: chosen }) })
    setEditing(null)
  }

  const onResetPassword = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (editing === null) return
    const data = new FormData(event.currentTarget)
    run(async () => { await api('/tenant/api/admin/users/password', { username: editing, password: String(data.get('password') ?? '') }) })
  }

  const headerEl = (
    <header style={header}>
      <div>
        <h2 style={title}>{t('section.title')}</h2>
        <p style={identity}>{t('admin.identity')}：<b>{identity.name}</b>（{t(identity.role === 'admin' ? 'admin.role.admin' : 'admin.role.user')}）</p>
      </div>
      <span style={{ flex: 1 }} />
      <button type="button" style={secondary} onClick={() => { logout(props.deps); props.close() }}>{t('admin.logout')}</button>
    </header>
  )

  if (identity.role !== 'admin') {
    return <div style={section}>{headerEl}<p style={note} role="status">{t('admin.denied')}</p></div>
  }

  const projectCheckboxes = (selected: readonly string[]): React.ReactElement => (
    <div style={checkboxes}>
      {projects.map((p) => (
        <label key={p.slug} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <input type="checkbox" name="projects" value={p.slug} defaultChecked={selected.includes(p.slug)} />
          {p.name}
        </label>
      ))}
    </div>
  )

  return (
    <div style={section}>
      {headerEl}
      {message ? <p style={message.kind === 'error' ? errorStyle : okStyle} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      <section style={block}>
        <h3 style={blockTitle}>{t('admin.projects')}</h3>
        <ul style={listEl}>
          {projects.map((p) => (
            <li key={p.slug} style={rowEl}>
              <span>{p.name} <code style={slugStyle}>{p.workspacePath ?? p.slug}</code></span>
            </li>
          ))}
        </ul>
        <form style={form} onSubmit={onCreateProject}>
          <div style={fieldWrap}>
            <label style={label} htmlFor="mt-project-name">{t('admin.projectName')}</label>
            <input id="mt-project-name" name="name" style={input} type="text" />
          </div>
          <div style={fieldWrap}>
            <label style={label} htmlFor="mt-project-path">{t('admin.projectPath')}</label>
            <input id="mt-project-path" name="workspacePath" style={{ ...input, width: 280 }} type="text" placeholder="D:\workspaces\my-app" />
          </div>
          <button type="submit" style={primary}>{t('admin.createProject')}</button>
        </form>
      </section>

      <section style={block}>
        <h3 style={blockTitle}>{t('admin.users')}</h3>
        {projects.length === 0 ? <p style={note}>{t('admin.noProjects')}</p> : (
          <form style={{ ...form, flexDirection: 'column', alignItems: 'stretch' }} onSubmit={onCreateUser}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={fieldWrap}>
                <label style={label} htmlFor="mt-user-name">{t('admin.username')}</label>
                <input id="mt-user-name" name="username" style={input} type="text" />
              </div>
              <div style={fieldWrap}>
                <label style={label} htmlFor="mt-user-password">{t('admin.password')}</label>
                <input id="mt-user-password" name="password" style={input} type="password" />
              </div>
            </div>
            <div>
              <label style={label}>{t('admin.userProjects')}</label>
              {projectCheckboxes([])}
            </div>
            <button type="submit" style={{ ...primary, alignSelf: 'flex-start' }}>{t('admin.createUser')}</button>
          </form>
        )}
        <ul style={listEl}>
          {users.filter((u) => u.role === 'user').map((u) => (
            <li key={u.slug} style={rowEl}>
              <span>
                {u.name}
                <span style={dim}> · {u.projectSlugs.map((s) => projects.find((p) => p.slug === s)?.name ?? s).join('、') || '—'} · {t(u.status === 'active' ? 'admin.status.active' : 'admin.status.disabled')}</span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" style={secondary} onClick={() => setEditing(editing === u.slug ? null : u.slug)}>{t('admin.action.assign')}</button>
                <button
                  type="button" style={secondary}
                  onClick={() => { void run(async () => { await api('/tenant/api/admin/users/status', { username: u.name, status: u.status === 'active' ? 'disabled' : 'active' }) }) }}
                >{t(u.status === 'active' ? 'admin.action.disable' : 'admin.action.enable')}</button>
                {editing === u.slug ? (
                  <>
                    <form style={{ display: 'flex', gap: 6 }} onSubmit={onAssign}>
                      <input type="hidden" name="username" value={u.name} />
                      {projectCheckboxes(u.projectSlugs)}
                      <button type="submit" style={primary}>{t('admin.save')}</button>
                      <button type="button" style={secondary} onClick={() => setEditing(null)}>{t('admin.cancel')}</button>
                    </form>
                    <form style={{ display: 'flex', gap: 6 }} onSubmit={onResetPassword}>
                      <input type="hidden" name="username" value={u.name} />
                      <input name="password" style={input} type="text" placeholder={t('admin.password')} />
                      <button type="submit" style={secondary}>{t('admin.action.resetPwd')}</button>
                    </form>
                    {u.projectSlugs.map((ps) => (
                      <button
                        key={ps} type="button" style={secondary}
                        onClick={() => { void run(async () => { await api('/tenant/api/admin/sync', { username: u.name, project: ps }) }, ps) }}
                      >{t('admin.action.sync')}·{ps}</button>
                    ))}
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
