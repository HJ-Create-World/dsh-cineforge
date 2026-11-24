#!/usr/bin/env node
// CineForge · 分镜 JSON -> HyperFrames 工程编译器（一期）
//
// 输入：符合 knowledge/storyboard.schema.json 的 project.json（SHOTS 是唯一事实源）。
// 输出：可直接 npx hyperframes check / snapshot / render 的 HyperFrames 工程。
//
// 一期取舍：10 类镜头映射到 7 个确定性 GSAP 原语；124 卡逐卡精确映射属三期。
// 全部产物确定性：不读时钟、不掷随机数、不访问网络。
//
// 用法：node scripts/compile-hf.mjs --project <project.json> [--out <dir>] [--strict]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIMITIVES, resolvePrimitive, resolveEase, DEFAULT_TOKEN_ID } from "../lib/hf-primitives.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NL = String.fromCharCode(10);
const HF_VERSION = "0.9.88";
const LIB = join(ROOT, "lib");

const TPL_HTML = readFileSync(join(LIB, "hf-template.html"), "utf8");
const TPL_CSS = readFileSync(join(LIB, "hf-template.css"), "utf8");
const TPL_SHOT = readFileSync(join(LIB, "hf-shot.html"), "utf8");
const TPL_TL = readFileSync(join(LIB, "hf-timeline.js"), "utf8");

const ASPECT_PX = {
  "16:9": [1920, 1080], "9:16": [1080, 1920], "3:4": [1080, 1440],
  "4:3": [1440, 1080], "1:1": [1080, 1080], "21:9": [2560, 1080]
};

function fill(tpl, map) {
  let out = tpl;
  for (const k of Object.keys(map)) out = out.split("{{" + k + "}}").join(String(map[k]));
  return out;
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

function loadJson(p) { return JSON.parse(readFileSync(p, "utf8")); }

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeColor(v, fallback) {
  const s = String(v == null ? "" : v).trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^rgba?[(][0-9.,% ]+[)]$/.test(s)) return s;
  if (/^[a-zA-Z]{3,20}$/.test(s)) return s;
  return fallback;
}

function parsePalette(ds) {
  const raw = ds && ds.palette;
  const p = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
  return {
    ground: safeColor(p.ground || p.bg || p.background, "#0B0E14"),
    ink: safeColor(p.ink || p.fg || p.text, "#F5F1E8"),
    accent: safeColor(p.accent || p.primary || p.highlight, "#D3923C"),
    muted: safeColor(p.muted || p.secondary, "#8A8F9A"),
    panel: safeColor(p.panel || p.surface, "#151A24")
  };
}

function resolveCanvas(project, presets) {
  const pid = String((project && project.platform) || "bilibili");
  const list = (presets && presets.platforms) || [];
  const pp = list.find((x) => x.id === pid) || list[0] || {};
  const aspect = String((project && project.aspect) || pp.aspect || "16:9");
  const wh = ASPECT_PX[aspect] || ASPECT_PX["16:9"];
  const common = (presets && presets.common) || {};
  const fps = Number(common.fps) > 0 ? Number(common.fps) : 30;
  const portrait = wh[1] > wh[0];
  return {
    width: wh[0], height: wh[1], aspect, platform: pid, fps, portrait,
    safeRight: portrait ? "13%" : "6%",
    safeBottom: portrait ? "18%" : "8%"
  };
}

function normalizeShots(sb, cards, canvas, strict, warnings) {
  const catById = new Map(((cards && cards.cards) || []).map((c) => [String(c.id), String(c.category)]));
  const raw = Array.isArray(sb.shots) ? sb.shots : [];
  if (!raw.length) {
    if (strict) throw new Error("shots 为空，无法编译");
    warnings.push("shots 为空：已生成一个占位镜头");
  }
  const list = raw.length ? raw : [{ id: "placeholder", caption: "CineForge", intent: "占位镜头", duration_f: canvas.fps * 3 }];
  let cursorF = 0;
  const shots = list.map((s, i) => {
    const hasSec = s.from_s != null || s.duration_s != null;
    const fromF = Number(s.from != null ? s.from : cursorF);
    const durF = Number(s.duration_f != null ? s.duration_f : Math.round(canvas.fps * 3));
    const start_s = hasSec ? Number(s.from_s != null ? s.from_s : 0) : fromF / canvas.fps;
    const dur_s = hasSec ? Number(s.duration_s != null ? s.duration_s : 3) : durF / canvas.fps;
    cursorF = Math.max(fromF + Math.max(durF, 1), cursorF + Math.max(durF, 1));
    const cardId = String(s.card_id || "");
    const category = catById.get(cardId) || String(s.category || "typography");
    return {
      index: i, id: String(s.id || ("shot-" + i)),
      cardId, cardStyle: String(s.card_style_key || ""),
      category, primitive: resolvePrimitive(s, category),
      backend: String(s.backend || "hyperframes"),
      intent: String(s.intent || ""), action: String(s.action || ""),
      caption: String(s.caption || ""), assetRef: String(s.asset_ref || ""),
      sfxCue: String(s.sfx_cue || ""), beatAnchor: String(s.beat_anchor || ""),
      energy: String(s.energy || ""),
      transitionIn: String(s.transition_in || ""), transitionOut: String(s.transition_out || ""),
      start_s: Math.max(0, start_s), dur_s: Math.max(0.2, dur_s),
      end_s: Math.max(0, start_s) + Math.max(0.2, dur_s),
      fromF, durF
    };
  });
  // 收尾留白：上游审美准则 R1「品牌字标 hold 满 1 秒」/ R2「收尾 0.5s 停顿」
  // 与 HyperFrames line_unread（结尾行需 >=2s 可读）共同要求片尾留一段静止。
  // 给最后一镜补 0.6s，文字仍在屏上且 grid 漂移持续，故不产生 dead_stretch。
  if (shots.length) {
    const last = shots[shots.length - 1];
    const pad = 0.6;
    last.dur_s = Number((last.dur_s + pad).toFixed(3));
    last.end_s = Number((last.end_s + pad).toFixed(3));
    last.durF = last.durF + Math.round(pad * canvas.fps);
  }
  return shots;
}

// 安全区内缩（px）。数值来自 HyperFrames 0.9.88 的 SOCIAL_SAFE_AREAS：
//   TikTok 720x1280 clearBands [160,560,80,640] / [560,840,80,520]
//   Reels  100x100  clearBands [14,65,6,94]
//   Shorts 1080x1920 clearBands [288,1248,48,888]
// 换算到 1080x1920 后取最严交集：top >= 288px(15%)、bottom <= 1248px(65%)、
// left >= 120px(11.1%)、right <= 780px(72.2%)。故竖屏用 18/38/13/30。
// 横屏只有 title-safe 80% 框（四边 10%），统一 12%。
function buildCss(v, canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const pct = (n) => Math.round(h * n / 100);
  const px = (n) => Math.round(w * n / 100);
  const inset = canvas.portrait
    ? { pt: pct(18), pb: pct(38), pl: px(13), pr: px(30) }
    : { pt: pct(12), pb: pct(12), pl: px(12), pr: px(12) };
  return fill(TPL_CSS, {
    GROUND: v.ground, INK: v.ink, ACCENT: v.accent, MUTED: v.muted, PANEL: v.panel,
    WIDTH: w, HEIGHT: h,
    PT: inset.pt, PB: inset.pb, PL: inset.pl, PR: inset.pr,
    TITLE_PX: Math.max(64, Math.round(w * (canvas.portrait ? 0.060 : 0.052))),
    SUB_PX: Math.max(36, Math.round(w * 0.032)),
    SMALL_PX: Math.max(32, Math.round(w * 0.032))
  });
}

function buildShotHtml(s, total) {
  const n = String(s.index + 1).padStart(2, "0");
  return fill(TPL_SHOT, {
    IDX: s.index, TRACK: s.index, N: n, TOTAL: total,
    START: Number(s.start_s.toFixed(3)), DUR: Number(s.dur_s.toFixed(3)),
    CARD_ID: esc(s.cardId), PRIMITIVE: esc(s.primitive),
    CATEGORY: esc(s.category), CATEGORY_UPPER: esc(s.category.toUpperCase()),
    ENERGY: esc(s.energy),
    TITLE: esc(s.caption || s.intent || ("镜头 " + n)),
    SUB: esc(s.action || s.intent),
    FOOT: esc(s.cardId + "  ·  " + s.primitive)
  });
}

function buildTweens(shots, ease) {
  const out = [];
  for (const s of shots) {
    const p = PRIMITIVES[s.primitive] || PRIMITIVES.fade;
    const from = Object.assign({ immediateRender: false }, p.from);
    const to = Object.assign({}, p.to, {
      ease, immediateRender: false,
      duration: Math.min(Number(p.to.duration) || 0.5, s.dur_s * 0.7)
    });
    out.push("tl.fromTo(" + JSON.stringify("#shot-" + s.index + "-body") + ", "
      + JSON.stringify(from) + ", " + JSON.stringify(to) + ", "
      + Number(s.start_s.toFixed(3)) + ");");
    // 覆盖整镜时长的极缓漂移：保证任意时刻画面都在变化（HyperFrames dead_stretch 阈值 3s）。
    // 只 tween 非 .clip 子元素的 transform，且 CSS 里该元素无 transform，故不触发 gsap_css_transform_conflict。
    out.push("tl.fromTo(" + JSON.stringify("#shot-" + s.index + "-grid")
      + ", { x: 0 }, { x: 26, duration: " + Number(s.dur_s.toFixed(3))
      + ", ease: " + JSON.stringify("none") + " }, " + Number(s.start_s.toFixed(3)) + ");");
  }
  return out.join(NL);
}

function buildHtml(sb, shots, canvas, v, ease, total) {
  const css = buildCss(v, canvas).split(NL).map((l) => "    " + l).join(NL);
  const shotsHtml = shots.map((s) => buildShotHtml(s, shots.length)).join(NL);
  const tweens = buildTweens(shots, ease);
  const timeline = fill(TPL_TL, { TWEENS: tweens });
  const title = String((sb.project && (sb.project.brief || sb.project.idea)) || "CineForge");
  return fill(TPL_HTML, {
    LANG: String((sb.project && sb.project.language) || "zh-CN"),
    RESOLUTION: canvas.portrait ? "portrait" : "landscape",
    WIDTH: canvas.width, HEIGHT: canvas.height,
    DURATION: total, TITLE: esc(title),
    CSS: css, SHOTS: shotsHtml, TIMELINE: timeline
  });
}

function buildPackageJson(id) {
  return JSON.stringify({
    name: id, private: true, type: "module",
    scripts: {
      dev: "npx --yes hyperframes@" + HF_VERSION + " preview",
      check: "npx --yes hyperframes@" + HF_VERSION + " check",
      render: "npx --yes hyperframes@" + HF_VERSION + " render",
      publish: "npx --yes hyperframes@" + HF_VERSION + " publish"
    },
    cineforge: { compiler: "dsh-cineforge", backend: "hyperframes", version: HF_VERSION }
  }, null, 2) + NL;
}

const HF_CONFIG = JSON.stringify({
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
  media: { autoProxy: true }
}, null, 2) + NL;

function compile(sb, opts) {
  const warnings = [];
  const presets = loadJson(join(ROOT, "knowledge", "platform-presets.json"));
  const cards = loadJson(join(ROOT, "knowledge", "shot-cards.json"));
  const project = sb.project || {};
  for (const k of ["project", "design_spec", "shots"]) {
    if (!sb[k] && opts.strict) throw new Error("缺少必填字段 " + k);
  }
  if (!sb.design_spec) warnings.push("缺少 design_spec：已使用默认纸墨琥珀配色与 professional-trust 动效预设");
  const canvas = resolveCanvas(project, presets);
  const v = parsePalette(sb.design_spec);
  const ease = resolveEase(sb.design_spec);
  const shots = normalizeShots(sb, cards, canvas, opts.strict, warnings);
  const declared = Number(project.duration_s) || 0;
  const computed = shots.reduce((m, s) => Math.max(m, s.end_s), 0);
  const total = Number(Math.max(declared, computed, 1).toFixed(3));
  const nonHf = shots.filter((s) => s.backend && s.backend !== "hyperframes");
  if (nonHf.length) warnings.push(nonHf.length + " 个镜头声明 backend=" + nonHf[0].backend + "：一期统一由 HyperFrames 原语近似渲染");
  const known = new Set((cards.cards || []).map((c) => String(c.id)));
  const unknown = shots.filter((s) => s.cardId && !known.has(s.cardId));
  if (unknown.length) warnings.push(unknown.length + " 个 card_id 不在 124 卡库中：" + unknown.map((s) => s.cardId).join(", "));
  const files = {
    "index.html": buildHtml(sb, shots, canvas, v, ease, total),
    "hyperframes.json": HF_CONFIG,
    "package.json": buildPackageJson(String(project.id || "cineforge-film")),
    "meta.json": JSON.stringify({ id: String(project.id || "cineforge-film"), name: String(project.brief || project.idea || "CineForge"), createdAt: "cineforge-deterministic" }, null, 2) + NL,
    "project.json": JSON.stringify(sb, null, 2) + NL,
    "manifest.json": JSON.stringify({
      schema: "cineforge/hf-manifest/v1",
      compiler: "dsh-cineforge/scripts/compile-hf.mjs",
      backend: "hyperframes", backend_version: HF_VERSION,
      project_id: String(project.id || "cineforge-film"),
      platform: canvas.platform, aspect: canvas.aspect,
      width: canvas.width, height: canvas.height, fps: canvas.fps,
      duration_s: total, duration_frames: Math.round(total * canvas.fps),
      composition_id: "main",
      motion_tokens_id: String((sb.design_spec && sb.design_spec.motion_tokens_id) || DEFAULT_TOKEN_ID),
      gsap_ease: ease, shot_count: shots.length, deterministic: true,
      shots: shots.map((s) => ({
        id: s.id, card_id: s.cardId, category: s.category, primitive: s.primitive,
        start_s: Number(s.start_s.toFixed(3)), dur_s: Number(s.dur_s.toFixed(3)),
        from_f: s.fromF, duration_f: s.durF, backend: s.backend
      })), warnings
    }, null, 2) + NL
  };
  return { files, warnings, canvas, shots, total };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const projPath = opts.project || join(ROOT, "examples", "demo-project.json");
  if (!existsSync(projPath)) throw new Error("找不到分镜文件：" + projPath);
  const sb = loadJson(projPath);
  const result = compile(sb, opts);
  const id = String((sb.project && sb.project.id) || "cineforge-film");
  const outDir = resolve(opts.out || join(ROOT, "out", id));
  mkdirSync(outDir, { recursive: true });
  for (const [name, text] of Object.entries(result.files)) writeFileSync(join(outDir, name), text, "utf8");
  console.log(JSON.stringify({
    ok: true, out_dir: outDir, files: Object.keys(result.files),
    platform: result.canvas.platform, aspect: result.canvas.aspect,
    size: result.canvas.width + "x" + result.canvas.height,
    fps: result.canvas.fps, duration_s: result.total,
    shots: result.shots.length, warnings: result.warnings
  }, null, 2));
  if (opts.strict && result.warnings.length) process.exitCode = 2;
}

main();
