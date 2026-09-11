/**
 * 对运行中的 DSH 实例做端到端多租户验证（需 dsh web 已启动）。
 * 运行：node test/e2e-live.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://127.0.0.1:8000";
let pass = 0, failn = 0;
const ok = (name, cond, d = "") => { if (cond) { pass++; console.log("  OK " + name); } else { failn++; console.log("  FAIL " + name + " " + d); } };
const api = async (token, method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

console.log("== admin 登录 ==");
const admin = await api(null, "POST", "/tenant/api/login", { username: "admin", password: "admin" });
ok("admin/admin 登录", admin.status === 200 && admin.json.user.role === "admin");
const bad = await api(null, "POST", "/tenant/api/login", { username: "admin", password: "wrong" });
ok("错误密码 401", bad.status === 401);
const admT = admin.json.token;

console.log("== 管理台：项目与用户 ==");
const stamp = Date.now().toString(36);
const p1 = await api(admT, "POST", "/tenant/api/admin/projects", { name: "e2e-智能客服-" + stamp });
ok("创建项目1", p1.status === 201, JSON.stringify(p1.json));
const p2 = await api(admT, "POST", "/tenant/api/admin/projects", { name: "e2e-数据分析-" + stamp });
ok("创建项目2", p2.status === 201);
const dup = await api(admT, "POST", "/tenant/api/admin/projects", { name: "e2e-智能客服-" + stamp });
ok("重复项目 409", dup.status === 409);
const s1 = p1.json.project.slug, s2 = p2.json.project.slug;

const noProj = await api(admT, "POST", "/tenant/api/admin/users", { username: "nouser" + stamp, password: "x", projects: [] });
ok("0 项目分配被拒", noProj.status === 400);
const alice = await api(admT, "POST", "/tenant/api/admin/users", { username: "e2e-alice-" + stamp, password: "alice123", projects: [s1, s2] });
ok("alice 分配 2 个项目", alice.status === 201 && alice.json.user.projects.length === 2, JSON.stringify(alice.json));
const bob = await api(admT, "POST", "/tenant/api/admin/users", { username: "e2e-bob-" + stamp, password: "bob123", projects: [s1] });
ok("bob 分配 1 个项目", bob.status === 201);
const dupU = await api(admT, "POST", "/tenant/api/admin/users", { username: "e2e-alice-" + stamp, password: "x", projects: [s1] });
ok("重复用户 409", dupU.status === 409);
const noPerm = await api("faketoken", "POST", "/tenant/api/admin/projects", { name: "x" });
ok("伪造令牌 401", noPerm.status === 401);

console.log("== 用户视角（多对多与隔离） ==");
const aliceT = (await api(null, "POST", "/tenant/api/login", { username: "e2e-alice-" + stamp, password: "alice123" })).json.token;
const me = (await api(aliceT, "GET", "/tenant/api/whoami")).json.user;
ok("alice whoami 见 2 个项目", me.projects.length === 2);
ok("alice 有 2 个成员工作区", me.workspaces.length === 2, JSON.stringify(me.workspaces));
const bobT = (await api(null, "POST", "/tenant/api/login", { username: "e2e-bob-" + stamp, password: "bob123" })).json.token;
const meBob = (await api(bobT, "GET", "/tenant/api/whoami")).json.user;
ok("bob whoami 见 1 个项目", meBob.projects.length === 1);
const bobSessions = await api(bobT, "GET", "/tenant/api/my/sessions");
ok("bob /my/sessions 200（cwd 桶查询）", bobSessions.status === 200 && Array.isArray(bobSessions.json.sessions));

console.log("== 改派 / 禁用 / 权限 ==");
const assigned = await api(admT, "POST", "/tenant/api/admin/users/assign", { username: "e2e-bob-" + stamp, projects: [s1, s2] });
ok("bob 改派为 2 项目", assigned.status === 200 && assigned.json.user.projects.length === 2);
const disabled = await api(admT, "POST", "/tenant/api/admin/users/status", { username: "e2e-bob-" + stamp, status: "disabled" });
ok("禁用 bob", disabled.status === 200);
const bobLogin = await api(null, "POST", "/tenant/api/login", { username: "e2e-bob-" + stamp, password: "bob123" });
ok("禁用后登录被拒", bobLogin.status === 401 && /禁用/.test(bobLogin.json.error));
const userAdmin = await api(aliceT, "GET", "/tenant/api/admin/overview");
ok("普通用户访问管理接口 403", userAdmin.status === 403);

console.log(`\n结果: ${pass} 通过, ${failn} 失败`);
process.exit(failn ? 1 : 0);
