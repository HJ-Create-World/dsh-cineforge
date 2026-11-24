#!/usr/bin/env node
// CineForge / 分镜 JSON → HyperFrames 工程编译器（v0.3 返工）
// 相对 0.2.0 的整改：本地 GSAP、registry 钉 commit、音轨与逐条署名、六种版式、
// 收尾静止、声明值不再被静默改写、AI 显式+隐式标识、seed 显式化。
// 零第三方依赖；所有产物确定性（同输入逐字节一致）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRIMITIVES, resolvePrimitive, resolveEase, DEFAULT_TOKEN_ID } from "../lib/hf-primitives.mjs";
import { resolveLayout, layoutBody } from "../lib/hf-layouts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LIB = path.join(ROOT, "lib");
const AUDIO_SRC = path.join(ROOT, "assets", "audio");
const HF_VERSION = "0.9.88";
const NL = String.fromCharCode(10);
const HF_REGISTRY_SHA = "45846f1e6d5609462d29652315d0d4254fe92c24";
const SEED = 20261124;
const AIGC_LABEL = "AI 生成 · 影铸 CineForge";

// ffprobe 实测时长（秒），用于 <audio data-duration>，避免上游文件长度漂移。
const SFX_DUR = Object.freeze({
  "click-camera.mp3": 0.351,
  "transition-soft.mp3": 1.275,
  "transition-snap.mp3": 0.574,
  "swoosh-quick.mp3": 0.781,
  "whoosh-fast.mp3": 1.757,
  "impact-cine.mp3": 4.063
});

const ASPECT_PX = Object.freeze({
  "16:9": [1920, 1080], "9:16": [1080, 1920], "3:4": [1080, 1440],
  "4:3": [1440, 1080], "1:1": [1080, 1080], "21:9": [2560, 1080]
});

const TPL_HTML = fs.readFileSync(path.join(LIB, "hf-template.html"), "utf8");
const TPL_CSS = fs.readFileSync(path.join(LIB, "hf-template.css"), "utf8");
const TPL_SHOT = fs.readFileSync(path.join(LIB, "hf-shot.html"), "utf8");
const TPL_TL = fs.readFileSync(path.join(LIB, "hf-timeline.js"), "utf8");

const HF_CONFIG = {
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/" + HF_REGISTRY_SHA + "/registry",
  "paths": { "blocks": "compositions", "components": "compositions/components", "assets": "assets" },
  "media": { "autoProxy": true }
};

function fill(tpl, map) {
  let s = tpl;
  for (const [k, v] of Object.entries(map)) s = s.split("{{" + k + "}}").join(String(v));
  return s;
}
function parseArgs(argv) {
  const o = { project: null, out: null, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project" || a === "-p") o.project = argv[++i];
    else if (a === "--out" || a === "-o") o.out = argv[++i];
    else if (a === "--strict") o.strict = true;
  }
  return o;
}
function loadJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function safeColor(v, fallback) { return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback; }
function pad2(n) { return String(n).padStart(2, "0"); }
function parsePalette(ds) {
  const p = (ds && ds.palette) || {};
  return {
    ground: safeColor(p.ground, "#0B0E14"),
    ink: safeColor(p.ink, "#F4F1EA"),
    accent: safeColor(p.accent, "#D3923C"),
    muted: safeColor(p.muted, "#C9C3B6"),
    panel: safeColor(p.panel, "#161B24"),
    grid: safeColor(p.grid, "rgba(211,146,60,0.10)")
  };
}

function resolveCanvas(project, presets) {
  const aspect = project.aspect || "9:16";
  const [width, height] = ASPECT_PX[aspect] || ASPECT_PX["9:16"];
  const common = (presets && presets.common) || {};
  const fps = Number(project.fps || common.fps || 30);
  return {
    width, height, aspect, fps,
    platform: project.platform || "douyin",
    portrait: height > width,
    safeRight: height > width ? "20%" : "12%",
    safeBottom: height > width ? "22%" : "12%"
  };
}

// 不再静默给末镜补 0.6s：声明值原样保留，收尾静止由 tween 设计保证，
// 并在 manifest 里显式记录 declared_* 与 transforms。
function normalizeShots(sb, cards, canvas) {
  const cardList = Array.isArray(cards) ? cards : (cards.cards || cards.shots || []);
  const catById = new Map(cardList.map(c => [c.id, c.category]));
  const list = (sb.shots || []).map((s, i) => {
    const category = s.category || catById.get(s.card_id) || "effects";
    const fromF = Number(s.from != null ? s.from : 0);
    const durF = Number(s.duration_f != null ? s.duration_f : 90);
    const start_s = Number((fromF / canvas.fps).toFixed(3));
    const dur_s = Number((durF / canvas.fps).toFixed(3));
    const copy = s.copy || {};
    return {
      index: i + 1,
      id: s.id || "s" + pad2(i + 1),
      cardId: s.card_id || "",
      cardStyle: s.card_style_key || "",
      category,
      primitive: resolvePrimitive(s, category),
      layout: resolveLayout(s),
      backend: s.backend || "hyperframes",
      intent: s.intent || "",
      action: s.action || "",
      caption: s.caption || "",
      copy,
      energy: s.energy || "mid",
      transitionIn: s.transition_in || "",
      transitionOut: s.transition_out || "",
      sfxCue: s.sfx_cue || "",
      beatAnchor: s.beat_anchor || "",
      start_s, dur_s,
      end_s: Number((start_s + dur_s).toFixed(3)),
      fromF, durF,
      declared_frames: durF,
      declared_duration_s: dur_s
    };
  });
  const totalF = list.reduce((m, s) => Math.max(m, s.fromF + s.durF), 0);
  return { shots: list, totalF, total_s: Number((totalF / canvas.fps).toFixed(3)) };
}

function buildCss(v, canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const portrait = canvas.portrait;
  // Q11：竖屏字高按短边 5.2% 口径抬到 ~92px，脚注/角标不再低不透明度。
  const TITLE_PX = Math.max(portrait ? 88 : 64, Math.round(w * (portrait ? 0.085 : 0.052)));
  const SUB_PX = Math.max(portrait ? 40 : 36, Math.round(w * (portrait ? 0.038 : 0.032)));
  const SMALL_PX = Math.max(portrait ? 36 : 32, Math.round(w * 0.034));
  // 安全区（hyperframes check 的 tiktok / reels / shorts 交集，9:16 1080x1920）：
  // 文本须落在 left>=120 / right<=780 / top>=288 / bottom<=1248。
  // CSS 百分比 padding 只按「宽度」解析（18% 只有 194px，够不到 288px），
  // 因此一律换算成 px：纵向按 h、横向按 w。
  // 下方 36% 是抖音/Reels 的交互 UI 保留带，按平台规范有意留白，不是空镜头。
  const PT = portrait ? Math.round(h * 0.18) : Math.round(h * 0.12);
  const PB = portrait ? Math.round(h * 0.36) : Math.round(h * 0.12);
  const PL = portrait ? Math.round(w * 0.13) : Math.round(w * 0.12);
  const PR = portrait ? Math.round(w * 0.30) : Math.round(w * 0.12);
  return fill(TPL_CSS, {
    GROUND: v.ground, INK: v.ink, ACCENT: v.accent, MUTED: v.muted,
    PANEL: v.panel, GRID: v.grid,
    PT: PT + "px", PB: PB + "px", PL: PL + "px", PR: PR + "px",
    TITLE_PX, SUB_PX, SMALL_PX
  });
}

function buildItems(s) {
  const arr = Array.isArray(s.copy.items) ? s.copy.items : [];
  if (s.layout === "card-grid") {
    return arr.map((it, i) => `<div class="mini-card"><span class="num">${pad2(i + 1)}</span><span class="label">${esc(it.label)}</span><span class="meta">${esc(it.meta)}</span></div>`).join("");
  }
  if (s.layout === "checklist") {
    return arr.map(it => `<div class="check-row${it.pending ? " check-row--pending" : ""}">${it.pending ? "· " : "✓ "}${esc(it.label)}</div>`).join("");
  }
  return "";
}

// C1：画面只出现面向观众的 copy，制作元数据一律留在 data-* 与 manifest。
function buildShotHtml(s, total) {
  const body = fill(layoutBody(s.layout), {
    N: pad2(s.index), TOTAL: pad2(total),
    CATEGORY_UPPER: esc(String(s.category).toUpperCase()),
    TITLE: esc(s.copy.title || s.caption || s.intent || ""),
    SUB: esc(s.copy.sub || ""),
    FOOT: esc(s.copy.foot || AIGC_LABEL),
    ITEMS: buildItems(s),
    METRIC: esc(s.copy.metric || "")
  });
  return fill(TPL_SHOT, {
    IDX: s.index, TRACK: s.index, N: pad2(s.index), TOTAL: pad2(total),
    START: s.start_s, DUR: s.dur_s,
    CARD_ID: esc(s.cardId), PRIMITIVE: esc(s.primitive),
    CATEGORY: esc(s.category), ENERGY: esc(s.energy),
    BODY: body
  });
}

function buildAudio(sb, total_s, warnings) {
  const audio = sb.audio || {};
  const bgm = audio.bgm || null;
  const parts = [];
  const used = [];
  if (bgm && bgm.ref) {
    parts.push(`<audio id="bgm" class="clip" data-start="0" data-duration="${total_s}" data-track-index="90" data-volume="${bgm.volume != null ? bgm.volume : 0.5}" src="./assets/audio/bgm/${esc(bgm.ref)}"></audio>`);
    used.push({ role: "bgm", file: bgm.ref, at: 0, duration_s: total_s });
  }
  (audio.sfx || []).forEach((x, i) => {
    const srcDur = SFX_DUR[x.file];
    if (!srcDur) { warnings.push("unknown sfx skipped: " + x.file); return; }
    const at = Number(x.at);
    if (!Number.isFinite(at) || at < 0) { warnings.push("bad sfx at: " + x.file); return; }
    // S4：音频裁到与动作严格等长；超尾的音效按剩余时长裁切（不产生 clip_ends_past_root_duration）。
    const dur = Number(Math.min(srcDur, Math.max(0, total_s - at)).toFixed(3));
    if (dur <= 0) { warnings.push("sfx starts after root end: " + x.file); return; }
    parts.push(`<audio id="sfx-${i + 1}" class="clip" data-start="${at}" data-duration="${dur}" data-track-index="${91 + i}" data-volume="${x.volume != null ? x.volume : 0.9}" src="./assets/audio/sfx/${esc(x.file)}"></audio>`);
    used.push({ role: "sfx", file: x.file, at, duration_s: dur, source_duration_s: srcDur, clamped: dur < srcDur });
  });
  return { html: parts.join(NL + "      "), used };
}

// R2：grid 只在镜头前段做非线性漂移，留 >=0.5s 静止；末镜完全不动。
// R3：开场主标 3s 字距动作弧；Q8：末镜能量峰值（品牌锁定 + 进度条推进）。
function buildTweens(shots, ease) {
  const lines = [];
  const lastIdx = shots.length;
  for (const s of shots) {
    const p = PRIMITIVES[s.primitive] || PRIMITIVES.fade;
    const bodyDur = Math.min(0.62, Math.max(0.32, s.dur_s * 0.24));
    // 首镜：社交平台把第 0 帧当封面缩略图，不能从 opacity 0 淡入
    // (craft first_frame_empty)。保留 crash-zoom 的 scale 动作弧，但起始就可见。
    const from = s.index === 1 ? { ...p.from, opacity: 1 } : p.from;
    lines.push(`tl.fromTo("#shot-${s.index}-body", ${JSON.stringify(from)}, ${JSON.stringify({ ...p.to, ease, duration: bodyDur })}, ${s.start_s});`);
    if (s.index !== lastIdx) {
      // R2：漂移只占镜头前段（power2.out 渐进收束），尾部留出 >=0.5s 静止；
      // 同时把「无变化」区间压到 3s 的 dead_stretch 门槛以下。末镜完全不动。
      const gridDur = Number(Math.max(0.6, Math.min(s.dur_s * 0.62, 2.6)).toFixed(3));
      lines.push(`tl.fromTo("#shot-${s.index}-grid", { x: 0, opacity: 0.35 }, { x: 18, opacity: 0.9, duration: ${gridDur}, ease: "power2.out" }, ${s.start_s});`);
    }
    if (s.index === 1) {
      // R3：3s 开场动作弧。只用 transform —— letterSpacing 会触发布局重排，
      // 被 hyperframes lint 判 gsap_non_transform_motion (error)。
      lines.push(`tl.fromTo("#shot-1-body .shot__title", { scale: 1.07, x: 14 }, { scale: 1, x: 0, duration: 3.0, ease: "power2.out" }, ${s.start_s});`);
    }
    if (s.index === lastIdx) {
      lines.push(`tl.fromTo("#shot-${s.index} .shot__bar span", { width: "0%" }, { width: "100%", duration: 1.2, ease: "power2.out" }, ${Number((s.start_s + 0.1).toFixed(3))});`);
    }
  }
  return fill(TPL_TL, { TWEENS: lines.join(NL) });
}

function buildPackageJson(id) {
  return JSON.stringify({
    name: id, private: true, type: "module",
    scripts: {
      dev: `npx --yes hyperframes@${HF_VERSION} preview`,
      check: `npx --yes hyperframes@${HF_VERSION} check`,
      render: `npx --yes hyperframes@${HF_VERSION} render`,
      publish: `npx --yes hyperframes@${HF_VERSION} publish`
    }
  }, null, 2);
}

function buildAttribution(sb, used) {
  const bgm = (sb.audio && sb.audio.bgm) || {};
  const rows = used.filter(u => u.role === "sfx").map(u => `  - ${u.file}  @ ${u.at}s  (${u.duration_s}s)`).join(NL);
  return [
    "CineForge 音频署名 / AUDIO ATTRIBUTION",
    "=====================================",
    "本文件随编译产物分发。上游 video-shotcraft 的两份 ATTRIBUTION.md 已原样保留于",
    "assets/audio/bgm/ 与 assets/audio/sfx/，不得从产物中删除。",
    "",
    "BGM",
    `  ${bgm.ref || "(none)"} — 派生自上游 assets/audio/bgm/cat-walk.mp3`,
    "  Cat Walk / Arulo / House / ~129 BPM",
    "  https://assets.mixkit.co/music/371/371.mp3",
    "  许可：Mixkit Stock Music Free License（免署名、可商用）",
    "  改动：裁切 20.00s；ffmpeg afade 淡入 0.4s / 淡出 1.2s；libmp3lame 128k。",
    "",
    "SFX（仅使用上游已核验的 6 个 Mixkit SFX Free License 项）",
    rows || "  (none)",
    "  许可：Mixkit SFX Free License。上游 template/public/audio/ATTRIBUTION.md 明确",
    "  这些音效不受仓库代码的 Apache-2.0 覆盖。",
    "  未使用 keyboard / riser-cine / sparkle / whoosh-big / pop（原始条目无法反查，",
    "  商用前须复核或换音）。",
    "",
    "代码许可：CineForge 编译器 Apache-2.0；上游 video-shotcraft Apache-2.0。",
    "成片归用户所有，可免费商用（上游 SKILL.md）。",
    ""
  ].join(NL);
}

function copyAssets(outDir, sb, used) {
  fs.mkdirSync(path.join(outDir, "vendor"), { recursive: true });
  fs.copyFileSync(path.join(LIB, "vendor", "gsap.min.js"), path.join(outDir, "vendor", "gsap.min.js"));
  const bgmDir = path.join(outDir, "assets", "audio", "bgm");
  const sfxDir = path.join(outDir, "assets", "audio", "sfx");
  fs.mkdirSync(bgmDir, { recursive: true });
  fs.mkdirSync(sfxDir, { recursive: true });
  const bgmRef = sb.audio && sb.audio.bgm && sb.audio.bgm.ref;
  if (bgmRef) fs.copyFileSync(path.join(AUDIO_SRC, "bgm", bgmRef), path.join(bgmDir, bgmRef));
  for (const f of Object.keys(SFX_DUR)) {
    const src = path.join(AUDIO_SRC, "sfx", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(sfxDir, f));
  }
  fs.copyFileSync(path.join(AUDIO_SRC, "bgm", "ATTRIBUTION.md"), path.join(bgmDir, "ATTRIBUTION.md"));
  fs.copyFileSync(path.join(AUDIO_SRC, "sfx", "ATTRIBUTION.md"), path.join(sfxDir, "ATTRIBUTION.md"));
  fs.writeFileSync(path.join(outDir, "assets", "audio", "ATTRIBUTION.md"), buildAttribution(sb, used), "utf8");
}

function compile(sb, opts) {
  const warnings = [];
  const presets = loadJson(path.join(ROOT, "knowledge", "platform-presets.json"));
  const cards = loadJson(path.join(ROOT, "knowledge", "shot-cards.json"));
  const canvas = resolveCanvas(sb.project || {}, presets);
  const v = parsePalette(sb.design_spec || {});
  const ease = resolveEase(sb.design_spec || {});
  const { shots, totalF, total_s } = normalizeShots(sb, cards, canvas);
  if (!shots.length) throw new Error("storyboard has no shots");
  const declaredF = Math.round(Number(sb.project.duration_s || total_s) * canvas.fps);
  if (declaredF !== totalF) warnings.push(`declared duration_s maps to ${declaredF}f but shots sum to ${totalF}f`);
  if (opts.strict && warnings.length) throw new Error("strict: " + warnings.join("; "));

  const audio = buildAudio(sb, total_s, warnings);
  const css = buildCss(v, canvas);
  const shotsHtml = shots.map(s => buildShotHtml(s, shots.length)).join(NL + "      ");
  const timeline = buildTweens(shots, ease);
  const title = (sb.project && (sb.project.brief || sb.project.idea)) || "CineForge";
  const lang = (sb.project && sb.project.language) || "zh";
  const html = fill(TPL_HTML, {
    LANG: esc(lang),
    RESOLUTION: canvas.aspect === "9:16" ? "portrait" : (canvas.aspect === "1:1" ? "square" : "landscape"),
    WIDTH: canvas.width, HEIGHT: canvas.height,
    DURATION: total_s,
    TITLE: esc(title),
    CSS: css,
    SHOTS: shotsHtml,
    AUDIO: audio.html,
    TIMELINE: timeline
  });

  const publish = sb.publish || {};
  const ai = publish.ai_disclosure || { explicit: false, implicit: false };
  const manifest = {
    schema: "cineforge/hf-manifest/v2",
    compiler_version: "0.3.0",
    project_id: sb.project.id,
    platform: canvas.platform, aspect: canvas.aspect,
    width: canvas.width, height: canvas.height, fps: canvas.fps,
    duration_s: total_s, total_frames: totalF,
    declared_duration_s: Number(sb.project.duration_s || total_s),
    declared_frames: declaredF,
    padding_seconds: 0,
    transforms: [],
    motion_tokens_id: (sb.design_spec && sb.design_spec.motion_tokens_id) || DEFAULT_TOKEN_ID,
    gsap_ease: ease,
    deterministic: true,
    primitive_policy: "shot.primitive is authoritative (SHOTS single source); transition_in/category are fallback only", seed: SEED,
    layouts: shots.map(s => ({ id: s.id, layout: s.layout, primitive: s.primitive })),
    shots: shots.map(s => ({
      id: s.id, card_id: s.cardId, category: s.category, primitive: s.primitive,
      layout: s.layout, start_s: s.start_s, dur_s: s.dur_s,
      declared_frames: s.declared_frames, energy: s.energy,
      title: s.copy.title || "", backend: s.backend
    })),
    audio: { bgm: (sb.audio && sb.audio.bgm) || null, sfx: audio.used },
    aigc: { explicit_label: AIGC_LABEL, explicit: !!ai.explicit, implicit: !!ai.implicit, metadata_sidecar: "aigc-metadata.json" },
    publish_allowed: !!(ai.explicit && ai.implicit) && !!publish.title && !!publish.description,
    gsap_vendor: "vendor/gsap.min.js (gsap 3.15.0, local, no CDN)",
    registry_pin: HF_REGISTRY_SHA,
    warnings
  };
  const aigcMeta = {
    schema: "cineforge/aigc/v1",
    generator: "CineForge / dsh-cineforge 0.3.0",
    upstream: "https://github.com/Vincentwei1021/video-shotcraft",
    upstream_license: "Apache-2.0",
    label: AIGC_LABEL,
    explicit: !!ai.explicit, implicit: !!ai.implicit,
    content_type: "AI-generated motion graphics (no real footage, no personal data)",
    seed: SEED, deterministic: true,
    note: "隐式标识：本 sidecar 与 index.html 的 meta[name=aigc] 随成片交付；上传平台前请按平台要求写入文件元数据。"
  };

  const outDir = opts.out || path.join(ROOT, "out", sb.project.id);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  fs.writeFileSync(path.join(outDir, "hyperframes.json"), JSON.stringify(HF_CONFIG, null, 2) + NL, "utf8");
  fs.writeFileSync(path.join(outDir, "package.json"), buildPackageJson(sb.project.id) + NL, "utf8");
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify({ id: sb.project.id, name: title, createdAt: "cineforge-deterministic" }, null, 2) + NL, "utf8");
  fs.writeFileSync(path.join(outDir, "project.json"), JSON.stringify(sb, null, 2) + NL, "utf8");
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + NL, "utf8");
  fs.writeFileSync(path.join(outDir, "aigc-metadata.json"), JSON.stringify(aigcMeta, null, 2) + NL, "utf8");
  copyAssets(outDir, sb, audio.used);
  return { outDir, manifest, total_s, totalF, shotCount: shots.length, audioCount: audio.used.length };
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const projectPath = a.project || path.join(ROOT, "examples", "demo-project.json");
  const sb = loadJson(projectPath);
  const r = compile(sb, { out: a.out, strict: a.strict });
  console.log(JSON.stringify({ ok: true, out: r.outDir, duration_s: r.total_s, frames: r.totalF, shots: r.shotCount, audio: r.audioCount, warnings: r.manifest.warnings }, null, 2));
}

export { compile, fill, normalizeShots, buildTweens, HF_CONFIG };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
