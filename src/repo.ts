/**
 * 存储端口：JSON 文件仓库（tmp+rename 原子写），零运行时依赖。
 * 测试用 MemoryRepo。
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RepoTable } from './records.ts'

/** 服务使用的存储端口。 */
export interface Repo {
  get(table: RepoTable, key: string): Promise<unknown | undefined>
  put(table: RepoTable, key: string, value: unknown): Promise<void>
  delete(table: RepoTable, key: string): Promise<boolean>
  list(table: RepoTable): Promise<Array<[string, unknown]>>
}

/** 内存适配器（测试）。 */
export class MemoryRepo implements Repo {
  private tables = new Map<string, Map<string, unknown>>()

  private table(name: string): Map<string, unknown> {
    let m = this.tables.get(name)
    if (!m) {
      m = new Map()
      this.tables.set(name, m)
    }
    return m
  }

  async get(table: RepoTable, key: string) {
    return this.table(table).get(key)
  }

  async put(table: RepoTable, key: string, value: unknown) {
    this.table(table).set(key, value)
  }

  async delete(table: RepoTable, key: string) {
    return this.table(table).delete(key)
  }

  async list(table: RepoTable) {
    return [...this.table(table).entries()]
  }
}

type Persisted = Partial<Record<RepoTable, Record<string, unknown>>>

/** JSON 文件适配器，写操作经 promise 链串行化。 */
export class JsonFileRepo implements Repo {
  private data: Persisted = {}
  private loaded = false
  private writing: Promise<void> = Promise.resolve()

  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      const raw = await readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw) as Persisted
      if (parsed && typeof parsed === 'object') this.data = parsed
    } catch {
      this.data = {}
    }
  }

  private persist(): Promise<void> {
    this.writing = this.writing.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      const tmp = this.file + '.tmp'
      await writeFile(tmp, JSON.stringify(this.data), 'utf8')
      await rename(tmp, this.file)
    })
    return this.writing
  }

  async get(table: RepoTable, key: string) {
    await this.load()
    return this.data[table]?.[key]
  }

  async put(table: RepoTable, key: string, value: unknown) {
    await this.load()
    const t = (this.data[table] ??= {})
    t[key] = value
    await this.persist()
  }

  async delete(table: RepoTable, key: string) {
    await this.load()
    const t = this.data[table]
    if (!t || !(key in t)) return false
    delete t[key]
    await this.persist()
    return true
  }

  async list(table: RepoTable) {
    await this.load()
    return Object.entries(this.data[table] ?? {})
  }
}
