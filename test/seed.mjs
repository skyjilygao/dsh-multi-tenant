/**
 * 建立多租户验证数据：项目 aa/bb，用户 t1(aa)、t2(aa+bb)。
 * 用法：node test/seed.mjs [base]
 */
const BASE = process.argv[2] ?? process.env.DSH_BASE ?? 'http://127.0.0.1:8000'

const api = async (token, method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

const admin = await api(null, 'POST', '/tenant/api/login', { username: 'admin', password: 'admin' })
if (admin.status !== 200) throw new Error('admin 登录失败: ' + JSON.stringify(admin.json))
const admT = admin.json.token

const created = []
for (const name of ['aa', 'bb']) {
  const res = await api(admT, 'POST', '/tenant/api/admin/projects', { name })
  created.push(name + ':' + res.status)
}
console.log('项目:', created.join(', '))

const users = [
  { username: 't1', password: 't1pass', projects: ['aa'] },
  { username: 't2', password: 't2pass', projects: ['aa', 'bb'] },
]
for (const u of users) {
  const res = await api(admT, 'POST', '/tenant/api/admin/users', u)
  console.log('用户', u.username, res.status, res.json.error ?? '')
}
