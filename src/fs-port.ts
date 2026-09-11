/**
 * 文件系统端口：服务对 node:fs/promises 的最小需求，测试可注入替身。
 */
import * as nodeFs from 'node:fs/promises'

export interface FsPort {
  mkdir(path: string): Promise<void>
  readdir(path: string): Promise<string[]>
  symlink(target: string, path: string): Promise<void>
  writeFile(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
}

/** 真实 node:fs/promises 适配器（mkdir 递归，exists 永不抛）。 */
export const NodeFsPort: FsPort = {
  async mkdir(path) {
    await nodeFs.mkdir(path, { recursive: true })
  },
  readdir(path) {
    return nodeFs.readdir(path)
  },
  symlink(target, path) {
    return nodeFs.symlink(target, path)
  },
  writeFile(path, content) {
    return nodeFs.writeFile(path, content, 'utf8')
  },
  async exists(path) {
    try {
      await nodeFs.stat(path)
      return true
    } catch {
      return false
    }
  },
}
