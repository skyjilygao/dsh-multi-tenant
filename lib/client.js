window.__ModuleLoader__.load({ id: "dsh-multi-tenant", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react4 = require("react");

// src/client/auth-gate.tsx
var import_react = require("react");

// src/client/api.ts
var ApiError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
  status;
};
var TOKEN_KEY = "dsh-multi-tenant-token";
async function callApi(fetchLike, path, opts = {}) {
  const headers = {};
  let body;
  if (opts.body !== void 0) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetchLike(path, { method: opts.method ?? "GET", headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
  return json;
}
function readStoredToken(storage) {
  return storage.getItem(TOKEN_KEY);
}
function writeStoredToken(storage, token) {
  storage.setItem(TOKEN_KEY, token);
}
function clearStoredToken(storage) {
  storage.removeItem(TOKEN_KEY);
}
var browserDeps = {
  fetch: (input3, init) => globalThis.fetch(input3, init),
  storage: globalThis.localStorage,
  reload: () => globalThis.location?.reload()
};
async function whoAmI(deps) {
  const token = readStoredToken(deps.storage);
  if (!token) return null;
  try {
    const res = await callApi(deps.fetch, "/tenant/api/whoami", { token });
    return res.user ?? null;
  } catch {
    return null;
  }
}
async function login(deps, username, password) {
  const res = await callApi(deps.fetch, "/tenant/api/login", {
    method: "POST",
    body: { username, password }
  });
  writeStoredToken(deps.storage, res.token);
  authEvents.emit("changed");
  return res.user;
}
function logout(deps) {
  clearStoredToken(deps.storage);
  authEvents.emit("changed");
  deps.reload();
}
var AuthEventBus = class {
  target = typeof EventTarget !== "undefined" ? new EventTarget() : void 0;
  handlers = /* @__PURE__ */ new Set();
  on(event, handler) {
    if (this.target) {
      this.target.addEventListener(event, handler);
      return () => this.target.removeEventListener(event, handler);
    }
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  emit(event) {
    if (this.target) {
      this.target.dispatchEvent(new Event(event));
    } else {
      for (const h of [...this.handlers]) h();
    }
  }
};
var authEvents = new AuthEventBus();

// src/client/auth-gate.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var veil = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #16213e 0%, #1f3a6e 60%, #2f56cf 140%)"
};
var card = {
  background: "#fff",
  borderRadius: 14,
  padding: "36px 32px",
  width: 360,
  boxShadow: "0 18px 50px rgba(0,0,0,.35)",
  fontFamily: "inherit"
};
var title = { fontSize: 19, margin: 0, marginBottom: 6 };
var subtitle = { color: "#6b7689", fontSize: 13, margin: 0, marginBottom: 22 };
var label = { display: "block", fontSize: 13, color: "#6b7689", margin: "12px 0 6px" };
var input = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e3e8f0",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box"
};
var submit = {
  width: "100%",
  marginTop: 18,
  padding: 11,
  background: "#3b6cf6",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer"
};
var error = { color: "#e5484d", fontSize: 13, marginTop: 10, marginBottom: 0 };
var checking = { color: "#fff", fontSize: 14, opacity: 0.9 };
function AuthGateView(props) {
  const t = props.t;
  const [err, setErr] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  if (props.mode === "hidden") return null;
  if (props.mode === "checking") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: veil, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: checking, role: "status", children: t("gate.checking") }) });
  }
  const onSubmit = (event) => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    setBusy(true);
    setErr("");
    void login(props.deps, username, password).catch((e) => setErr(e instanceof ApiError ? e.message : String(e))).finally(() => setBusy(false));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: veil, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { style: card, "aria-label": t("gate.title"), onSubmit, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { style: title, children: t("gate.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: subtitle, children: t("gate.subtitle") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: label, htmlFor: "mt-gate-username", children: t("gate.username") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: "mt-gate-username", name: "username", style: input, type: "text", autoComplete: "username" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: label, htmlFor: "mt-gate-password", children: t("gate.password") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: "mt-gate-password", name: "password", style: input, type: "password", autoComplete: "current-password" }),
    err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: error, role: "alert", children: err }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: submit, type: "submit", disabled: busy, children: t(busy ? "gate.signingIn" : "gate.submit") })
  ] }) });
}

// src/client/admin-section.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var section = { padding: 20, fontFamily: "inherit", fontSize: 13, maxWidth: 860 };
var header = { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 };
var title2 = { fontSize: 17, margin: 0 };
var block = { border: "1px solid #e3e8f0", borderRadius: 10, padding: 16, marginBottom: 14 };
var blockTitle = { fontSize: 14, margin: "0 0 10px" };
var form = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 10 };
var label2 = { display: "block", fontSize: 12, color: "#6b7689", margin: "0 0 4px" };
var fieldWrap = { display: "flex", flexDirection: "column" };
var input2 = {
  padding: "8px 10px",
  border: "1px solid #e3e8f0",
  borderRadius: 8,
  fontSize: 13,
  outline: "none"
};
var primary = {
  padding: "8px 16px",
  background: "#3b6cf6",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  cursor: "pointer"
};
var secondary = {
  padding: "5px 12px",
  background: "#fff",
  border: "1px solid #e3e8f0",
  borderRadius: 8,
  fontSize: 12,
  cursor: "pointer",
  color: "inherit"
};
var listEl = { listStyle: "none", margin: 0, padding: 0 };
var rowEl = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "8px 2px",
  borderBottom: "1px solid #f0f2f7"
};
var dim = { color: "#8a93a6" };
var note = { color: "#6b7689", fontSize: 13 };
var okStyle = { color: "#2f9e6e", fontSize: 13, margin: "0 0 10px" };
var errorStyle = { color: "#e5484d", fontSize: 13, margin: "0 0 10px" };
var checkboxes = { display: "flex", flexWrap: "wrap", gap: "4px 14px" };
var slugStyle = { color: "#8a93a6", fontSize: 11, fontFamily: "monospace" };
function AdminSectionView(props) {
  const t = props.t;
  const [identity, setIdentity] = (0, import_react2.useState)();
  const [projects, setProjects] = (0, import_react2.useState)([]);
  const [users, setUsers] = (0, import_react2.useState)([]);
  const [message, setMessage] = (0, import_react2.useState)(null);
  const [editing, setEditing] = (0, import_react2.useState)(null);
  const token = () => readStoredToken(props.deps.storage) ?? "";
  const api = (path, body) => callApi(props.deps.fetch, path, { method: "POST", body, token: token() });
  const refresh = async () => {
    const overview = await callApi(props.deps.fetch, "/tenant/api/admin/overview", { token: token() });
    setProjects(overview.projects ?? []);
    setUsers(overview.users ?? []);
  };
  (0, import_react2.useEffect)(() => {
    let alive = true;
    void whoAmI(props.deps).then(async (me) => {
      if (!alive) return;
      setIdentity(me);
      if (me?.role === "admin") await refresh().catch(() => {
      });
    });
    return () => {
      alive = false;
    };
  }, [props.deps]);
  if (identity === void 0) return null;
  if (identity === null) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: note, role: "status", children: t("admin.notSignedIn") });
  const run = (action, okText) => {
    setMessage(null);
    void action().then(async () => {
      if (okText) setMessage({ kind: "ok", text: okText });
      await refresh();
    }).catch((err) => {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    });
  };
  const onCreateProject = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = { name: String(data.get("name") ?? "") };
    const path = String(data.get("workspacePath") ?? "").trim();
    if (path) body.workspacePath = path;
    run(async () => {
      await api("/tenant/api/admin/projects", body);
    });
  };
  const onCreateUser = (event) => {
    event.preventDefault();
    const form2 = event.currentTarget;
    const data = new FormData(form2);
    const chosen = [...form2.querySelectorAll('input[name="projects"]:checked')].map((c) => c.value);
    run(async () => {
      await api("/tenant/api/admin/users", {
        username: String(data.get("username") ?? ""),
        password: String(data.get("password") ?? ""),
        projects: chosen
      });
      form2.reset();
    });
  };
  const onAssign = (event) => {
    event.preventDefault();
    if (editing === null) return;
    const chosen = [...event.currentTarget.querySelectorAll('input[name="projects"]:checked')].map((c) => c.value);
    run(async () => {
      await api("/tenant/api/admin/users/assign", { username: editing, projects: chosen });
    });
    setEditing(null);
  };
  const onResetPassword = (event) => {
    event.preventDefault();
    if (editing === null) return;
    const data = new FormData(event.currentTarget);
    run(async () => {
      await api("/tenant/api/admin/users/password", { username: editing, password: String(data.get("password") ?? "") });
    });
  };
  const headerEl = /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { style: header, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: title2, children: t("section.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { style: identity, children: [
        t("admin.identity"),
        "\uFF1A",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: identity.name }),
        "\uFF08",
        t(identity.role === "admin" ? "admin.role.admin" : "admin.role.user"),
        "\uFF09"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { flex: 1 } }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: secondary, onClick: () => {
      logout(props.deps);
      props.close();
    }, children: t("admin.logout") })
  ] });
  if (identity.role !== "admin") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
      headerEl,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: note, role: "status", children: t("admin.denied") })
    ] });
  }
  const projectCheckboxes = (selected) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: checkboxes, children: projects.map((p) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", name: "projects", value: p.slug, defaultChecked: selected.includes(p.slug) }),
    p.name
  ] }, p.slug)) });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
    headerEl,
    message ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: message.kind === "error" ? errorStyle : okStyle, role: message.kind === "error" ? "alert" : "status", children: message.text }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { style: block, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { style: blockTitle, children: t("admin.projects") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { style: listEl, children: projects.map((p) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { style: rowEl, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        p.name,
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { style: slugStyle, children: p.workspacePath ?? p.slug })
      ] }) }, p.slug)) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { style: form, onSubmit: onCreateProject, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: fieldWrap, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: label2, htmlFor: "mt-project-name", children: t("admin.projectName") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { id: "mt-project-name", name: "name", style: input2, type: "text" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: fieldWrap, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: label2, htmlFor: "mt-project-path", children: t("admin.projectPath") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { id: "mt-project-path", name: "workspacePath", style: { ...input2, width: 280 }, type: "text", placeholder: "D:\\workspaces\\my-app" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "submit", style: primary, children: t("admin.createProject") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { style: block, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { style: blockTitle, children: t("admin.users") }),
      projects.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: note, children: t("admin.noProjects") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { style: { ...form, flexDirection: "column", alignItems: "stretch" }, onSubmit: onCreateUser, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: fieldWrap, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: label2, htmlFor: "mt-user-name", children: t("admin.username") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { id: "mt-user-name", name: "username", style: input2, type: "text" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: fieldWrap, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: label2, htmlFor: "mt-user-password", children: t("admin.password") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { id: "mt-user-password", name: "password", style: input2, type: "password" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: label2, children: t("admin.userProjects") }),
          projectCheckboxes([])
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "submit", style: { ...primary, alignSelf: "flex-start" }, children: t("admin.createUser") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { style: listEl, children: users.filter((u) => u.role === "user").map((u) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { style: rowEl, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          u.name,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: dim, children: [
            " \xB7 ",
            u.projectSlugs.map((s) => projects.find((p) => p.slug === s)?.name ?? s).join("\u3001") || "\u2014",
            " \xB7 ",
            t(u.status === "active" ? "admin.status.active" : "admin.status.disabled")
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { display: "flex", gap: 6, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: secondary, onClick: () => setEditing(editing === u.slug ? null : u.slug), children: t("admin.action.assign") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              style: secondary,
              onClick: () => {
                void run(async () => {
                  await api("/tenant/api/admin/users/status", { username: u.name, status: u.status === "active" ? "disabled" : "active" });
                });
              },
              children: t(u.status === "active" ? "admin.action.disable" : "admin.action.enable")
            }
          ),
          editing === u.slug ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { style: { display: "flex", gap: 6 }, onSubmit: onAssign, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "hidden", name: "username", value: u.name }),
              projectCheckboxes(u.projectSlugs),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "submit", style: primary, children: t("admin.save") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: secondary, onClick: () => setEditing(null), children: t("admin.cancel") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { style: { display: "flex", gap: 6 }, onSubmit: onResetPassword, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "hidden", name: "username", value: u.name }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { name: "password", style: input2, type: "text", placeholder: t("admin.password") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "submit", style: secondary, children: t("admin.action.resetPwd") })
            ] }),
            u.projectSlugs.map((ps) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                style: secondary,
                onClick: () => {
                  void run(async () => {
                    await api("/tenant/api/admin/sync", { username: u.name, project: ps });
                  }, ps);
                },
                children: [
                  t("admin.action.sync"),
                  "\xB7",
                  ps
                ]
              },
              ps
            ))
          ] }) : null
        ] })
      ] }, u.slug)) })
    ] })
  ] });
}

// src/client/restricted.tsx
var import_react3 = require("react");

// src/client/sidebar-styles.ts
var MT = {
  root: "mt-tenant-ws-root",
  header: "mt-tenant-ws-header",
  list: "mt-tenant-ws-list",
  group: "mt-tenant-ws-group",
  project: "mt-tenant-ws-project",
  projectActive: "mt-tenant-ws-project-active",
  slot: "mt-tenant-ws-slot",
  folder: "mt-tenant-ws-folder",
  chevron: "mt-tenant-ws-chevron",
  arrow: "mt-tenant-ws-arrow",
  arrowOpen: "mt-tenant-ws-arrow-open",
  title: "mt-tenant-ws-title",
  actions: "mt-tenant-ws-actions",
  iconButton: "mt-tenant-ws-icon-button",
  session: "mt-tenant-ws-session",
  sessionSelected: "mt-tenant-ws-session-selected",
  sessionTitle: "mt-tenant-ws-session-title",
  dot: "mt-tenant-ws-dot",
  empty: "mt-tenant-ws-empty",
  picker: "mt-tenant-ws-picker",
  badge: "mt-tenant-ws-badge",
  badgeName: "mt-tenant-ws-badge-name",
  logout: "mt-tenant-ws-logout"
};
var TAG_ID = "dsh-multi-tenant/sidebar.css";
var CSS = `
.${MT.root}{box-sizing:border-box;display:flex;flex-direction:column;flex:1;min-height:0;padding-right:var(--dsh-sidebar-inline-padding,12px)}
.${MT.header}{box-sizing:border-box;display:flex;align-items:center;flex:none;height:36px;gap:4px;margin:0 0 4px;padding-left:4px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;white-space:nowrap;overflow:hidden}
.${MT.list}{display:flex;flex-direction:column;flex:1;min-height:0;overflow-y:auto;margin-left:-4px;padding:0 0 16px 4px}
.${MT.group}{display:flex;flex-direction:column;position:relative}
.${MT.group}+.${MT.group}{margin-top:4px}
.${MT.project}{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;height:34px;margin:0;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;user-select:none}
.${MT.project}:hover{background:var(--dsw-alias-interactive-bg-hover)}
.${MT.slot}{display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px;height:20px;color:var(--dsw-alias-label-tertiary)}
.${MT.projectActive} .${MT.folder}{color:var(--dsw-alias-state-business-primary)}
.${MT.chevron}{display:none}
.${MT.project}:hover .${MT.folder}{display:none}
.${MT.project}:hover .${MT.chevron}{display:inline-flex}
.${MT.arrow}{transition:transform .15s ease}
.${MT.arrowOpen}{transform:rotate(90deg)}
.${MT.title}{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}
.${MT.actions}{display:none;align-items:center;gap:12px;flex:none;height:20px}
.${MT.project}:hover .${MT.actions},.${MT.session}:hover .${MT.actions}{display:inline-flex}
.${MT.iconButton}{display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.${MT.iconButton}:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.${MT.session}{box-sizing:border-box;display:flex;align-items:center;gap:0;width:100%;height:32px;margin:0;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;user-select:none;animation:mt-tenant-row-in .15s ease}
.${MT.session}:hover,.${MT.sessionSelected}{background:var(--dsw-alias-interactive-bg-hover)}
.${MT.sessionTitle}{flex:1;min-width:0;margin:0 6px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}
.${MT.dot}{width:7px;height:7px;border-radius:999px;background:var(--dsw-alias-state-business-primary)}
@keyframes mt-tenant-row-in{0%{opacity:0}}
.${MT.empty}{color:var(--dsw-alias-label-tertiary);margin:0;padding:16px 12px;font-size:13px;line-height:20px}
.${MT.picker}{position:fixed;z-index:10000;box-sizing:border-box;min-width:200px;max-height:320px;overflow-y:auto;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-specific-menu,var(--dsw-specific-sidebar-fill,#fff));box-shadow:0 12px 32px rgba(0,0,0,.18)}
.${MT.badge}{display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.${MT.badgeName}{color:var(--dsw-alias-label-primary);font-weight:600}
.${MT.logout}{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer}
.${MT.logout}:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
`;
var injected = false;
function ensureTenantStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-multi-tenant";
  tag.dataset.pluginCss = TAG_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
function cx(...parts) {
  return parts.filter((p) => typeof p === "string" && p.length > 0).join(" ");
}

// src/client/primitives.ts
function loadTable() {
  try {
    if (typeof require === "function") {
      return require("@deepseek-ai/dsh-client-ui-primitives") ?? {};
    }
  } catch {
  }
  return {};
}
var TABLE = loadTable();
function icon(name) {
  const value = TABLE[name];
  return typeof value === "function" ? value : void 0;
}
var IconFolderOpen = icon("IconFolderOpen16");
var IconFolderClose = icon("IconFolderClose16");
var IconTriangleRight = icon("IconTriangleRightFill14");
var IconPlus = icon("IconPlusOutline16");

// src/client/icons.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function FallbackFolder() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "path",
    {
      d: "M1.5 4.2c0-.6.5-1.1 1.1-1.1h2.8c.4 0 .7.2.9.5l.6.9h5.5c.6 0 1.1.5 1.1 1.1v6.2c0 .6-.5 1.1-1.1 1.1H2.6c-.6 0-1.1-.5-1.1-1.1V4.2Z",
      fill: "currentColor",
      opacity: "0.9"
    }
  ) });
}
function FallbackArrow() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M6 3.6 11 8l-5 4.4V3.6Z", fill: "currentColor" }) });
}
function FallbackPlus() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "path",
    {
      d: "M8 3.2v9.6M3.2 8h9.6",
      stroke: "currentColor",
      strokeWidth: "1.4",
      strokeLinecap: "round",
      fill: "none"
    }
  ) });
}
function FolderIcon({ open }) {
  const Comp = open ? IconFolderOpen ?? IconFolderClose : IconFolderClose ?? IconFolderOpen;
  if (Comp !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Comp, {});
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FallbackFolder, {});
}
function ArrowIcon({ open, className }) {
  const Comp = IconTriangleRight;
  if (Comp !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Comp, { className });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FallbackArrow, {}) });
}
function PlusIcon() {
  const Comp = IconPlus;
  if (Comp !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Comp, {});
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FallbackPlus, {});
}

// src/client/restricted.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function isOwnCwd(user, cwd) {
  if (!cwd) return false;
  return user.workspaces.some((w) => w.path === cwd);
}
function RestrictedWorkspacesView(props) {
  const listState = props.useSessions((s) => s);
  const wsState = props.useWorkspaces((s) => s);
  const [collapsed, setCollapsed] = (0, import_react3.useState)({});
  const ownPaths = new Set(props.user.workspaces.map((w) => w.path));
  const archived = new Set(wsState.archivedSessionIds ?? []);
  const visible = (row) => row !== void 0 && row.origin !== "subagent" && !archived.has(row.id) && (row.blank !== true || listState.current === row.id);
  const accounted = /* @__PURE__ */ new Set();
  const groups = wsState.items.filter((w) => ownPaths.has(w.path)).map((w) => {
    const rows = [];
    for (const id of w.sessionIds ?? []) {
      if (accounted.has(id)) continue;
      accounted.add(id);
      const row = listState.byId[id];
      if (visible(row)) rows.push(row);
    }
    for (const id of listState.ids) {
      if (accounted.has(id)) continue;
      const row = listState.byId[id];
      if (row?.cwd !== w.path || !visible(row)) continue;
      accounted.add(id);
      rows.push(row);
    }
    return {
      key: w.workspaceId,
      id: w.workspaceId,
      name: w.title !== "" ? w.title : w.path,
      rows,
      active: listState.current !== void 0 && rows.some((r) => r.id === listState.current)
    };
  });
  const toggle = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !(prev[key] === true) }));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: MT.root, "data-wide": props.wide ? "true" : void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: MT.header, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: props.t("browser.section") }) }),
    groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: MT.empty, children: wsState.phase !== void 0 && wsState.phase !== "ready" ? props.t("browser.loading") : props.t("browser.noProjects") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: MT.list, role: "tree", "aria-label": props.t("browser.section"), children: groups.map((g) => {
      const open = collapsed[g.key] !== true;
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: MT.group, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            className: cx(MT.project, g.active && MT.projectActive),
            role: "treeitem",
            "aria-expanded": open,
            tabIndex: 0,
            onClick: () => toggle(g.key),
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle(g.key);
              }
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: cx(MT.slot, MT.folder), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FolderIcon, { open }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: cx(MT.slot, MT.chevron), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ArrowIcon, { open, className: cx(MT.arrow, open && MT.arrowOpen) }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: MT.title, children: g.name }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: MT.actions, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "button",
                {
                  type: "button",
                  className: MT.iconButton,
                  title: props.t("browser.newSession"),
                  "aria-label": props.t("browser.newSession"),
                  onClick: (event) => {
                    event.stopPropagation();
                    props.newSession(g.id);
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PlusIcon, {})
                }
              ) })
            ]
          }
        ),
        open ? g.rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            className: cx(MT.session, listState.current === r.id && MT.sessionSelected),
            role: "treeitem",
            "aria-selected": listState.current === r.id,
            onClick: () => props.openSession(r.id),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: MT.slot, children: r.running === true ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: MT.dot, "aria-hidden": "true" }) : null }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: MT.sessionTitle, children: r.blank === true ? props.t("browser.newSession") : r.title ?? props.titles?.[r.id] ?? r.displayTitle })
            ]
          },
          r.id
        )) : null
      ] }, g.key);
    }) })
  ] });
}
function useColdSessionTitles(user, deps) {
  const [titles, setTitles] = (0, import_react3.useState)({});
  (0, import_react3.useEffect)(() => {
    setTitles({});
    if (user === void 0) return;
    let cancelled = false;
    const token = readStoredToken(deps.storage);
    if (token === null) return;
    void callApi(deps.fetch, "/tenant/api/my/sessions", { token }).then((res) => {
      if (cancelled) return;
      const sessions = res.sessions ?? [];
      const map = {};
      for (const s of sessions) {
        if (typeof s.id === "string" && typeof s.title === "string" && s.title.length > 0) map[s.id] = s.title;
      }
      setTitles(map);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [user?.slug]);
  return titles;
}
function RestrictedSettingsView() {
  return null;
}
function guardCurrentSession(list, allowedCwds, clear) {
  if (list.current === void 0) return false;
  const currentRow = list.byId[list.current];
  if (currentRow !== void 0 && currentRow.cwd !== void 0 && allowedCwds.includes(currentRow.cwd)) return false;
  clear();
  return true;
}
var PICKER_GAP = 6;
var PICKER_MAX_HEIGHT = 320;
var PICKER_MIN_LEFT = 8;
function pickerPosition(rect, viewport) {
  const dropTop = rect.bottom + PICKER_GAP;
  const flipUp = dropTop + PICKER_MAX_HEIGHT > viewport.height;
  const rawTop = flipUp ? rect.top - PICKER_GAP - PICKER_MAX_HEIGHT : dropTop;
  const top = Math.max(rawTop, PICKER_MIN_LEFT);
  const left = Math.max(rect.left, PICKER_MIN_LEFT);
  return { top, left, minWidth: Math.max(Math.round(rect.width), 200) };
}
function RestrictedPickerView(props) {
  const [anchorBox, setAnchorBox] = (0, import_react3.useState)();
  (0, import_react3.useLayoutEffect)(() => {
    if (!props.open) return;
    const el = props.anchorRef?.current;
    if (!el) {
      setAnchorBox(void 0);
      return;
    }
    setAnchorBox(pickerPosition(el.getBoundingClientRect(), { height: window.innerHeight }));
  }, [props.open, props.anchorRef]);
  const items = props.useWorkspaces((s) => s.items);
  if (!props.open) return null;
  const mine = items.filter((w) => isOwnCwd(props.user, w.path));
  const anchored = anchorBox !== void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      className: MT.picker,
      style: anchored ? { top: anchorBox.top, left: anchorBox.left, minWidth: anchorBox.minWidth } : void 0,
      role: "menu",
      "aria-label": props.t("browser.section"),
      children: mine.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: MT.empty, children: props.t("picker.missing") }) : mine.map((w) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          className: cx(MT.session, props.selectedId === w.workspaceId && MT.sessionSelected),
          role: "menuitem",
          tabIndex: 0,
          onClick: () => {
            props.onPick(w.workspaceId);
            props.onClose();
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: MT.slot, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FolderIcon, { open: false }) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: MT.sessionTitle, children: w.title !== "" ? w.title : w.path })
          ]
        },
        w.workspaceId
      ))
    }
  );
}
function UserBadgeView(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: MT.badge, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: MT.badgeName, children: props.user.name }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: MT.logout, onClick: () => logout(props.deps), children: props.t("badge.logout") })
  ] });
}

// src/client/identity.ts
async function resolveIdentity(deps) {
  let guardEnabled = false;
  try {
    const res = await deps.fetch("/tenant/api/guard-status", { method: "GET" });
    const json = await res.json().catch(() => ({}));
    guardEnabled = res.ok && json.guardEnabled === true;
  } catch {
    return { kind: "guard-off" };
  }
  if (!guardEnabled) return { kind: "guard-off" };
  const token = readStoredToken(deps.storage);
  if (token === null) return { kind: "anonymous" };
  try {
    const res = await deps.fetch("/tenant/api/whoami", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` }
    });
    if (!res.ok) return { kind: "anonymous" };
    const json = await res.json();
    const user = json.user;
    if (!user || user.role !== "user" && user.role !== "admin") return { kind: "anonymous" };
    return user.role === "admin" ? { kind: "admin", user } : { kind: "user", user };
  } catch {
    return { kind: "anonymous" };
  }
}
function watchIdentity(deps, publish) {
  let disposed = false;
  publish({ kind: "resolving" });
  const rerun = () => {
    void resolveIdentity(deps).then((state) => {
      if (!disposed) publish(state);
    });
  };
  rerun();
  const off = authEvents.on("changed", rerun);
  return () => {
    disposed = true;
    off();
  };
}

// src/client/locales.ts
var zh = {
  "section.title": "\u591A\u79DF\u6237\uFF1A\u9879\u76EE\u4E0E\u7528\u6237",
  "gate.checking": "\u6B63\u5728\u68C0\u67E5\u767B\u5F55\u72B6\u6001\u2026",
  "gate.title": "DeepSeek Harness \xB7 \u591A\u79DF\u6237",
  "gate.subtitle": "\u8BF7\u767B\u5F55\u4EE5\u7EE7\u7EED\uFF08\u9ED8\u8BA4\u7BA1\u7406\u5458 admin/admin\uFF09",
  "gate.username": "\u7528\u6237\u540D",
  "gate.password": "\u5BC6\u7801",
  "gate.submit": "\u767B \u5F55",
  "gate.signingIn": "\u767B\u5F55\u4E2D\u2026",
  "browser.section": "\u5DE5\u4F5C\u533A",
  "browser.newSession": "\u65B0\u4F1A\u8BDD",
  "browser.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "browser.noProjects": "\u5C1A\u672A\u5206\u914D\u5DE5\u4F5C\u533A\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458",
  "picker.missing": "\u672A\u627E\u5230\u4F60\u7684\u5DE5\u4F5C\u533A\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u540C\u6B65",
  "badge.logout": "\u9000\u51FA",
  "admin.notSignedIn": "\u672A\u767B\u5F55 \u2014\u2014 \u8BF7\u5148\u901A\u8FC7\u767B\u5F55\u95E8\u767B\u5F55\u3002",
  "admin.denied": "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650\u3002",
  "admin.identity": "\u5F53\u524D\u8EAB\u4EFD",
  "admin.role.admin": "\u7BA1\u7406\u5458",
  "admin.role.user": "\u666E\u901A\u7528\u6237",
  "admin.logout": "\u9000\u51FA\u767B\u5F55",
  "admin.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "admin.projects": "\u9879\u76EE\u7BA1\u7406",
  "admin.projectName": "\u9879\u76EE\u540D\u79F0",
  "admin.projectPath": "\u7ED1\u5B9A\u76EE\u5F55\uFF08\u53EF\u9009\uFF0C\u7EDD\u5BF9\u8DEF\u5F84\uFF09",
  "admin.createProject": "\u521B\u5EFA\u9879\u76EE",
  "admin.users": "\u7528\u6237\u7BA1\u7406\uFF08\u5206\u914D 1~n \u4E2A\u9879\u76EE\uFF09",
  "admin.username": "\u7528\u6237\u540D",
  "admin.password": "\u5BC6\u7801",
  "admin.userProjects": "\u5206\u914D\u9879\u76EE\uFF08\u53EF\u591A\u9009\uFF0C\u81F3\u5C11 1 \u4E2A\uFF09",
  "admin.createUser": "\u521B\u5EFA\u7528\u6237",
  "admin.role": "\u89D2\u8272",
  "admin.status": "\u72B6\u6001",
  "admin.status.active": "\u542F\u7528",
  "admin.status.disabled": "\u7981\u7528",
  "admin.action.disable": "\u7981\u7528",
  "admin.action.enable": "\u542F\u7528",
  "admin.action.assign": "\u6539\u6D3E\u9879\u76EE",
  "admin.action.resetPwd": "\u91CD\u7F6E\u5BC6\u7801",
  "admin.action.sync": "\u540C\u6B65\u94FE\u63A5",
  "admin.save": "\u4FDD\u5B58",
  "admin.cancel": "\u53D6\u6D88",
  "admin.noProjects": "\u8FD8\u6CA1\u6709\u9879\u76EE\uFF0C\u8BF7\u5148\u521B\u5EFA\u9879\u76EE\u3002",
  "admin.tokenNote": "\u4EE4\u724C\u4EC5\u521B\u5EFA\u65F6\u663E\u793A\u4E00\u6B21\u3002"
};
var en = {
  "section.title": "Multi-Tenant: Projects & Users",
  "gate.checking": "Checking sign-in\u2026",
  "gate.title": "DeepSeek Harness \xB7 Multi-Tenant",
  "gate.subtitle": "Sign in to continue (bootstrap admin: admin/admin)",
  "gate.username": "Username",
  "gate.password": "Password",
  "gate.submit": "Sign in",
  "gate.signingIn": "Signing in\u2026",
  "browser.section": "Workspaces",
  "browser.newSession": "New session",
  "browser.loading": "Loading\u2026",
  "browser.noProjects": "No workspaces assigned \u2014 contact an administrator",
  "picker.missing": "Workspace not found \u2014 ask an admin to sync",
  "badge.logout": "Sign out",
  "admin.notSignedIn": "Not signed in \u2014 use the login gate first.",
  "admin.denied": "Administrator permission required.",
  "admin.identity": "Identity",
  "admin.role.admin": "Admin",
  "admin.role.user": "User",
  "admin.logout": "Sign out",
  "admin.loading": "Loading\u2026",
  "admin.projects": "Projects",
  "admin.projectName": "Project name",
  "admin.projectPath": "Bind directory (optional, absolute path)",
  "admin.createProject": "Create project",
  "admin.users": "Users (assign 1~n projects)",
  "admin.username": "Username",
  "admin.password": "Password",
  "admin.userProjects": "Assign projects (multi-select, at least 1)",
  "admin.createUser": "Create user",
  "admin.role": "Role",
  "admin.status": "Status",
  "admin.status.active": "Active",
  "admin.status.disabled": "Disabled",
  "admin.action.disable": "Disable",
  "admin.action.enable": "Enable",
  "admin.action.assign": "Assign projects",
  "admin.action.resetPwd": "Reset password",
  "admin.action.sync": "Sync links",
  "admin.save": "Save",
  "admin.cancel": "Cancel",
  "admin.noProjects": "No projects yet \u2014 create one first.",
  "admin.tokenNote": "Tokens are shown only once at creation."
};

// src/client/index.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var inject = ["slots", "locale", "sessions", "workspaces"];
function useIdentity(source) {
  return (0, import_react4.useSyncExternalStore)(source.subscribe, source.get);
}
function createIdentitySource() {
  let state = { kind: "resolving" };
  const listeners = /* @__PURE__ */ new Set();
  const userOf = (s) => s.kind === "user" || s.kind === "admin" ? s.user : void 0;
  const stop = watchIdentity(browserDeps, (next) => {
    const a = userOf(state);
    const b = userOf(next);
    if (next.kind === state.kind && a?.slug === b?.slug && a?.workspaces.length === b?.workspaces.length) return;
    state = next;
    for (const listener of [...listeners]) listener();
  });
  return {
    source: {
      subscribe(fn) {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
      get: () => state
    },
    stop
  };
}
function apply(ctx) {
  ensureTenantStyles();
  ctx.effect(() => ctx.locale.register("multi-tenant", { zh, en }), "multi-tenant: dictionaries");
  const identity = createIdentitySource();
  ctx.effect(() => identity.stop, "multi-tenant: identity watcher");
  const source = identity.source;
  const sessionsFace = ctx.sessions;
  const sessionsList = sessionsFace?.list;
  function guardForeignCurrentSession(user) {
    if (user.workspaces.length === 0) return;
    const snapshot = typeof sessionsList?.getSnapshot === "function" ? sessionsList.getSnapshot() : void 0;
    if (!snapshot) return;
    guardCurrentSession(snapshot, user.workspaces.map((w) => w.path), () => {
      sessionsFace.clear?.();
    });
  }
  function subscribeForeignGuard(user) {
    if (typeof sessionsList?.subscribe !== "function") return () => {
    };
    return sessionsList.subscribe(() => guardForeignCurrentSession(user));
  }
  const workspacesFace = ctx.workspaces;
  let autoConnectedFor;
  async function startSessionIn(workspaceId) {
    try {
      const sessionId = await workspacesFace?.connectWorkspace?.(workspaceId);
      if (sessionId !== void 0) sessionsFace.open(sessionId);
    } catch {
    }
  }
  function autoConnectWorkspace(user) {
    if (user.workspaces.length === 0) return;
    if (autoConnectedFor === user.slug) return;
    autoConnectedFor = user.slug;
    void (async () => {
      try {
        const snapshot = workspacesFace?.list?.getSnapshot?.();
        const mine = (snapshot?.items ?? []).filter((w) => user.workspaces.some((m) => m.path === w.path));
        if (mine.length === 0) return;
        const currentId = sessionsList?.getSnapshot?.()?.current;
        const currentCwd = currentId !== void 0 ? sessionsList?.getSnapshot?.()?.byId?.[currentId]?.cwd : void 0;
        if (currentCwd !== void 0 && user.workspaces.some((m) => m.path === currentCwd)) return;
        const sessionId = await workspacesFace?.connectWorkspace?.(mine[0].workspaceId);
        if (sessionId !== void 0) sessionsFace.open(sessionId);
      } catch {
      }
    })();
  }
  function AuthGateEntry(props) {
    const state = useIdentity(source);
    const mode = state.kind === "resolving" ? "checking" : state.kind === "anonymous" ? "form" : "hidden";
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AuthGateView, { t: props.t, deps: browserDeps, mode });
  }
  function AdminSectionEntry(props) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AdminSectionView, { t: props.t, close: props.close, deps: browserDeps });
  }
  function UserBadgeEntry(props) {
    const state = useIdentity(source);
    if (state.kind !== "user" && state.kind !== "admin") return null;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(UserBadgeView, { t: props.t, user: state.user, deps: browserDeps });
  }
  ctx.slots.inject("shell.overlay", () => ctx.slots.register(
    { name: "shell.overlay", id: "multi-tenant-auth-gate", order: 0, locale: "multi-tenant" },
    AuthGateEntry
  ));
  ctx.slots.inject("settings.section", () => ctx.slots.register(
    {
      name: "settings.section",
      id: "multi-tenant-admin",
      order: 200,
      locale: "multi-tenant",
      label: () => ctx.locale.bind("multi-tenant")("section.title")
    },
    AdminSectionEntry
  ));
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register(
    { name: "sidebar.footer.action", id: "multi-tenant-user-badge", order: 0, locale: "multi-tenant" },
    UserBadgeEntry
  ));
  function RestrictedWorkspacesEntry(props) {
    const state = useIdentity(source);
    const titles = useColdSessionTitles(state.kind === "user" ? state.user : void 0, browserDeps);
    if (state.kind !== "user") return null;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      RestrictedWorkspacesView,
      {
        t: props.t,
        wide: props.wide,
        useSessions: (selector) => props.useSessions(selector),
        useWorkspaces: (selector) => props.useWorkspaces(selector),
        openSession: (sessionId) => sessionsFace.open(sessionId),
        newSession: (workspaceId) => startSessionIn(workspaceId),
        user: state.user,
        titles
      }
    );
  }
  function RestrictedSettingsEntry(_props) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RestrictedSettingsView, {});
  }
  function RestrictedPickerEntry(props) {
    const state = useIdentity(source);
    if (state.kind !== "user") return null;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      RestrictedPickerView,
      {
        t: props.t,
        open: props.open,
        anchorRef: props.anchorRef,
        selectedId: props.selectedId === void 0 ? void 0 : String(props.selectedId),
        onPick: (workspaceId) => props.onPick(workspaceId),
        onClose: props.onClose,
        useWorkspaces: (selector) => props.useWorkspaces(selector),
        user: state.user
      }
    );
  }
  function shadowWhenUser(seat, onUser) {
    ctx.slots.inject(seat, () => {
      let disposeShadow;
      let disposeGuard;
      const sync = (state) => {
        if (state.kind === "user") {
          guardForeignCurrentSession(state.user);
          autoConnectWorkspace(state.user);
          disposeGuard ??= subscribeForeignGuard(state.user);
          disposeShadow ??= onUser();
        } else {
          disposeShadow?.();
          disposeShadow = void 0;
          disposeGuard?.();
          disposeGuard = void 0;
        }
      };
      sync(source.get());
      const off = source.subscribe(() => sync(source.get()));
      return () => {
        off();
        disposeShadow?.();
        disposeShadow = void 0;
        disposeGuard?.();
        disposeGuard = void 0;
      };
    });
  }
  shadowWhenUser("sidebar.workspaces", () => ctx.slots.register(
    { name: "sidebar.workspaces", priority: -10, locale: "multi-tenant" },
    RestrictedWorkspacesEntry
  ));
  shadowWhenUser("sidebar.settings", () => ctx.slots.register(
    { name: "sidebar.settings", priority: -10, locale: "multi-tenant" },
    RestrictedSettingsEntry
  ));
  shadowWhenUser("conversation.hero.workspace", () => ctx.slots.register(
    { name: "conversation.hero.workspace", priority: -10, locale: "multi-tenant" },
    RestrictedPickerEntry
  ));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
