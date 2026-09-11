/**
 * 图标：优先复用官方 UI 原语（观感与原生一致），缺失时回退内置 SVG。
 * 尺寸与原生一致（slot 16×20 内 16px 图标）。
 */
import type { ReactElement } from 'react'
import { IconFolderClose, IconFolderOpen, IconPlus, IconTriangleRight } from './primitives.ts'

/** 回退：文件夹轮廓。 */
function FallbackFolder(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M1.5 4.2c0-.6.5-1.1 1.1-1.1h2.8c.4 0 .7.2.9.5l.6.9h5.5c.6 0 1.1.5 1.1 1.1v6.2c0 .6-.5 1.1-1.1 1.1H2.6c-.6 0-1.1-.5-1.1-1.1V4.2Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  )
}

/** 回退：向右三角（展开时旋转 90°）。 */
function FallbackArrow(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M6 3.6 11 8l-5 4.4V3.6Z" fill="currentColor" />
    </svg>
  )
}

/** 回退：加号。 */
function FallbackPlus(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 3.2v9.6M3.2 8h9.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/** 项目行左侧：展开/收起文件夹。 */
export function FolderIcon({ open }: { open: boolean }): ReactElement {
  const Comp = open ? (IconFolderOpen ?? IconFolderClose) : (IconFolderClose ?? IconFolderOpen)
  if (Comp !== undefined) return <Comp />
  return <FallbackFolder />
}

/** 项目行 hover 时替换文件夹的箭头。 */
export function ArrowIcon({ open, className }: { open: boolean; className?: string }): ReactElement {
  const Comp = IconTriangleRight
  if (Comp !== undefined) return <Comp className={className} />
  return <span className={className}><FallbackArrow /></span>
}

/** 项目行 hover 时的"新建会话"按钮图标。 */
export function PlusIcon(): ReactElement {
  const Comp = IconPlus
  if (Comp !== undefined) return <Comp />
  return <FallbackPlus />
}
