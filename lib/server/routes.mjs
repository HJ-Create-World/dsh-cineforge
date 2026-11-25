// CineForge 工作台 · HTTP 路由层（零第三方依赖）
//
// 挂载点由 lib/workbench-service.mjs 负责（ctx.inject(['webServer']) 子作用域），
// 这里只做「解析请求 → 调 store → 写响应」。三条纪律：
//   1) 同源校验自己做（ctx.webServer.register 注册的路由绕过宿主 BrowserAuth）。
//   2) 拒绝前必须 req.resume() 排空 body，否则客户端拿到的是网络错误而不是 403。
//   3) 任何异常都转成 JSON 错误响应，绝不让 Promise 拒绝冒到宿主。
//
// 路由清单（全部前缀 /dsh-cineforge）：
//   GET  /health                  自检
//   GET  /projects                工程列表
//   GET  /project?name=<name>     读单个工程
//   POST /project/save            保存（rev CAS）
//   POST /project/create          新建
//   GET  /cards                   镜头配方卡（124 张）
//   GET  /templates               可用模板
//   GET  /asset?src=poster&id=..  素材（海报 / 成片 mp4，支持 Range）

import fs from "node:fs";
import path from "node:path";
import { createStore, NAME_RE } from "./project-store.mjs";

export const ROUTE_PREFIX = "/dsh-cineforge";
const MAX_BODY = 4 * 1024 * 1024;

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(text);
}

function loopback(req) {
  const a = req.socket && req.socket.remoteAddress;
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

/** 同源校验：自定义头 → sec-fetch-site → Host/Origin 一致性；桌面端 dsh-app:// 放行。 */
export function guard(req) {
  const site = req.headers["sec-fetch-site"];
  if (typeof site === "string" && site !== "" && site !== "same-origin" && site !== "none") return "cross-site";
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (typeof origin === "string" && origin !== "") {
    if (origin === "dsh-app://app" || origin === "null") return null;
    let u;
    try { u = new URL(origin); } catch { return "bad-origin"; }
    if (u.protocol !== "http:" && u.protocol !== "https:") return "bad-origin";
    if (!host || u.host !== host) return "origin-host-mismatch";
    return null;
  }
  return loopback(req) ? null : "no-origin";
}

function readJsonBody(req, res) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { finish({ ok: false, code: "TOO_LARGE" }); try { req.destroy(); } catch { } return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return finish({ ok: true, value: {} });
      try { finish({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); }
      catch (e) { finish({ ok: false, code: "BAD_JSON", message: String((e && e.message) || e) }); }
    });
    req.on("error", () => finish({ ok: false, code: "READ_ERROR" }));
  });
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8" };

function serveFile(req, res, file, download) {
  let st;
  try { st = fs.statSync(file); } catch { return sendJson(res, 404, { ok: false, code: "NOT_FOUND" }); }
  if (!st.isFile()) return sendJson(res, 404, { ok: false, code: "NOT_FILE" });
  const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
  const range = req.headers.range;
  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-cache");
  if (download) res.setHeader("Content-Disposition", "attachment; filename=\"" + path.basename(file).replace(/"/g, "") + "\"");
  if (typeof range === "string" && /^bytes=\d*-\d*$/.test(range.trim())) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = m[1] === "" ? null : Number(m[1]);
    let end = m[2] === "" ? null : Number(m[2]);
    if (start === null && end === null) { /* 无效，退化成整文件 */ }
    else {
      if (start === null) { start = Math.max(0, st.size - end); end = st.size - 1; }
      else if (end === null || end >= st.size) end = st.size - 1;
      if (start > end || start >= st.size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", "bytes */" + st.size);
        return res.end();
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + st.size);
      res.setHeader("Content-Length", String(end - start + 1));
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
  }
  res.statusCode = 200;
  res.setHeader("Content-Length", String(st.size));
  if (req.method === "HEAD") return res.end();
  return fs.createReadStream(file).pipe(res);
}

/** 素材白名单：只允许从这几个根下读，且解析后必须仍在根内。 */
function assetRoots({ pluginRoot, workspaceRoot }) {
  return [
    { src: "mockup", dir: path.join(pluginRoot, "docs", "design", "mockups", "assets") },
    { src: "poster", dir: path.join(pluginRoot, "assets", "posters") },
    { src: "plugin", dir: path.join(pluginRoot, "assets") },
    { src: "workspace", dir: workspaceRoot },
  ];
}

export function createRoutes({ pluginRoot, store, config }) {
  const health = (req, res) => sendJson(res, 200, {
    ok: true,
    plugin: "dsh-cineforge",
    version: config.version || "",
    route_prefix: ROUTE_PREFIX,
    workspace_root: config.workspace_root || store.root,
    workspace_source: config.workspace_source || "",
    projects_root: store.root,
    candidates: config.candidates || [],
    storage: "workspace 03_Video/02_MyWork/<name>/project.json",
  });

  const listProjects = (req, res) => {
    try { sendJson(res, 200, { ok: true, ...store.list() }); }
    catch (e) { sendJson(res, 500, { ok: false, code: "LIST_FAILED", message: String((e && e.message) || e) }); }
  };

  const getProject = (req, res, url) => {
    const name = url.searchParams.get("name") || "";
    try { sendJson(res, 200, { ok: true, ...store.read(name) }); }
    catch (e) {
      const code = e.code || "READ_FAILED";
      sendJson(res, code === "NOT_FOUND" ? 404 : code === "BAD_NAME" || code === "PATH_ESCAPE" ? 400 : 500, { ok: false, code, message: String((e && e.message) || e) });
    }
  };

  const saveProject = async (req, res) => {
    const body = await readJsonBody(req, res);
    if (!body.ok) return sendJson(res, body.code === "TOO_LARGE" ? 413 : 400, { ok: false, code: body.code, message: body.message || "" });
    const { name, project, baseRev, patch } = body.value || {};
    try {
      let target = project;
      if (!target && patch && typeof patch === "object" && name) {
        const cur = store.read(name).project;
        target = { ...cur, ...patch };
      }
      if (!target) return sendJson(res, 400, { ok: false, code: "BAD_BODY", message: "需要 project 或 patch" });
      const r = store.save({ name, project: target, baseRev: Number.isInteger(baseRev) ? baseRev : undefined });
      if (!r.ok) return sendJson(res, 409, { ok: false, code: "CONFLICT", currentRev: r.currentRev, current: r.current, mine: r.mine });
      sendJson(res, 200, { ok: true, rev: r.rev, saved_at: r.saved_at, bytes: r.bytes });
    } catch (e) {
      const code = e.code || "SAVE_FAILED";
      const status = code === "NOT_FOUND" ? 404 : code === "READ_ONLY" ? 403 : code === "BAD_NAME" || code === "PATH_ESCAPE" || code === "BAD_BODY" ? 400 : code === "TOO_LARGE" ? 413 : 500;
      sendJson(res, status, { ok: false, code, message: String((e && e.message) || e) });
    }
  };

  const createProject = async (req, res) => {
    const body = await readJsonBody(req, res);
    if (!body.ok) return sendJson(res, 400, { ok: false, code: body.code });
    const { name, project } = body.value || {};
    try { sendJson(res, 200, { ok: true, ...store.create({ name, project }) }); }
    catch (e) {
      const code = e.code || "CREATE_FAILED";
      sendJson(res, code === "EXISTS" ? 409 : code === "BAD_NAME" ? 400 : 500, { ok: false, code, message: String((e && e.message) || e) });
    }
  };

  const getCards = (req, res, url) => {
    try {
      const file = path.join(pluginRoot, "knowledge", "shot-cards.json");
      const kb = JSON.parse(fs.readFileSync(file, "utf8"));
      let cards = Array.isArray(kb.cards) ? kb.cards : [];
      const cat = url.searchParams.get("category");
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      if (cat) cards = cards.filter((c) => c.category === cat);
      if (q) cards = cards.filter((c) => (String(c.id) + " " + String(c.summary || "") + " " + String(c.use || "") + " " + (c.tags || []).join(" ")).toLowerCase().includes(q));
      sendJson(res, 200, { ok: true, schema: kb.schema, total: (kb.cards || []).length, categories: kb.categories || null, attribution: kb.attribution || "", count: cards.length, cards });
    } catch (e) { sendJson(res, 500, { ok: false, code: "CARDS_FAILED", message: String((e && e.message) || e) }); }
  };

  const getTemplates = (req, res) => {
    try {
      const dir = path.join(pluginRoot, "knowledge", "templates");
      const items = [];
      let names = [];
      try { names = fs.readdirSync(dir); } catch { names = []; }
      for (const f of names) {
        if (!f.endsWith(".json")) continue;
        try {
          const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
          const pal = (j.style && Array.isArray(j.style.palette) ? j.style.palette : []).slice(0, 5);
          items.push({
            file: f,
            id: j.id || f.replace(/\.json$/, ""),
            name: j.name || j.id || f,
            origin: j.origin || "",
            layers: j.layers || [],
            style: j.style ? {
              palette: pal, tone: j.style.tone || null, aspect: j.style.aspect || null,
              motion_tokens_id: j.style.motion_tokens_id || null, safe_area: j.style.safe_area || null,
            } : null,
            structure: j.structure ? { shot_count: j.structure.shot_count, aspect: j.structure.aspect, duration_stats: j.structure.duration_stats || null, chapters: j.structure.chapters || null } : null,
            sound: j.sound ? { bpm: j.sound.bpm, bpm_is_estimate: !!j.sound.bpm_is_estimate, cut_beat_alignment: j.sound.cut_beat_alignment || null } : null,
            caveats: (j.caveats || []).length,
          });
        } catch { items.push({ file: f, id: f.replace(/\.json$/, ""), error: "模板 JSON 解析失败" }); }
      }
      sendJson(res, 200, { ok: true, count: items.length, templates: items });
    } catch (e) { sendJson(res, 500, { ok: false, code: "TPL_FAILED", message: String((e && e.message) || e) }); }
  };

  const getAsset = (req, res, url) => {
    const src = url.searchParams.get("src") || "poster";
    const rel = url.searchParams.get("id") || url.searchParams.get("path") || "";
    const roots = assetRoots({ pluginRoot, workspaceRoot: store.root });
    const root = roots.find((r) => r.src === src);
    if (!root) return sendJson(res, 400, { ok: false, code: "BAD_SRC" });
    const abs = path.resolve(root.dir, rel);
    const relToRoot = path.relative(path.resolve(root.dir), abs);
    if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) return sendJson(res, 403, { ok: false, code: "PATH_ESCAPE" });
    return serveFile(req, res, abs, url.searchParams.get("download") === "1");
  };

  return { health, listProjects, getProject, saveProject, createProject, getCards, getTemplates, getAsset };
}
