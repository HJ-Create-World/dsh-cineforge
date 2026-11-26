// CineForge 工作台 · 服务端接线（零第三方依赖）
//
// 这一层只做三件事：找到工作区根、注册路由、把 disposer 交回宿主。
// 所有 webServer 访问都在 ctx.inject(['webServer'], child => …) 子作用域里，
// 顶层 inject 只有 ['skills']——0.3.1 的 PENDING 事故就是顶层直读服务导致的。

import fs from "node:fs";
import path from "node:path";
import { createStore } from "./project-store.mjs";
import { createRoutes, ROUTE_PREFIX, guard } from "./routes.mjs";
import { pluginVersion } from "../version.mjs";

/**
 * 找工程根。真机教训（v0.4.0 首跑）：不能盲取 registry[0]，也不能靠 process.cwd() ——
 * 宿主进程的 cwd 是应用启动目录，与用户在 GUI 里打开的工作区无关，结果落到了
 * 另一个项目（08_Rtings-Calculate），工作台一片空白。
 *
 * 现在的优先级（先证明、后兜底）：
 *   1) 显式配置 config.workspace / 环境变量 CINEFORGE_WORKSPACE（用户能钉死）
 *   2) registry 里带「视频四层规范」目录 03_Video/02_MyWork 的工作区（CineForge 是视频插件，
 *      这是唯一能证明「这个工作区能放视频工程」的证据）；多个命中取 updatedAt 最新的
 *   3) registry 里与 process.cwd() 有关联的那个
 *   4) registry 第一个
 *   5) process.cwd()
 * 取不到 registry（可选服务）只降级、绝不抛。
 */
function videoHomeOf(root) {
  try {
    const v = path.join(root, "03_Video", "02_MyWork");
    return fs.statSync(v).isDirectory() ? v : "";
  } catch { return ""; }
}

export function resolveWorkspaceRoot(ctx, explicit) {
  const candidates = [];
  let cwd = "";
  try { cwd = process.cwd(); } catch { }

  const push = (dir, source, updatedAt) => {
    if (!dir || typeof dir !== "string") return;
    const abs = path.resolve(dir);
    if (candidates.some((c) => c.dir.toLowerCase() === abs.toLowerCase())) return;
    candidates.push({ dir: abs, source, updatedAt: updatedAt || "", video: !!videoHomeOf(abs) });
  };

  const envRoot = (() => { try { return process.env.CINEFORGE_WORKSPACE || ""; } catch { return ""; } })();
  if (explicit) push(explicit, "config");
  if (envRoot) push(envRoot, "env");

  try {
    const reg = typeof ctx.get === "function" ? ctx.get("workspaceRegistry", false) : undefined;
    const list = reg && typeof reg.list === "function" ? reg.list() : [];
    for (const w of list) {
      const p = w && (typeof w.path === "string" ? w.path : (w.path && w.path.value));
      let updated = "";
      try { updated = String(w.updatedAt || w.updated_at || ""); } catch { }
      push(p, "workspace", updated);
    }
  } catch { }
  if (cwd) push(cwd, "cwd");

  // 规则 1：显式来源优先。
  const pinned = candidates.find((c) => c.source === "config" || c.source === "env");
  if (pinned) return { root: pinned.dir, source: pinned.source, candidates };

  // 规则 2：能放视频工程的工作区里，最近更新的那个。
  const videoOnes = candidates.filter((c) => c.video && c.source === "workspace");
  if (videoOnes.length) {
    videoOnes.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return { root: videoOnes[0].dir, source: "video-workspace", candidates };
  }

  // 规则 3：与宿主 cwd 有关联的工作区。
  if (cwd) {
    const norm = path.resolve(cwd).toLowerCase();
    const hit = candidates.find((c) => c.source === "workspace" && (c.dir.toLowerCase() === norm || norm.startsWith(c.dir.toLowerCase() + path.sep)));
    if (hit) return { root: hit.dir, source: "cwd-match", candidates };
  }

  const firstWs = candidates.find((c) => c.source === "workspace");
  if (firstWs) return { root: firstWs.dir, source: "first-workspace", candidates };
  if (cwd) return { root: path.resolve(cwd), source: "cwd", candidates };
  return { root: process.cwd(), source: "fallback", candidates };
}

export function mountWorkbench(ctx, { pluginRoot, workspace } = {}) {
  const info = { version: pluginVersion(), workspace_root: "", workspace_source: "", candidates: [] };
  let mounted = false;

  const install = (scoped) => {
    const resolved = resolveWorkspaceRoot(ctx, workspace);
    info.workspace_root = resolved.root;
    info.workspace_source = resolved.source;
    info.candidates = resolved.candidates.map((c) => ({ dir: c.dir, source: c.source, video: c.video }));
    // 写根遵守本机四层工作区规范：视频项目落在 <工作区>/03_Video/02_MyWork/<项目名>/。
    // 若该目录不存在（非本机规范的工作区），退回 <工作区>/projects。
    const videoHome = videoHomeOf(resolved.root);
    const projectsRoot = videoHome || path.join(resolved.root, "projects");
    info.projects_root = projectsRoot;
    // demo 成片只读挂载：插件自带的 20 秒样片与 QA 报告，供空工作区时也有东西可看。
    const store = createStore({
      root: projectsRoot,
      extra: [{ dir: path.join(pluginRoot, "out"), label: "demo", readOnly: true }],
    });
    const routes = createRoutes({ pluginRoot, store, config: info });
    const table = [
      ["/health", routes.health],
      ["/projects", routes.listProjects],
      ["/project", routes.getProject],
      ["/project/save", routes.saveProject],
      ["/project/create", routes.createProject],
      ["/cards", routes.getCards],
      ["/templates", routes.getTemplates],
      ["/asset", routes.getAsset],
      ["/animatic", routes.postAnimatic],
      ["/lint", routes.postLint],
      ["/gate", routes.postGate],
      ["/verify", routes.getVerify],
      ["/publish/preflight", routes.getPreflight],
      ["/publish/record", routes.postPublishRecord],
      ["/themes", routes.getThemes],
      ["/template/apply", routes.postTemplateApply],
      ["/template/save", routes.postTemplateSave],
      ["/reference/analyze", routes.postReferenceAnalyze],
      ["/reference/clear", routes.postReferenceClear],
      ["/goal", (req, res, url) => (req.method === "POST" ? routes.postGoal(req, res) : routes.getGoal(req, res, url))],
    ];
    for (const [suffix, handler] of table) {
      const p = ROUTE_PREFIX + suffix;
      scoped.effect(() => {
        const wrapped = (req, res) => {
          try {
            if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
            const bad = guard(req);
            if (bad) {
              try { req.resume(); } catch { }
              res.statusCode = 403;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              return res.end(JSON.stringify({ ok: false, code: "CROSS_ORIGIN", reason: bad }));
            }
            const url = new URL(req.url || "/", "http://" + (req.headers.host || "localhost"));
            const r = handler(req, res, url);
            if (r && typeof r.catch === "function") r.catch((e) => {
              try { res.statusCode = 500; res.end(JSON.stringify({ ok: false, code: "HANDLER_FAILED", message: String((e && e.message) || e) })); } catch { }
            });
          } catch (e) {
            try { res.statusCode = 500; res.end(JSON.stringify({ ok: false, code: "HANDLER_THREW", message: String((e && e.message) || e) })); } catch { }
          }
        };
        return scoped.webServer.register({ kind: "exact", path: p, handler: wrapped });
      });
    }
    mounted = true;
  };

  try {
    ctx.inject(["webServer"], (scoped) => {
      try { install(scoped); }
      catch (e) { warn(ctx, "工作台路由注册失败：" + String((e && e.message) || e)); }
    });
  } catch (e) {
    warn(ctx, "无法注入 webServer（宿主版本过旧？）：" + String((e && e.message) || e));
  }

  return { get mounted() { return mounted; }, info };
}

function warn(ctx, detail) {
  try { (ctx.logger && ctx.logger.warn ? ctx.logger.warn(detail) : console.warn(detail)); } catch { }
}
