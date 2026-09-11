/**
 * 受限侧边栏 / 选择器的样式表。
 *
 * 不引入 CSS 构建链：在浏览器里注入一段 <style>（与官方插件同一手法），
 * 全部颜色走 DSH 主题令牌（--dsw-alias-* / --dsh-sidebar-inline-padding），
 * 因此浅色/深色主题自动跟随；尺寸取自原生
 * Rows.module.css / WorkspaceBrowser.module.css（projectRow 34px、
 * sessionRow 32px、slot 16×20、标题 14px/20px 等），保证与原生观感一致。
 */

/** 我们的类名（统一 mt-tenant-ws- 前缀，避免与原生哈希类名冲突）。 */
export const MT = {
  root: 'mt-tenant-ws-root',
  header: 'mt-tenant-ws-header',
  list: 'mt-tenant-ws-list',
  group: 'mt-tenant-ws-group',
  project: 'mt-tenant-ws-project',
  projectActive: 'mt-tenant-ws-project-active',
  slot: 'mt-tenant-ws-slot',
  folder: 'mt-tenant-ws-folder',
  chevron: 'mt-tenant-ws-chevron',
  arrow: 'mt-tenant-ws-arrow',
  arrowOpen: 'mt-tenant-ws-arrow-open',
  title: 'mt-tenant-ws-title',
  actions: 'mt-tenant-ws-actions',
  iconButton: 'mt-tenant-ws-icon-button',
  session: 'mt-tenant-ws-session',
  sessionSelected: 'mt-tenant-ws-session-selected',
  sessionTitle: 'mt-tenant-ws-session-title',
  dot: 'mt-tenant-ws-dot',
  empty: 'mt-tenant-ws-empty',
  picker: 'mt-tenant-ws-picker',
  badge: 'mt-tenant-ws-badge',
  badgeName: 'mt-tenant-ws-badge-name',
  logout: 'mt-tenant-ws-logout',
} as const

const TAG_ID = 'dsh-multi-tenant/sidebar.css'

const CSS = `
.${MT.root}{box-sizing:border-box;display:flex;flex-direction:column;flex:1;min-height:0;padding-right:var(--dsh-sidebar-inline-padding,12px)}
.${MT.header}{box-sizing:border-box;display:flex;align-items:center;flex:none;height:36px;gap:4px;margin:0 0 4px;padding-left:4px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;white-space:nowrap;overflow:hidden}
.${MT.list}{display:flex;flex-direction:column;flex:1;min-height:0;overflow-y:auto;margin-left:-4px;padding:0 0 16px 4px}
.${MT.group}{display:flex;flex-direction:column;position:relative}
.${MT.group}+.${MT.group}{margin-top:4px}
.${MT.project}{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;height:34px;margin:0;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;user-select:none}
.${MT.project}:hover{background:var(--dsw-alias-interactive-bg-hover)}
.${MT.slot}{display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px;height:20px;color:var(--dsw-alias-label-tertiary)}
.${MT.projectActive} .${MT.folder}{color:var(--dsw-alias-state-business-primary)}
.${MT.chevron}{display:none}
.${MT.project}:hover .${MT.folder}{display:none}
.${MT.project}:hover .${MT.chevron}{display:inline-flex}
.${MT.arrow}{transition:transform .15s ease}
.${MT.arrowOpen}{transform:rotate(90deg)}
.${MT.title}{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}
.${MT.actions}{display:none;align-items:center;gap:12px;flex:none;height:20px}
.${MT.project}:hover .${MT.actions},.${MT.session}:hover .${MT.actions}{display:inline-flex}
.${MT.iconButton}{display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.${MT.iconButton}:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.${MT.session}{box-sizing:border-box;display:flex;align-items:center;gap:0;width:100%;height:32px;margin:0;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;user-select:none;animation:mt-tenant-row-in .15s ease}
.${MT.session}:hover,.${MT.sessionSelected}{background:var(--dsw-alias-interactive-bg-hover)}
.${MT.sessionTitle}{flex:1;min-width:0;margin:0 6px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}
.${MT.dot}{width:7px;height:7px;border-radius:999px;background:var(--dsw-alias-state-business-primary)}
@keyframes mt-tenant-row-in{0%{opacity:0}}
.${MT.empty}{color:var(--dsw-alias-label-tertiary);margin:0;padding:16px 12px;font-size:13px;line-height:20px}
.${MT.picker}{position:fixed;z-index:10000;box-sizing:border-box;min-width:200px;max-height:320px;overflow-y:auto;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-specific-menu,var(--dsw-specific-sidebar-fill,#fff));box-shadow:0 12px 32px rgba(0,0,0,.18)}
.${MT.badge}{display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.${MT.badgeName}{color:var(--dsw-alias-label-primary);font-weight:600}
.${MT.logout}{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer}
.${MT.logout}:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
`

let injected = false

/** 幂等注入（模块加载时调用一次）。 */
export function ensureTenantStyles(): void {
  if (injected || typeof document === 'undefined') return
  injected = true
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-multi-tenant'
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

/** 条件类名拼接。 */
export function cx(...parts: ReadonlyArray<string | false | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ')
}
