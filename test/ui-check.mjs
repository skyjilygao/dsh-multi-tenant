/**
 * 浏览器端隔离回归检查（影子座位是否真正生效 + 侧边栏是否为工作区列表）。
 *
 * 背景：普通用户的受限座位（sidebar.workspaces / conversation.hero.workspace）
 * 一旦渲染崩溃，slot 错误边界会把它 abdicate，原生 WorkspaceBrowser 顶上，
 * 于是用户会看到所有用户的工作区 —— 表现为"左侧出现多个同名项目"。
 * 该脚本用真实浏览器登录某个普通用户，断言：
 *   1. 座位无崩溃（无 data-slot-error、无 React 报错）；
 *   2. 我们的受限视图渲染（"工作区"表头），且**每个项目一行**（不折叠成
 *      "aa·bb" 这类拼接展示）；
 *   3. 只列出该用户自己的工作区（同类名项目不会串号）；
 *   4. 工作区选择器只列出该用户自己的项目。
 *
 * 前置：本机 dsh 实例在跑（默认 8000），且存在测试用户（默认 t1/t1pass）。
 * 环境变量：TENANT_USER / TENANT_PASS / EXPECT_PROJECTS（逗号分隔）可切换断言对象。
 *
 * 用法：
 *   PLAYWRIGHT_CORE=<playwright-core/index.js 路径> \
 *   CHROME_PATH=<msedge.exe 或 chrome.exe> \
 *   TENANT_USER=t2 TENANT_PASS=t2pass EXPECT_PROJECTS=aa,bb \
 *   node test/ui-check.mjs
 */
const PW = process.env.PLAYWRIGHT_CORE
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.DSH_BASE ?? 'http://127.0.0.1:8000'
const USER = process.env.TENANT_USER ?? 't1'
const PASS = process.env.TENANT_PASS ?? 't1pass'

if (!PW) {
  console.error('需要 PLAYWRIGHT_CORE 环境变量指向 playwright-core/index.js')
  process.exit(2)
}
const { chromium } = (await import(PW)).default ?? (await import(PW))

let failed = 0
const ok = (name, cond, detail = '') => {
  if (cond) console.log('  OK ' + name)
  else { failed++; console.log('  FAIL ' + name + ' ' + detail) }
}

// 1) API 层：该用户的工作区集合
const r = await fetch(BASE + '/tenant/api/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASS }),
})
const token = (await r.json()).token
const whoRes = await fetch(BASE + '/tenant/api/whoami', { headers: { authorization: 'Bearer ' + token } })
const who = (await whoRes.json()).user
console.log(`== API（${USER}）==`)
ok('登录成功', typeof token === 'string')
ok('工作区非空', who.workspaces.length > 0, JSON.stringify(who.workspaces))

const expectProjects = process.env.EXPECT_PROJECTS
  ? process.env.EXPECT_PROJECTS.split(',').map((s) => s.trim())
  : who.projects.map((p) => p.name)

// 2) 浏览器：登录并检查座位
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(BASE, { waitUntil: 'load', timeout: 30000 })
await page.waitForTimeout(3000)
await page.fill('#mt-gate-username', USER)
await page.fill('#mt-gate-password', PASS)
await page.click('form[aria-label] button[type="submit"]')
await page.waitForTimeout(6000)

console.log(`== 浏览器（${USER}）==`)
ok('座位无崩溃', (await page.locator('[data-slot-error]').count()) === 0)
ok('无 slot entry crashed 报错', !errors.some((e) => /slot entry crashed/.test(e)), errors.join(' | ').slice(0, 200))

const body = await page.evaluate(() => document.body.innerText)
ok('受限视图已渲染（工作区表头）', /工作区/.test(body))
ok('未出现项目拼接展示', !/·/.test(body) || !new RegExp(expectProjects.join('·')).test(body))

// 侧边栏里的"工作区行"= 我们渲染的项目行（role=treeitem + aria-expanded）
const projectRows = await page.evaluate(() =>
  [...document.querySelectorAll('[data-slot="sidebar.workspaces"] [role="treeitem"][aria-expanded]')]
    .map((el) => el.innerText.trim()))
ok('每个项目一行（数量）', projectRows.length === expectProjects.length,
  JSON.stringify({ projectRows, expectProjects }))
ok('项目名逐行展示且与预期一致',
  expectProjects.every((name) => projectRows.includes(name)) &&
  projectRows.every((name) => expectProjects.includes(name)),
  JSON.stringify(projectRows))

// 3) 选择器：只列自己的项目
const chip = page.locator('button').filter({ hasText: new RegExp(`^${expectProjects[0]}$`) }).first()
if (await chip.count()) {
  await chip.click()
  await page.waitForTimeout(1000)
  const items = await page.evaluate(() =>
    [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].map((b) => b.innerText.trim()))
  const own = new Set(who.projects.map((p) => p.name))
  ok('选择器条目均为自己的项目', items.length > 0 && items.every((i) => own.has(i)), JSON.stringify(items))
} else {
  console.log('  SKIP 未找到工作区切换按钮')
}

if (process.env.SCREENSHOT) {
  await page.screenshot({ path: process.env.SCREENSHOT })
  console.log('  截图:', process.env.SCREENSHOT)
}

await browser.close()
console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
