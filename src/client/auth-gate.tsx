/**
 * shell.overlay 登录门（受控于共享身份源）：
 *  - 'checking'：全帧遮罩，防止原生 UI 闪现；
 *  - 'form'：登录卡片；
 *  - 'hidden'：已登录或 guard 关闭。
 */
import { useState, type FormEvent, type CSSProperties } from 'react'
import { ApiError, login, type ClientDeps } from './api.ts'
import type { TenantLocaleKey } from './locales.ts'

export type Translate = (key: TenantLocaleKey) => string
export type AuthGateMode = 'checking' | 'form' | 'hidden'

const veil: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg, #16213e 0%, #1f3a6e 60%, #2f56cf 140%)',
}
const card: CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '36px 32px', width: 360,
  boxShadow: '0 18px 50px rgba(0,0,0,.35)', fontFamily: 'inherit',
}
const title: CSSProperties = { fontSize: 19, margin: 0, marginBottom: 6 }
const subtitle: CSSProperties = { color: '#6b7689', fontSize: 13, margin: 0, marginBottom: 22 }
const label: CSSProperties = { display: 'block', fontSize: 13, color: '#6b7689', margin: '12px 0 6px' }
const input: CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #e3e8f0',
  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const submit: CSSProperties = {
  width: '100%', marginTop: 18, padding: 11, background: '#3b6cf6', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer',
}
const error: CSSProperties = { color: '#e5484d', fontSize: 13, marginTop: 10, marginBottom: 0 }
const checking: CSSProperties = { color: '#fff', fontSize: 14, opacity: 0.9 }

export interface AuthGateViewProps {
  t: Translate
  deps: ClientDeps
  mode: AuthGateMode
}

export function AuthGateView(props: AuthGateViewProps): React.ReactElement | null {
  const t = props.t
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (props.mode === 'hidden') return null

  if (props.mode === 'checking') {
    return <div style={veil}><p style={checking} role="status">{t('gate.checking')}</p></div>
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const username = String(data.get('username') ?? '')
    const password = String(data.get('password') ?? '')
    setBusy(true)
    setErr('')
    void login(props.deps, username, password)
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setBusy(false))
  }

  return (
    <div style={veil}>
      <form style={card} aria-label={t('gate.title')} onSubmit={onSubmit}>
        <h1 style={title}>{t('gate.title')}</h1>
        <p style={subtitle}>{t('gate.subtitle')}</p>
        <label style={label} htmlFor="mt-gate-username">{t('gate.username')}</label>
        <input id="mt-gate-username" name="username" style={input} type="text" autoComplete="username" />
        <label style={label} htmlFor="mt-gate-password">{t('gate.password')}</label>
        <input id="mt-gate-password" name="password" style={input} type="password" autoComplete="current-password" />
        {err ? <p style={error} role="alert">{err}</p> : null}
        <button style={submit} type="submit" disabled={busy}>{t(busy ? 'gate.signingIn' : 'gate.submit')}</button>
      </form>
    </div>
  )
}
