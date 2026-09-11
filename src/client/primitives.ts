/**
 * 官方 UI 原语桥（图标）。
 *
 * web 引导把 '@deepseek-ai/dsh-client-ui-primitives' 注册为**静态共享模块**
 * （见前端 Jd() 的 staticModules 表），插件工厂拿到的 require 可直接取到它。
 * 复用官方图标能让受限视图与原生 WorkspaceBrowser 的观感完全一致。
 *
 * 取不到时（旧版引导 / 宿主半区）退化为 undefined，调用方回退到内置 SVG，
 * 功能不受影响 —— 所以这里用 try/catch 的动态 require，而不是顶层 import
 * （顶层 import 在缺该静态模块时会直接让整个插件加载失败）。
 */
import type { CSSProperties, ReactElement } from 'react'

/** 插件工厂注入的 CommonJS require（浏览器半区专用）。 */
declare const require: ((id: string) => unknown) | undefined

export interface IconProps {
  size?: number
  className?: string
  style?: CSSProperties
  'aria-hidden'?: boolean
}

export type IconComponent = (props: IconProps) => ReactElement

/** 静态模块表；不可用时为空表。 */
function loadTable(): Record<string, unknown> {
  try {
    if (typeof require === 'function') {
      return (require('@deepseek-ai/dsh-client-ui-primitives') ?? {}) as Record<string, unknown>
    }
  } catch {
    /* 引导缺该静态模块：走内置图标 */
  }
  return {}
}

const TABLE = loadTable()

function icon(name: string): IconComponent | undefined {
  const value = TABLE[name]
  return typeof value === 'function' ? (value as IconComponent) : undefined
}

/** 展开态文件夹、收起态文件夹（原生 projectRow 用同一对图标）。 */
export const IconFolderOpen = icon('IconFolderOpen16')
export const IconFolderClose = icon('IconFolderClose16')
/** 原生行箭头（hover 时替换文件夹图标，展开时旋转 90°）。 */
export const IconTriangleRight = icon('IconTriangleRightFill14')
/** 新建会话按钮图标。 */
export const IconPlus = icon('IconPlusOutline16')
