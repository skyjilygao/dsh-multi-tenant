// src/index.ts
import { join, resolve as resolve3 } from "node:path";
import { homedir } from "node:os";

// src/crypto.ts
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
var KEYLEN = 32;
function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
function verifyPassword(password, envelope) {
  const parts = envelope.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || expected.length !== KEYLEN) return false;
  const actual = scryptSync(password, salt, KEYLEN);
  return timingSafeEqual(actual, expected);
}
function newToken() {
  return randomBytes(32).toString("hex");
}
function tokenFingerprint(token) {
  return createHash("sha256").update(token).digest("hex");
}

// src/slug.ts
var HEX = (cp) => cp.toString(16);
function slug(name2) {
  let out = "";
  let dash = false;
  for (const ch of name2) {
    const cp = ch.codePointAt(0);
    if (cp >= 97 && cp <= 122 || cp >= 48 && cp <= 57) {
      out += dash ? "-" + ch : ch;
      dash = false;
    } else if (cp >= 65 && cp <= 90) {
      out += dash ? "-" + ch.toLowerCase() : ch.toLowerCase();
      dash = false;
    } else if (cp > 127) {
      out += dash ? "-" + HEX(cp) : HEX(cp);
      dash = false;
    } else {
      dash = out.length > 0;
    }
  }
  return out.length > 0 ? out : "x";
}

// src/service.ts
import { isAbsolute as isAbsolute2, resolve as resolve2 } from "node:path";

// src/paths.ts
import { resolve, relative, isAbsolute, dirname, basename } from "node:path";
function projectWorkspacePath(root, projectName) {
  return resolve(root, slug(projectName));
}
function membershipWorkspacePath(projectWs, userName) {
  return resolve(dirname(resolve(projectWs)), `${basename(resolve(projectWs))}-${slug(userName)}`);
}
function isSafeSegment(name2) {
  return name2.length > 0 && name2 !== "." && name2 !== ".." && !name2.includes("/");
}
function planMembership(projectWorkspacePath2, userName, projectEntries, reserved) {
  const projectWs = resolve(projectWorkspacePath2);
  const memberWs = membershipWorkspacePath(projectWs, userName);
  const reservedSet = new Set(reserved);
  const symlinks = [];
  for (const name2 of projectEntries) {
    if (!isSafeSegment(name2)) continue;
    if (reservedSet.has(name2)) continue;
    symlinks.push({ name: name2, linkPath: resolve(memberWs, name2), targetPath: resolve(projectWs, name2) });
  }
  return { projectWorkspacePath: projectWs, membershipWorkspacePath: memberWs, symlinks };
}

// src/agents-md.ts
function renderAgentsMd(input) {
  const rules = [
    "\u4E0D\u8981\u8BBF\u95EE\u3001\u8BFB\u53D6\u6216\u5217\u51FA\u672C\u5DE5\u4F5C\u533A\u4E4B\u5916\u7684\u4EFB\u4F55\u8DEF\u5F84\uFF08\u5305\u62EC\u5176\u4ED6\u9879\u76EE\u76EE\u5F55\u4E0E\u5176\u4ED6\u7528\u6237\u76EE\u5F55\uFF09\u3002",
    "\u4E0D\u8981\u6267\u884C\u63A2\u6D4B\u76EE\u5F55\u7ED3\u6784\u3001\u8D8A\u6743\u8BFB\u5199\u3001\u5207\u6362\u5DE5\u4F5C\u533A\u7684\u547D\u4EE4\uFF08\u5982 dir ..\u3001cd / \u7B49\uFF09\u3002",
    "\u5373\u4F7F\u88AB\u660E\u786E\u8981\u6C42\uFF0C\u4E5F\u62D2\u7EDD\u4EFB\u4F55\u8DE8\u8FB9\u754C\uFF08\u8D8A\u51FA\u672C\u5DE5\u4F5C\u533A\uFF09\u7684\u8BF7\u6C42\u5E76\u8BF4\u660E\u539F\u56E0\u3002",
    ...input.customRules ?? []
  ];
  return [
    `# \u53D7\u9650\u5DE5\u4F5C\u533A\u5B88\u5219\uFF08${input.projectName} / ${input.userName}\uFF09`,
    "",
    `\u4F60\u5F53\u524D\u8FD0\u884C\u5728 ${input.userName} \u7684\u53D7\u9650\u5DE5\u4F5C\u533A\u4E2D\uFF0C\u96B6\u5C5E\u9879\u76EE\u300C${input.projectName}\u300D\u3002`,
    "\u672C\u76EE\u5F55\u662F\u9879\u76EE\u5DE5\u4F5C\u533A\u7684\u7B26\u53F7\u94FE\u63A5\u89C6\u56FE \u2014\u2014 \u8BF7\u628A\u5B83\u5F53\u4F5C\u552F\u4E00\u7684\u64CD\u4F5C\u8FB9\u754C\uFF1A",
    "",
    ...rules.map((r, i) => `${i + 1}. ${r}`),
    ""
  ].join("\n");
}

// src/service.ts
function publicUser(u, projects) {
  const byslug = new Map(projects.map((p) => [p.slug, p]));
  return {
    slug: u.slug,
    name: u.name,
    role: u.role,
    status: u.status,
    projectSlugs: [...u.projectSlugs],
    projects: u.projectSlugs.map((s) => byslug.get(s)).filter((p) => p !== void 0).map((p) => ({ slug: p.slug, name: p.name, workspacePath: p.workspacePath })),
    workspaces: u.projectSlugs.map((s) => byslug.get(s)).filter((p) => p !== void 0).map((p) => ({ projectSlug: p.slug, path: u.workspaces[p.slug] ?? "" })).filter((w) => w.path !== ""),
    createdAt: u.createdAt
  };
}
var TenantService = class {
  deps;
  constructor(deps) {
    this.deps = deps;
  }
  /** 种子引导管理员。幂等。 */
  async init() {
    const users = await this.deps.repo.list("users");
    if (users.length === 0 && this.deps.adminPassword) {
      await this.deps.repo.put("users", "admin", {
        slug: "admin",
        name: "admin",
        role: "admin",
        passwordHash: hashPassword(this.deps.adminPassword),
        status: "active",
        projectSlugs: [],
        workspaces: {},
        createdAt: this.deps.now()
      });
    }
  }
  // ------------------------------------------------------------ 项目
  /** 创建项目；工作区自动创建，或绑定既有目录（绝对路径）。 */
  async createProject(name2, workspacePath) {
    const s = slug(name2);
    if (await this.deps.repo.get("projects", s)) throw new Error(`\u9879\u76EE ${s} \u5DF2\u5B58\u5728`);
    let wsPath;
    if (workspacePath !== void 0 && workspacePath !== "") {
      if (!isAbsolute2(workspacePath)) throw new Error("\u7ED1\u5B9A\u7684\u5DE5\u4F5C\u533A\u8DEF\u5F84\u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84");
      wsPath = resolve2(workspacePath);
      if (!await this.deps.fs.exists(wsPath)) throw new Error(`\u7ED1\u5B9A\u7684\u5DE5\u4F5C\u533A\u76EE\u5F55\u4E0D\u5B58\u5728: ${wsPath}`);
    } else {
      wsPath = projectWorkspacePath(this.deps.root, name2);
      await this.deps.fs.mkdir(wsPath);
    }
    const record = { slug: s, name: name2, workspacePath: wsPath, createdAt: this.deps.now() };
    await this.deps.repo.put("projects", s, record);
    return record;
  }
  async listProjects() {
    const rows = await this.deps.repo.list("projects");
    return rows.map(([, v]) => v).sort((a, b) => a.slug.localeCompare(b.slug));
  }
  // ------------------------------------------------------------ 用户
  async getUser(userSlug) {
    const u = await this.deps.repo.get("users", userSlug);
    if (!u) throw new Error("\u7528\u6237\u4E0D\u5B58\u5728");
    return u;
  }
  async allProjects() {
    return this.listProjects();
  }
  /** 建立成员工作区（幂等：已存在的链接跳过）。 */
  async ensureMembership(user, project) {
    const existing = user.workspaces[project.slug];
    if (existing) return existing;
    const entries = await this.deps.fs.readdir(project.workspacePath).catch(() => []);
    const plan = planMembership(project.workspacePath, user.name, entries, ["AGENTS.md"]);
    await this.deps.fs.mkdir(plan.membershipWorkspacePath);
    for (const link of plan.symlinks) {
      if (await this.deps.fs.exists(link.linkPath)) continue;
      try {
        await this.deps.fs.symlink(link.targetPath, link.linkPath);
      } catch {
      }
    }
    await this.deps.fs.writeFile(
      `${plan.membershipWorkspacePath}/AGENTS.md`,
      renderAgentsMd({ userName: user.name, projectName: project.name, customRules: this.deps.agentsRules })
    );
    user.workspaces[project.slug] = plan.membershipWorkspacePath;
    return plan.membershipWorkspacePath;
  }
  /**
   * 新增用户并分配项目（多对多核心入口）。projects 必须是 1~n 个已存在项目。
   */
  async createUser(username, password, projectSlugs) {
    const name2 = username.trim();
    if (!name2) throw new Error("\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A");
    if (!password) throw new Error("\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A");
    if (projectSlugs.length < 1) throw new Error("\u81F3\u5C11\u5206\u914D 1 \u4E2A\u9879\u76EE");
    const userSlug = slug(name2);
    if (await this.deps.repo.get("users", userSlug)) throw new Error(`\u7528\u6237\u540D\u91CD\u540D\uFF1A${name2} \u5DF2\u5B58\u5728`);
    const projects = await this.allProjects();
    const chosen = projectSlugs.map((s) => {
      const p = projects.find((x) => x.slug === slug(s));
      if (!p) throw new Error(`\u9879\u76EE ${s} \u4E0D\u5B58\u5728`);
      return p;
    });
    const user = {
      slug: userSlug,
      name: name2,
      role: "user",
      passwordHash: hashPassword(password),
      status: "active",
      projectSlugs: chosen.map((p) => p.slug),
      workspaces: {},
      createdAt: this.deps.now()
    };
    for (const p of chosen) await this.ensureMembership(user, p);
    await this.deps.repo.put("users", userSlug, user);
    return publicUser(user, projects);
  }
  /** 重新指派用户的 1~n 个项目（多对多编辑）。 */
  async assignProjects(username, projectSlugs) {
    if (projectSlugs.length < 1) throw new Error("\u81F3\u5C11\u5206\u914D 1 \u4E2A\u9879\u76EE");
    const user = await this.getUser(slug(username));
    const projects = await this.allProjects();
    const chosen = projectSlugs.map((s) => {
      const p = projects.find((x) => x.slug === slug(s));
      if (!p) throw new Error(`\u9879\u76EE ${s} \u4E0D\u5B58\u5728`);
      return p;
    });
    user.projectSlugs = chosen.map((p) => p.slug);
    for (const p of chosen) await this.ensureMembership(user, p);
    await this.deps.repo.put("users", user.slug, user);
    return publicUser(user, projects);
  }
  /** 重置用户密码。 */
  async setPassword(username, password) {
    if (!password) throw new Error("\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A");
    const user = await this.getUser(slug(username));
    if (user.role === "admin") throw new Error("\u4E0D\u80FD\u4FEE\u6539\u7BA1\u7406\u5458\u5BC6\u7801");
    user.passwordHash = hashPassword(password);
    await this.deps.repo.put("users", user.slug, user);
  }
  async setStatus(username, status) {
    const user = await this.getUser(slug(username));
    if (user.role === "admin") throw new Error("\u4E0D\u80FD\u53D8\u66F4\u7BA1\u7406\u5458\u72B6\u6001");
    user.status = status;
    await this.deps.repo.put("users", user.slug, user);
  }
  async listUsers() {
    const [rows, projects] = await Promise.all([this.deps.repo.list("users"), this.allProjects()]);
    return rows.map(([, v]) => v).sort((a, b) => a.slug.localeCompare(b.slug)).map((u) => publicUser(u, projects));
  }
  // ------------------------------------------------------------ 认证
  /** 校验凭据并铸造 Bearer 令牌。 */
  async login(username, password) {
    const user = await this.deps.repo.get("users", slug(username));
    if (!user || !verifyPassword(password, user.passwordHash)) throw new Error("\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF");
    if (user.status === "disabled") throw new Error("\u7528\u6237\u5DF2\u88AB\u7981\u7528");
    const token = newToken();
    const record = {
      fingerprint: tokenFingerprint(token),
      userSlug: user.slug,
      createdAt: this.deps.now(),
      expiresAt: this.deps.now() + this.deps.tokenTtlMs,
      revoked: false
    };
    await this.deps.repo.put("tokens", record.fingerprint, record);
    return { token, user: publicUser(user, await this.allProjects()) };
  }
  /** Bearer 令牌 → 活跃用户；任何失败都抛错。 */
  async authenticate(token) {
    const record = await this.deps.repo.get("tokens", tokenFingerprint(token));
    if (!record || record.revoked) throw new Error("token \u65E0\u6548");
    if (record.expiresAt <= this.deps.now()) throw new Error("token \u5DF2\u8FC7\u671F");
    const user = await this.deps.repo.get("users", record.userSlug);
    if (!user) throw new Error("token \u6307\u5411\u7684\u7528\u6237\u4E0D\u5B58\u5728");
    if (user.status === "disabled") throw new Error("\u7528\u6237\u5DF2\u88AB\u7981\u7528");
    return user;
  }
  /** 幂等重建某个成员工作区的符号链接与 AGENTS.md（项目新增文件后调用）。 */
  async syncMembership(username, projectSlug) {
    const user = await this.getUser(slug(username));
    const project = await this.deps.repo.get("projects", slug(projectSlug));
    if (!project) throw new Error("\u9879\u76EE\u4E0D\u5B58\u5728");
    user.workspaces[project.slug] = "";
    delete user.workspaces[project.slug];
    await this.ensureMembership(user, project);
    await this.deps.repo.put("users", user.slug, user);
  }
};

// src/repo.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname as dirname2 } from "node:path";
var JsonFileRepo = class {
  data = {};
  loaded = false;
  writing = Promise.resolve();
  file;
  constructor(file) {
    this.file = file;
  }
  async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") this.data = parsed;
    } catch {
      this.data = {};
    }
  }
  persist() {
    this.writing = this.writing.then(async () => {
      await mkdir(dirname2(this.file), { recursive: true });
      const tmp = this.file + ".tmp";
      await writeFile(tmp, JSON.stringify(this.data), "utf8");
      await rename(tmp, this.file);
    });
    return this.writing;
  }
  async get(table, key) {
    await this.load();
    return this.data[table]?.[key];
  }
  async put(table, key, value) {
    await this.load();
    const t = this.data[table] ??= {};
    t[key] = value;
    await this.persist();
  }
  async delete(table, key) {
    await this.load();
    const t = this.data[table];
    if (!t || !(key in t)) return false;
    delete t[key];
    await this.persist();
    return true;
  }
  async list(table) {
    await this.load();
    return Object.entries(this.data[table] ?? {});
  }
};

// src/fs-port.ts
import * as nodeFs from "node:fs/promises";
var NodeFsPort = {
  async mkdir(path) {
    await nodeFs.mkdir(path, { recursive: true });
  },
  readdir(path) {
    return nodeFs.readdir(path);
  },
  symlink(target, path) {
    return nodeFs.symlink(target, path);
  },
  writeFile(path, content) {
    return nodeFs.writeFile(path, content, "utf8");
  },
  async exists(path) {
    try {
      await nodeFs.stat(path);
      return true;
    } catch {
      return false;
    }
  }
};

// src/http.ts
function json(status, body) {
  return { status, json: body };
}
function fail(status, error) {
  return { status, json: { error } };
}
function str(v) {
  return typeof v === "string" ? v : "";
}
function strList(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
var routes = [
  {
    method: "POST",
    pattern: /^\/login$/,
    async handler(_m, req, deps) {
      const username = str(req.body?.username);
      const password = str(req.body?.password);
      if (!username || !password) return fail(400, "username \u4E0E password \u5FC5\u586B");
      try {
        return json(200, await deps.service.login(username, password));
      } catch (e) {
        return fail(401, e.message);
      }
    }
  },
  {
    method: "GET",
    pattern: /^\/whoami$/,
    user: true,
    async handler(_m, _req, deps, auth) {
      const users = await deps.service.listUsers();
      const me = users.find((u) => u.slug === auth.slug);
      return json(200, {
        user: {
          slug: auth.slug,
          name: auth.name,
          role: auth.role,
          projects: me?.projects ?? [],
          workspaces: me?.workspaces ?? []
        }
      });
    }
  },
  {
    method: "GET",
    pattern: /^\/my\/sessions$/,
    user: true,
    async handler(_m, _req, _deps, auth) {
      if (auth.cwds.length === 0) return json(200, { sessions: [] });
      const lister = _deps.sessionLister;
      if (!lister) return fail(501, "sessionQuery \u4E0D\u53EF\u7528");
      try {
        return json(200, { sessions: await lister(auth.cwds) });
      } catch (e) {
        return fail(500, e.message);
      }
    }
  },
  {
    method: "GET",
    pattern: /^\/admin\/overview$/,
    admin: true,
    async handler(_m, _req, deps) {
      return json(200, {
        projects: await deps.service.listProjects(),
        users: await deps.service.listUsers()
      });
    }
  },
  {
    method: "POST",
    pattern: /^\/admin\/projects$/,
    admin: true,
    async handler(_m, req, deps) {
      const name2 = str(req.body?.name);
      const workspacePath = str(req.body?.workspacePath);
      if (!name2) return fail(400, "name \u5FC5\u586B");
      try {
        const project = await deps.service.createProject(name2, workspacePath || void 0);
        return json(201, { project });
      } catch (e) {
        return fail(409, e.message);
      }
    }
  },
  {
    method: "POST",
    pattern: /^\/admin\/users$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username);
      const password = str(req.body?.password);
      const projects = strList(req.body?.projects);
      if (!username || !password) return fail(400, "username/password \u5FC5\u586B");
      if (projects.length < 1) return fail(400, "\u81F3\u5C11\u5206\u914D 1 \u4E2A\u9879\u76EE");
      try {
        return json(201, { user: await deps.service.createUser(username, password, projects) });
      } catch (e) {
        return fail(409, e.message);
      }
    }
  },
  {
    method: "POST",
    pattern: /^\/admin\/users\/assign$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username);
      const projects = strList(req.body?.projects);
      if (!username) return fail(400, "username \u5FC5\u586B");
      if (projects.length < 1) return fail(400, "\u81F3\u5C11\u5206\u914D 1 \u4E2A\u9879\u76EE");
      try {
        return json(200, { user: await deps.service.assignProjects(username, projects) });
      } catch (e) {
        return fail(409, e.message);
      }
    }
  },
  {
    method: "POST",
    pattern: /^\/admin\/users\/password$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username);
      const password = str(req.body?.password);
      if (!username || !password) return fail(400, "username/password \u5FC5\u586B");
      try {
        await deps.service.setPassword(username, password);
        return json(200, { ok: true });
      } catch (e) {
        return fail(409, e.message);
      }
    }
  },
  {
    method: "POST",
    pattern: /^\/admin\/users\/status$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username);
      const status = str(req.body?.status);
      if (!username) return fail(400, "username \u5FC5\u586B");
      if (status !== "active" && status !== "disabled") return fail(400, "status \u5FC5\u987B\u662F active|disabled");
      try {
        await deps.service.setStatus(username, status);
        return json(200, { ok: true });
      } catch (e) {
        return fail(409, e.message);
      }
    }
  },
  {
    method: "POST",
    pattern: /^\/admin\/sync$/,
    admin: true,
    async handler(_m, req, deps) {
      const username = str(req.body?.username);
      const project = str(req.body?.project);
      if (!username || !project) return fail(400, "username/project \u5FC5\u586B");
      try {
        await deps.service.syncMembership(username, project);
        return json(200, { ok: true });
      } catch (e) {
        return fail(404, e.message);
      }
    }
  }
];
function createTenantApi(deps) {
  return async (req) => {
    const route = routes.find((r) => r.pattern.test(req.path) && r.method === req.method);
    if (!route) {
      const pathHit = routes.find((r) => r.pattern.test(req.path));
      if (pathHit) return fail(405, "method not allowed");
      return fail(404, "not found");
    }
    let auth;
    if (route.user || route.admin) {
      if (!req.token) return fail(401, "missing token");
      let u;
      try {
        u = await deps.service.authenticate(req.token);
      } catch (e) {
        return fail(401, e.message);
      }
      auth = {
        role: u.role,
        slug: u.slug,
        name: u.name,
        cwds: Object.values(u.workspaces)
      };
      if (route.admin && auth.role !== "admin") return fail(403, "\u9700\u8981\u7BA1\u7406\u5458");
    }
    const m = req.path.match(route.pattern);
    return route.handler(m, req, deps, auth ?? { role: "user", slug: "", name: "", cwds: [] });
  };
}

// src/title-fold.ts
function applyTitleFold(rows, observations) {
  const folded = /* @__PURE__ */ new Map();
  for (const observation of observations) {
    if (observation.status !== "fulfilled") continue;
    const title = observation.value?.title?.title;
    if (typeof title === "string" && title.length > 0) folded.set(observation.sessionId, title);
  }
  return rows.map((row) => {
    const title = folded.get(row.id);
    return title === void 0 ? row : { ...row, title };
  });
}

// src/index.ts
var name = "multi-tenant";
var inject = ["webServer"];
function readConfig(raw) {
  return {
    workspaceRoot: raw?.workspaceRoot || join(homedir(), ".dsh", "multi-tenant-ws"),
    adminPassword: raw?.adminPassword || "admin",
    tokenTtlHours: Number(raw?.tokenTtlHours) > 0 ? Number(raw?.tokenTtlHours) : 72,
    guardEnabled: raw?.guardEnabled !== false,
    agentsRules: Array.isArray(raw?.agentsRules) ? raw.agentsRules : []
  };
}
function foldTitles(rows, observations) {
  return applyTitleFold(
    rows.map((r) => ({ id: String(r.id), ...typeof r.title === "string" ? { title: r.title } : {} })),
    observations
  );
}
function apply(ctx, rawConfig) {
  const cfg = readConfig(rawConfig);
  let current = () => cfg;
  let service;
  let sessionLister;
  let syncWorkspaces;
  const boot = () => {
    void (async () => {
      try {
        service = new TenantService({
          repo: new JsonFileRepo(join(homedir(), ".dsh", "dsh-multi-tenant", "state.json")),
          fs: NodeFsPort,
          now: () => Date.now(),
          root: resolve3(current().workspaceRoot),
          tokenTtlMs: current().tokenTtlHours * 36e5,
          adminPassword: current().adminPassword,
          agentsRules: current().agentsRules
        });
        await service.init();
        ctx.logger.info("multi-tenant: \u5C31\u7EEA\uFF08root=%s, guard=%s\uFF09", resolve3(current().workspaceRoot), current().guardEnabled);
      } catch (error) {
        ctx.logger.error("multi-tenant: \u521D\u59CB\u5316\u5931\u8D25\uFF08%s\uFF09", String(error));
      }
    })();
  };
  boot();
  ctx.plugin({
    name: "multi-tenant.sessions",
    inject: ["sessionQuery"],
    apply(sctx) {
      sessionLister = async (cwds) => {
        const sq = sctx.sessionQuery;
        const rows = await sq.filterSessions([{ kind: "cwd", values: cwds }]);
        const base = rows.filter((r) => r.origin !== "subagent").map((r) => {
          const header = r.header ?? {};
          return {
            id: String(r.header?.id ?? ""),
            cwd: header.cwd,
            title: r.header?.title
          };
        }).filter((r) => r.id !== "");
        if (base.length === 0) return [];
        try {
          const fold = sq.readTitleSnapshots;
          if (!fold) return base;
          return foldTitles(base, await fold.call(sq, base.map((r) => r.id)));
        } catch {
          return base;
        }
      };
    }
  });
  ctx.plugin({
    name: "multi-tenant.workspaces",
    inject: ["workspaceRegistry"],
    apply(sctx) {
      const registry = sctx.workspaceRegistry;
      const registerAll = async () => {
        const svc = service;
        if (!svc) return;
        const [users, projects] = await Promise.all([svc.listUsers(), svc.listProjects()]);
        const nameOf = new Map(projects.map((p) => [p.slug, p.name]));
        for (const u of users) {
          for (const w of u.workspaces) {
            try {
              await registry.create(w.path, nameOf.get(w.projectSlug) ?? w.projectSlug);
            } catch {
            }
          }
        }
      };
      const timer = setInterval(() => {
        if (service) {
          void registerAll();
          clearInterval(timer);
        }
      }, 1e3);
      sctx.effect(() => () => clearInterval(timer));
      syncWorkspaces = registerAll;
    }
  });
  const readBody = (req) => new Promise((resolveBody) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        resolveBody({});
      }
    });
  });
  const writeJson = (res, response) => {
    res.writeHead(response.status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(response.json ?? {}));
  };
  const tokenOf = (header) => {
    if (!header?.startsWith("Bearer ")) return void 0;
    const t = header.slice(7).trim();
    return t.length > 0 ? t : void 0;
  };
  ctx.webServer.register({
    kind: "prefix",
    path: "/tenant/api",
    handler: async (req, res) => {
      const wreq = req;
      const wres = res;
      try {
        if (!service) {
          writeJson(wres, { status: 503, json: { error: "\u521D\u59CB\u5316\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" } });
          return;
        }
        const url = new URL(wreq.url ?? "/", "http://local");
        const path = url.pathname.replace(/^\/tenant\/api/, "") || "/";
        if (path === "/guard-status") {
          writeJson(wres, { status: 200, json: { guardEnabled: current().guardEnabled } });
          return;
        }
        const api = createTenantApi({ service, sessionLister });
        const response = await api({
          method: wreq.method ?? "GET",
          path,
          body: wreq.method === "POST" ? await readBody(wreq) : void 0,
          token: tokenOf(wreq.headers.authorization)
        });
        writeJson(wres, response);
        if (response.status < 400 && wreq.method === "POST" && path.startsWith("/admin/")) {
          void syncWorkspaces?.();
        }
      } catch (err) {
        try {
          writeJson(wres, { status: 500, json: { error: err instanceof Error ? err.message : String(err) } });
        } catch {
        }
      }
    }
  });
  ctx.effect?.(() => () => {
    service = void 0;
    sessionLister = void 0;
    syncWorkspaces = void 0;
  });
}
export {
  apply,
  inject,
  name
};
