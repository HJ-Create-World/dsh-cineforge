// CineForge 工作台 · 工程存储层（零第三方依赖）
//
// 一个「视频工程」= 工作区里的一个文件夹，里面有 project.json。
// 目录从哪来：由 workbench-service 给出候选列表（遵守本机四层工作区规范），
// 本文件只负责「按名字找、按 rev 存、路径不许出根」。
//
// 三条硬规矩（docs/工作台设计.md §10）：
//   1) 客户端只传工程名，永远不传路径；路径由服务端拼，拼完必须落在根内。
//   2) 写之前先备份，写用「临时文件 + rename」，绝不原地覆写。
//   3) 并发用 rev 做 CAS：baseRev 与磁盘 rev 不一致就 409，**服务端绝不自动 merge**。

import fs from "node:fs";
import path from "node:path";

// 工程名规则：只允许小写字母、数字、连字符与下划线。
// 允许下划线是因为本机四层工作区规范要求「桶内编号_项目名」（如 03_cineforge-demo-01）；
// 不允许点、斜杠、空格，所以拼接后不可能越界。
export const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const PROJECT_FILE = "project.json";
export const BACKUP_KEEP = 20;

export function safeJsonParse(text) {
  try { return { ok: true, value: JSON.parse(text) }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

/** 从 project.json 抽一行摘要，给工程列表用；坏文件不许让整页崩。 */
export function summarizeProject(project, fallbackName) {
  const p = (project && project.project) || {};
  const shots = Array.isArray(project && project.shots) ? project.shots : [];
  return {
    // name 必须是**目录名**：它是唯一可寻址的键，客户端用它调 /project?name= 与 /project/save。
    // project.id 只是内容里的自述，二者可能不同（本机四层规范要求目录带序号前缀，如 03_xxx）。
    name: fallbackName,
    project_id: p.id || "",
    title: p.brief || p.idea || p.id || fallbackName,
    idea: p.idea || "",
    platform: p.platform || "",
    aspect: p.aspect || "",
    duration_s: Number(p.duration_s || 0),
    stage: typeof project.stage === "string" ? project.stage : "",
    rev: Number.isInteger(project.rev) ? project.rev : 0,
    updated_at: typeof project.updated_at === "string" ? project.updated_at : "",
    shot_count: shots.length,
  };
}

function statOf(file) {
  try { const st = fs.statSync(file); return st.isFile() ? st : null; } catch { return null; }
}

function readRaw(file) {
  const st = statOf(file);
  if (!st) return null;
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return null; }
  return { text, st, parsed: safeJsonParse(text) };
}

/**
 * @param {object} o
 * @param {string} o.root  主根（可写）——工程就建在它下面
 * @param {Array<{dir:string,label:string,readOnly?:boolean}>} [o.extra] 额外只读根
 */
export function createStore({ root, extra = [] } = {}) {
  if (!root || typeof root !== "string") throw new Error("createStore 需要 root");
  const writeRoot = path.resolve(root);

  function roots() {
    const out = [];
    out.push({ dir: writeRoot, label: "workspace", readOnly: false });
    for (const e of extra || []) {
      if (!e || !e.dir) continue;
      const abs = path.resolve(e.dir);
      if (abs === writeRoot) continue;
      out.push({ dir: abs, label: e.label || "extra", readOnly: e.readOnly !== false });
    }
    return out;
  }

  function insideRoot(dir, name) {
    if (typeof name !== "string" || !NAME_RE.test(name)) {
      const err = new Error("工程名只允许小写字母、数字与连字符（1–64 位）");
      err.code = "BAD_NAME";
      throw err;
    }
    const abs = path.resolve(dir, name);
    const rel = path.relative(path.resolve(dir), abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      const err = new Error("工程路径越界");
      err.code = "PATH_ESCAPE";
      throw err;
    }
    return abs;
  }

  function list() {
    const items = [];
    const seen = new Set();
    for (const r of roots()) {
      let entries = [];
      try { entries = fs.readdirSync(r.dir, { withFileTypes: true }); } catch { continue; }
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const name = ent.name;
        if (!NAME_RE.test(name) || seen.has(name)) continue;
        const dir = path.join(r.dir, name);
        const raw = readRaw(path.join(dir, PROJECT_FILE));
        if (!raw) continue;
        seen.add(name);
        if (!raw.parsed.ok) {
          items.push({ name, broken: true, error: raw.parsed.error, source: r.label, read_only: !!r.readOnly, mtime: raw.st.mtime.toISOString() });
          continue;
        }
        items.push({ ...summarizeProject(raw.parsed.value, name), source: r.label, read_only: !!r.readOnly, mtime: raw.st.mtime.toISOString(), dir });
      }
    }
    items.sort((a, b) => String(b.mtime || "").localeCompare(String(a.mtime || "")));
    return { root: writeRoot, projects: items };
  }

  function locate(name) {
    for (const r of roots()) {
      let abs;
      try { abs = insideRoot(r.dir, name); } catch { continue; }
      const file = path.join(abs, PROJECT_FILE);
      if (statOf(file)) return { file, dir: abs, readOnly: r.readOnly, source: r.label, root: r.dir };
    }
    return null;
  }

  function read(name) {
    const hit = locate(name);
    if (!hit) { const e = new Error("工程不存在：" + name); e.code = "NOT_FOUND"; throw e; }
    const raw = readRaw(hit.file);
    if (!raw) { const e = new Error("工程文件读不出来：" + name); e.code = "NOT_FOUND"; throw e; }
    if (!raw.parsed.ok) { const e = new Error("project.json 不是合法 JSON：" + raw.parsed.error); e.code = "BAD_JSON"; throw e; }
    const v = raw.parsed.value;
    return {
      name,
      source: hit.source,
      read_only: hit.readOnly,
      mtime: raw.st.mtime.toISOString(),
      bytes: raw.st.size,
      rev: Number.isInteger(v.rev) ? v.rev : 0,
      project: v,
    };
  }

  function backup(file, rev) {
    try {
      const dir = path.join(path.dirname(file), ".local", "backup");
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(file, path.join(dir, "project-" + rev + "-" + stamp + ".json"));
      const olds = fs.readdirSync(dir).filter((f) => f.startsWith("project-")).sort();
      for (const f of olds.slice(0, Math.max(0, olds.length - BACKUP_KEEP))) { try { fs.unlinkSync(path.join(dir, f)); } catch { } }
      return true;
    } catch { return false; }
  }

  function save({ name, project, baseRev }) {
    const hit = locate(name);
    if (!hit) { const e = new Error("工程不存在，不能保存：" + name); e.code = "NOT_FOUND"; throw e; }
    if (hit.readOnly) { const e = new Error("这是只读工程（" + hit.source + "），不能保存"); e.code = "READ_ONLY"; throw e; }
    if (!project || typeof project !== "object" || Array.isArray(project)) { const e = new Error("project 必须是对象"); e.code = "BAD_BODY"; throw e; }
    const current = read(name);
    const diskRev = current.rev;
    if (Number.isInteger(baseRev) && baseRev !== diskRev) {
      return { ok: false, conflict: true, currentRev: diskRev, current: current.project, mine: project };
    }
    const next = { ...project };
    next.rev = diskRev + 1;
    next.updated_at = new Date().toISOString();
    if (!next.schema) next.schema = "cineforge/project/v1";
    const text = JSON.stringify(next, null, 2) + "\n";
    if (Buffer.byteLength(text) > 4 * 1024 * 1024) { const e = new Error("project.json 超过 4MB 上限"); e.code = "TOO_LARGE"; throw e; }
    const backed = backup(hit.file, diskRev);
    const tmp = hit.file + ".tmp-" + process.pid + "-" + Date.now();
    fs.writeFileSync(tmp, text, "utf8");
    fs.renameSync(tmp, hit.file);
    return { ok: true, rev: next.rev, saved_at: next.updated_at, bytes: Buffer.byteLength(text), backed_up: backed };
  }

  function create({ name, project }) {
    const dir = insideRoot(writeRoot, name);
    const file = path.join(dir, PROJECT_FILE);
    if (statOf(file)) { const e = new Error("工程已存在：" + name); e.code = "EXISTS"; throw e; }
    fs.mkdirSync(dir, { recursive: true });
    const next = { ...(project || {}) };
    next.schema = next.schema || "cineforge/project/v1";
    next.rev = 1;
    next.updated_at = new Date().toISOString();
    next.project = { ...(next.project || {}), id: name };
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n", "utf8");
    return { ok: true, name, rev: 1 };
  }

  /** 素材白名单：工程目录下的这些相对路径可以只读打开。 */
  function resolveAsset(dir, rel) {
    const hit = locate(dir);
    if (!hit) { const e = new Error("工程不存在：" + dir); e.code = "NOT_FOUND"; throw e; }
    const abs = path.resolve(hit.dir, rel);
    const rr = path.relative(hit.dir, abs);
    if (rr.startsWith("..") || path.isAbsolute(rr)) { const e = new Error("素材路径越界"); e.code = "PATH_ESCAPE"; throw e; }
    return abs;
  }

  return { root: writeRoot, list, read, save, create, locate, resolveAsset };
}
