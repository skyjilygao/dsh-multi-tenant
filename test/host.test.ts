/**
 * 宿主半区单测（node:test，零依赖）：种子管理员、多对多分配、
 * 成员工作区、令牌认证、API 分发器权限与隔离语义。
 */
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TenantService } from '../src/service.ts'
import { MemoryRepo } from '../src/repo.ts'
import { NodeFsPort } from '../src/fs-port.ts'
import { createTenantApi } from '../src/http.ts'
import { hashPassword, verifyPassword, tokenFingerprint } from '../src/crypto.ts'
import { slug } from '../src/slug.ts'
import { planMembership } from '../src/paths.ts'
import { renderAgentsMd } from '../src/agents-md.ts'
import { applyTitleFold } from '../src/title-fold.ts'

const ROOT = mkdtempSync(join(tmpdir(), 'dsh-mt-'))

function makeService(overrides = {}): TenantService {
  return new TenantService({
    repo: new MemoryRepo(),
    fs: NodeFsPort,
    now: () => 1_000_000,
    root: ROOT,
    tokenTtlMs: 3_600_000,
    adminPassword: 'admin',
    ...overrides,
  })
}

function makeApi(service: TenantService, sessionLister?: unknown) {
  return createTenantApi({ service, sessionLister: sessionLister as never })
}

test('crypto：散列/校验/指纹', () => {
  const h = hashPassword('admin')
  assert.ok(verifyPassword('admin', h))
  assert.ok(!verifyPassword('wrong', h))
  assert.ok(!verifyPassword('admin', 'garbage'))
  assert.equal(tokenFingerprint('abc').length, 64)
})

test('slug：中文与特殊字符映射为安全目录段', () => {
  assert.equal(slug('My App'), 'my-app')
  assert.equal(slug('智能客服'), '667a80fd5ba2670d')
  assert.ok(/^[a-z0-9-]+$/.test(slug('智能 客服/1')))
  assert.equal(slug(''), 'x')
})

test('paths：成员工作区在项目目录旁边', () => {
  const plan = planMembership('D:\\ws\\my-app', 'alice', ['src', 'README.md'], ['AGENTS.md'])
  assert.ok(plan.membershipWorkspacePath.endsWith('my-app-alice'))
  assert.equal(plan.symlinks.length, 2)
  assert.ok(!plan.symlinks.some((s) => s.name === 'AGENTS.md'))
})

test('agents-md：包含守则条目', () => {
  const md = renderAgentsMd({ userName: 'alice', projectName: 'My App', customRules: ['自定义守则'] })
  assert.ok(md.includes('alice') && md.includes('自定义守则'))
})

test('service：种子 admin/admin', async () => {
  const svc = makeService()
  await svc.init()
  const users = await svc.listUsers()
  assert.equal(users.length, 1)
  assert.equal(users[0]!.name, 'admin')
  assert.equal(users[0]!.role, 'admin')
  const session = await svc.login('admin', 'admin')
  assert.equal(session.user.role, 'admin')
  await assert.rejects(() => svc.login('admin', 'bad'), /用户名或密码错误/)
})

test('service：创建项目 + 多对多分配（1~n）', async () => {
  const svc = makeService()
  await svc.init()
  await svc.createProject('My App')
  await svc.createProject('数据分析')
  // 0 个项目被拒绝
  await assert.rejects(() => svc.createUser('alice', 'pw', []), /至少分配 1 个项目/)
  // 2 个项目
  const alice = await svc.createUser('alice', 'pw123', [slug('My App'), slug('数据分析')])
  assert.equal(alice.projects.length, 2)
  assert.equal(alice.workspaces.length, 2)
  // 工作区目录真实存在且是项目目录的兄弟目录
  for (const w of alice.workspaces) {
    assert.ok(w.path.includes('-alice'))
    assert.ok(await NodeFsPort.exists(w.path))
  }
  // 重名用户被拒绝（全局唯一）
  await assert.rejects(() => svc.createUser('alice', 'x', [slug('My App')]), /已存在/)
  // 不存在的项目被拒绝
  await assert.rejects(() => svc.createUser('bob', 'x', ['nope']), /不存在/)
})

test('service：改派项目 + 禁用', async () => {
  const svc = makeService()
  await svc.init()
  await svc.createProject('alpha')
  await svc.createProject('beta')
  await svc.createUser('bob', 'pw', ['alpha'])
  const reassigned = await svc.assignProjects('bob', ['alpha', 'beta'])
  assert.equal(reassigned.projects.length, 2)
  await assert.rejects(() => svc.assignProjects('bob', []), /至少分配 1 个项目/)
  await svc.setStatus('bob', 'disabled')
  const session = await svc.login('bob', 'pw').catch((e: Error) => e)
  assert.match((session as Error).message, /禁用/)
  await svc.setStatus('bob', 'active')
  const ok = await svc.login('bob', 'pw')
  const user = await svc.authenticate(ok.token)
  assert.equal(user.slug, 'bob')
  await assert.rejects(() => svc.authenticate('deadbeef'), /token 无效/)
})

test('http：路由权限与隔离语义', async () => {
  const svc = makeService()
  await svc.init()
  await svc.createProject('alpha')
  await svc.createUser('alice', 'pw', ['alpha'])
  const api = makeApi(svc, async (cwds: readonly string[]) =>
    cwds.flatMap((cwd) => [
      { id: 's-alice', header: { id: 's-alice', cwd }, title: 'alice 的会话' },
    ]))

  // 未认证
  assert.equal((await api({ method: 'GET', path: '/admin/overview' })).status, 401)
  // 登录
  const admin = (await api({ method: 'POST', path: '/login', body: { username: 'admin', password: 'admin' } })) as { status: number, json: { token: string } }
  assert.equal(admin.status, 200)
  const alice = (await api({ method: 'POST', path: '/login', body: { username: 'alice', password: 'pw' } })) as { status: number, json: { token: string } }
  assert.equal(alice.status, 200)
  const at = { token: alice.json.token }
  const admt = { token: admin.json.token }
  // 普通用户访问管理接口 → 403
  assert.equal((await api({ method: 'GET', path: '/admin/overview', ...at })).status, 403)
  // 建用户不分配项目 → 400
  assert.equal(
    (await api({ method: 'POST', path: '/admin/users', body: { username: 'x', password: 'y', projects: [] }, token: admt.token })).status,
    400,
  )
  // /my/sessions：只返回 alice 自己 cwd 桶内的会话
  const mine = (await api({ method: 'GET', path: '/my/sessions', ...at })) as { status: number, json: { sessions: Array<{ id: string }> } }
  assert.equal(mine.status, 200)
  assert.equal(mine.json.sessions.length, 1)
  assert.equal(mine.json.sessions[0]!.id, 's-alice')
  // 管理端建用户（分配 1 个项目）
  const created = (await api({
    method: 'POST',
    path: '/admin/users',
    body: { username: 'carol', password: 'pw', projects: [slug('alpha')] },
    token: admt.token,
  })) as { status: number, json: { user: { projects: unknown[] } } }
  assert.equal(created.status, 201)
  assert.equal(created.json.user.projects.length, 1)
  // 改派为 2 个项目
  await svc.createProject('beta')
  const assigned = (await api({
    method: 'POST',
    path: '/admin/users/assign',
    body: { username: 'carol', projects: [slug('alpha'), slug('beta')] },
    token: admt.token,
  })) as { status: number, json: { user: { projects: unknown[] } } }
  assert.equal(assigned.json.user.projects.length, 2)
  // 未知路由 / 方法不匹配
  assert.equal((await api({ method: 'GET', path: '/nope' })).status, 404)
  assert.equal((await api({ method: 'GET', path: '/login' })).status, 405)
})

test('title-fold：合并持久标题', () => {
  const rows = applyTitleFold(
    [{ id: 'a' }, { id: 'b', title: '旧' }],
    [
      { sessionId: 'a', status: 'fulfilled', value: { title: { title: '新标题' } } },
      { sessionId: 'b', status: 'rejected' },
    ],
  )
  assert.equal(rows[0]!.title, '新标题')
  assert.equal(rows[1]!.title, '旧')
})

after(() => {
  rmSync(ROOT, { recursive: true, force: true })
})
