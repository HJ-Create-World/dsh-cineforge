// CineForge · 验收报告读取（纯函数，零依赖）
//
// 0.4.2 收口的第一件事：把跑过的 verify.json 变成界面上能看的东西。
// 三条纪律：
//   1) 只读，不生成。生成要跑 npx hyperframes（分钟级），那是 job 层的事。
//   2) 绝对路径不出网：对外只给 {src, id}，由 /asset 路由统一解析并做越界检查。
//   3) 找不到就如实说找不到 —— 不返回空壳让界面误以为"验收通过"。

import fs from "node:fs";
import path from "node:path";

/** verify.json 可能的落点，按优先级排列（先工程自己的，再插件自带的 demo）。 */
export function verifyCandidates({ name, projectId, projectDir, pluginRoot }) {
  const id = String(projectId || name || "").trim();
  const out = [];
  if (projectDir) {
    out.push(path.join(projectDir, "qa", id + ".verify.json"));
    out.push(path.join(projectDir, "out", "qa", id + ".verify.json"));
  }
  if (pluginRoot) out.push(path.join(pluginRoot, "out", "qa", id + ".verify.json"));
  return out;
}

/** 从 frame-03-at-12s.png 里取采样时刻；取不到就返回 null（不猜）。 */
export function frameTime(file) {
  const m = /at-(\d+(?:\.\d+)?)s\.png$/i.exec(String(file || ""));
  return m ? Number(m[1]) : null;
}

/**
 * 把 verify.json 归一成界面能直接渲染的结构。
 * urlFor(absPath) 负责把绝对路径换成 { src, id } —— 由路由层实现，纯函数不碰路由。
 */
export function normalizeVerify(raw, urlFor) {
  if (!raw || typeof raw !== "object") {
    return { found: false, ok: false, reason: "EMPTY", message: "验收报告为空" };
  }
  const frames = (Array.isArray(raw.frames) ? raw.frames : [])
    .map((f) => {
      const p = typeof f === "string" ? f : (f && f.path) || "";
      if (!p) return null;
      // url 可能算不出来（比如路由层只想统计张数，或产物在插件根之外）——
      // 这时保留帧记录、只留空 url，否则「0 张静帧」会骗人。
      const link = urlFor(p) || null;
      return {
        t: frameTime(p),
        bytes: Number((f && f.bytes) || 0),
        file: path.basename(p),
        url: link ? link.url : "",
        src: link ? link.src : "",
        id: link ? link.id : "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.t === null ? 1e9 : a.t) - (b.t === null ? 1e9 : b.t));

  const contact = raw.contact_sheet ? urlFor(raw.contact_sheet) : null;
  const groups = raw.groups && typeof raw.groups === "object" ? raw.groups : {};
  const warnings = (Array.isArray(raw.warnings) ? raw.warnings : []).map((w) => ({
    group: String((w && w.group) || "—"),
    code: String((w && w.code) || ""),
    selector: String((w && w.selector) || ""),
    message: String((w && w.message) || ""),
    time: w && w.time !== undefined ? w.time : null,
    fix: String((w && w.fix) || ""),
  }));
  const byGroup = {};
  for (const g of Object.keys(groups)) {
    const s = groups[g] || {};
    byGroup[g] = { error: Number(s.error || 0), warning: Number(s.warning || 0), info: Number(s.info || 0) };
  }
  return {
    found: true,
    ok: !!raw.ok,
    schema: raw.schema || "",
    project_id: raw.project_id || "",
    backend: raw.backend || "",
    backend_version: raw.backend_version || "",
    duration_s: Number(raw.duration_s || 0),
    shot_count: Number(raw.shot_count || 0),
    check_ok: !!raw.check_ok,
    error_count: Number(raw.error_count || 0),
    warning_count: Number(raw.warning_count || 0),
    empty_frames: Number(raw.empty_frames || 0),
    sample_times: Array.isArray(raw.sample_times) ? raw.sample_times : [],
    groups: byGroup,
    warnings,
    frames,
    contact_sheet_url: contact ? contact.url : "",
    note: String(raw.note || ""),
  };
}

/** 找第一个存在的 verify.json；都不存在返回 {found:false, tried:[...]}。 */
export function readVerify({ name, projectId, projectDir, pluginRoot }) {
  const tried = verifyCandidates({ name, projectId, projectDir, pluginRoot });
  for (const p of tried) {
    try {
      if (!fs.statSync(p).isFile()) continue;
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      return { found: true, file: p, raw };
    } catch (e) {
      if (e && e.code !== "ENOENT") return { found: false, file: p, error: String((e && e.message) || e), tried };
    }
  }
  return { found: false, tried };
}
