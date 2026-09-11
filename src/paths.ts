/**
 * 双层工作区布局：
 *
 *   <root>/<projectSlug>/                项目工作区（真实目录，文件之源）
 *   <root>/<projectSlug>-<userSlug>/     成员工作区（真实目录，条目是指向
 *                                        项目工作区的符号链接 = 用户的
 *                                        "分身"目录，会话按 cwd 落进这里）
 *
 * 用户与项目多对多 ⇒ 一个用户可有多个成员工作区（每项目一个）。
 */
import { resolve, relative, isAbsolute, dirname, basename } from 'node:path'
import { slug } from './slug.ts'

/** 自动创建的项目工作区绝对路径。 */
export function projectWorkspacePath(root: string, projectName: string): string {
  return resolve(root, slug(projectName))
}

/** 成员工作区路径：位于项目目录旁边，`<项目目录名>-<用户 slug>`。 */
export function membershipWorkspacePath(projectWs: string, userName: string): string {
  return resolve(dirname(resolve(projectWs)), `${basename(resolve(projectWs))}-${slug(userName)}`)
}

/** `p` 是否位于 `base` 内（含边界），抵御 `..` 穿越。 */
export function isInside(base: string, p: string): boolean {
  const rp = resolve(p)
  const rb = resolve(base)
  const rel = relative(rb, rp)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** 成员工作区应暴露的一条符号链接。 */
export interface SymlinkPlanEntry {
  name: string
  linkPath: string
  targetPath: string
}

/** 规划结果：成员工作区路径 + 完整符号链接集合。 */
export interface MembershipPlan {
  projectWorkspacePath: string
  membershipWorkspacePath: string
  symlinks: SymlinkPlanEntry[]
}

function isSafeSegment(name: string): boolean {
  return name.length > 0 && name !== '.' && name !== '..' && !name.includes('/')
}

/** 计算成员工作区路径与其应暴露的符号链接集合。 */
export function planMembership(
  projectWorkspacePath: string,
  userName: string,
  projectEntries: readonly string[],
  reserved: readonly string[],
): MembershipPlan {
  const projectWs = resolve(projectWorkspacePath)
  const memberWs = membershipWorkspacePath(projectWs, userName)
  const reservedSet = new Set(reserved)
  const symlinks: SymlinkPlanEntry[] = []
  for (const name of projectEntries) {
    if (!isSafeSegment(name)) continue
    if (reservedSet.has(name)) continue
    symlinks.push({ name, linkPath: resolve(memberWs, name), targetPath: resolve(projectWs, name) })
  }
  return { projectWorkspacePath: projectWs, membershipWorkspacePath: memberWs, symlinks }
}
