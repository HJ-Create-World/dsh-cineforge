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

// S5 / audio-lab 实测（原始 .local/audio-lab-report.md，归档 docs/QA-音频工程实测报告.md）：
// 每个 SFX 从文件起点到 |PCM| 峰值的滞后（秒，44.1kHz 逐样本）以及本管线的输出偏移。
// 分镜只写「目标峰值帧 peak_f」，由 buildAudio 统一按
//   from_s = peak_f / fps - peak_offset_s - OUTPUT_OFFSET_S
// 求起点；补偿在渲染层 from 计算式里统一扣，不逐条改帧号。
// 注意：这些常数绑定 hyperframes 0.9.88 / FFmpeg native AAC 48kHz / MP4(Lavf62.12.101) / 30fps。
// MP4 elst media_time=1024 已补偿 skip_samples，6/6 SFX 归一化互相关残差 0.000s；
// 判例的 2048 samples / 1.28f 在本管线未复现，换管线必须重测，不要直接搬运。
const SFX_PEAK_OFFSET_S = Object.freeze({
  "click-camera.mp3": 0.1945,
  "transition-soft.mp3": 0.4346,
  "transition-snap.mp3": 0.1174,
  "swoosh-quick.mp3": 0.2959,
  "whoosh-fast.mp3": 0.7128,
  "impact-cine.mp3": 0.5511
});
const OUTPUT_OFFSET_S = 0.0;

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
  const o = { project: null, out: null, strict: false, animatic: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project" || a === "-p") o.project = argv[++i];
    else if (a === "--out" || a === "-o") o.out = argv[++i];
    else if (a === "--strict") o.strict = true;
    else if (a === "--animatic") o.animatic = true;
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

// Q8：12 个确定性粒子，位置由 buildTweens 用同一三角函数公式推出（不写死坐标到 HTML）。
function buildSparks(s) {
  const rows = [];
  for (let i = 1; i <= 12; i++) rows.push(`  <span id="shot-${s.index}-spark-${i}" class="finale-spark" data-layout-ignore></span>`);
  return rows.join(NL);
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
    METRIC: esc(s.copy.metric || ""),
    SPARKS: buildSparks(s)
  });
  return fill(TPL_SHOT, {
    IDX: s.index, TRACK: s.index, N: pad2(s.index), TOTAL: pad2(total),
    MOD: s.layout === "hero" ? "hero" : (s.layout === "outro-finale" ? "finale" : "standard"),
    START: s.start_s, DUR: s.dur_s,
    CARD_ID: esc(s.cardId), PRIMITIVE: esc(s.primitive),
    CATEGORY: esc(s.category), ENERGY: esc(s.energy),
    BODY: body
  });
}

function buildAudio(sb, total_s, warnings, shots, fps) {
  const audio = sb.audio || {};
  const bgm = audio.bgm || null;
  const parts = [];
  const used = [];
  const F = fps || 30;
  if (bgm && bgm.ref) {
    parts.push(`<audio id="bgm" class="clip" data-start="0" data-duration="${total_s}" data-track-index="90" data-volume="${bgm.volume != null ? bgm.volume : 0.5}" src="./assets/audio/bgm/${esc(bgm.ref)}"></audio>`);
    used.push({ role: "bgm", file: bgm.ref, at: 0, duration_s: total_s, volume: bgm.volume != null ? bgm.volume : 0.5 });
  }
  (audio.sfx || []).forEach((x, i) => {
    const srcDur = SFX_DUR[x.file];
    if (!srcDur) { warnings.push("unknown sfx skipped: " + x.file); return; }
    const peakOff = SFX_PEAK_OFFSET_S[x.file] || 0;
    // S5：分镜写「目标峰值帧」，起点统一扣峰值滞后与管线输出偏移。
    // 兼容旧分镜的绝对 at：无 peak_f 时直接采用并记 warning（不做补偿）。
    let at;
    if (x.peak_f != null) {
      at = Number((x.peak_f / F - peakOff - OUTPUT_OFFSET_S).toFixed(3));
    } else {
      at = Number(x.at);
      warnings.push("legacy sfx uses absolute at without peak compensation: " + x.file);
    }
    if (!Number.isFinite(at) || at < 0) { warnings.push("bad/negative sfx start after peak compensation: " + x.file); return; }
    // S4：裁到「当前镜头结束」而不是全片尾；0.3.1 的 bug 是 impact-cine 4.063s 越过 s01 的 3s 边界。
    const owner = (shots || []).find(s => at >= s.start_s && at < s.end_s) || null;
    const limit = owner ? owner.end_s : total_s;
    const dur = Number(Math.max(0, Math.min(srcDur, limit - at, total_s - at)).toFixed(3));
    if (dur <= 0) { warnings.push("sfx starts at or after shot end: " + x.file); return; }
    const vol = x.volume != null ? x.volume : 0.9;
    parts.push(`<audio id="sfx-${i + 1}" class="clip" data-start="${at}" data-duration="${dur}" data-track-index="${91 + i}" data-volume="${vol}" src="./assets/audio/sfx/${esc(x.file)}"></audio>`);
    used.push({
      role: "sfx", file: x.file, at, duration_s: dur, source_duration_s: srcDur,
      clamped: dur < srcDur, volume: vol,
      shot_id: owner ? owner.id : null, shot_end_s: limit,
      peak_f: x.peak_f != null ? x.peak_f : null,
      peak_offset_s: peakOff, output_offset_s: OUTPUT_OFFSET_S,
      action: x.action || ""
    });
  });
  return { html: parts.join(NL + "      "), used };
}

// R2：grid 只在镜头前段做非线性漂移，留 >=0.5s 静止；末镜完全不动。
// Q5：开场 hero 单主体五段弧「聚光 → 推近 → 描边光 → 悬浮 → 归位」，首帧非空。
// Q8：收尾 finale 发布会合影（四方飞入 + 舞台光 + 12 粒子 + 字标落定 + 进度条），
//     全部 tween 止于 1.81s，片尾 hold >=30f，18.5s 与 19.75s 不再逐字节相同。
function buildTweens(shots, ease) {
  const lines = [];
  const lastIdx = shots.length;
  for (const s of shots) {
    const p = PRIMITIVES[s.primitive] || PRIMITIVES.fade;
    const bodyDur = Math.min(0.62, Math.max(0.32, s.dur_s * 0.24));
    const t = s.start_s;
    const q = (n) => Number((t + n).toFixed(3));
    const EASE = `ease: "${ease}"`;

    if (s.layout === "hero") {
      // 1 聚光 → 2 推近（opacity 恒 1，保证第 0 帧非空）→ 3 描边光 → 4 悬浮 → 5 归位
      lines.push(`tl.fromTo("#shot-${s.index} .hero-glow", { opacity: 0.30, scale: 0.55 }, { opacity: 1, scale: 1, duration: 0.80, ease: "power2.out" }, ${q(0)});`);
      lines.push(`tl.fromTo("#shot-${s.index} .hero-title", { opacity: 1, scale: 1.28 }, { opacity: 1, scale: 1, duration: 1.40, ease: "power2.out" }, ${q(0)});`);
      lines.push(`tl.fromTo("#shot-${s.index} .hero-ring", { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.90, ease: "power2.out" }, ${q(0.35)});`);
      lines.push(`tl.to("#shot-${s.index} .hero-main", { y: -18, duration: 0.55, ease: "sine.inOut" }, ${q(1.35)});`);
      lines.push(`tl.to("#shot-${s.index} .hero-main", { y: 0, duration: 0.55, ease: "sine.inOut" }, ${q(1.90)});`);
      lines.push(`tl.fromTo("#shot-${s.index} .hero-sub", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.50, ease: "power2.out" }, ${q(1.55)});`);
      lines.push(`tl.to("#shot-${s.index} .hero-ring", { scale: 1.04, duration: 0.35, ease: "power2.out" }, ${q(2.45)});`);
      lines.push(`tl.fromTo("#shot-${s.index}-grid", { x: 0, opacity: 0.30 }, { x: 14, opacity: 0.42, duration: 2.20, ease: "power2.out" }, ${q(0)});`);
      continue;
    }

    if (s.layout === "outro-finale") {
      lines.push(`tl.fromTo("#shot-${s.index} .finale-beam", { opacity: 0.30, scaleY: 0.55 }, { opacity: 1, scaleY: 1, duration: 0.70, ease: "power2.out" }, ${q(0)});`);
      const chips = [["tl", -300, -220], ["tr", 300, -220], ["bl", -300, 220], ["br", 300, 220]];
      chips.forEach((c, i) => {
        lines.push(`tl.fromTo("#shot-${s.index} .finale-chip--${c[0]}", { opacity: 0, x: ${c[1]}, y: ${c[2]}, scale: 0.82 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.72, ${EASE} }, ${q(0.20 + i * 0.14)});`);
      });
      // 12 粒子：确定性三角函数分布，禁 Math.random，保证任意 seek 可复现
      for (let i = 1; i <= 12; i++) {
        const ang = (i - 1) * Math.PI / 6;
        const rad = 240 + (i % 3) * 70;
        const dx = Math.round(Math.cos(ang) * rad);
        const dy = Math.round(Math.sin(ang) * rad);
        lines.push(`tl.fromTo("#shot-${s.index}-spark-${i}", { x: 0, y: 0, opacity: 1, scale: 0.4 }, { x: ${dx}, y: ${dy}, opacity: 0, scale: 1.5, duration: 0.85, ease: "power2.out" }, ${q(0.75 + (i % 4) * 0.07)});`);
      }
      lines.push(`tl.fromTo("#shot-${s.index} .finale-wordmark", { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.75, ${EASE} }, ${q(0.55)});`);
      lines.push(`tl.fromTo("#shot-${s.index} .finale-tagline", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, ${q(1.35)});`);
      lines.push(`tl.fromTo("#shot-${s.index} .shot__bar span", { width: "0%" }, { width: "100%", duration: 1.20, ease: "power2.out" }, ${q(0.10)});`);
      continue;
    }

    // 通用镜头：整块 body 入场
    const from = s.index === 1 ? { ...p.from, opacity: 1 } : p.from;
    lines.push(`tl.fromTo("#shot-${s.index}-body", ${JSON.stringify(from)}, ${JSON.stringify({ ...p.to, ease, duration: bodyDur })}, ${t});`);
    if (s.index !== lastIdx) {
      const gridDur = Number(Math.max(0.6, Math.min(s.dur_s * 0.62, 2.6)).toFixed(3));
      lines.push(`tl.fromTo("#shot-${s.index}-grid", { x: 0, opacity: 0.35 }, { x: 18, opacity: 0.9, duration: ${gridDur}, ease: "power2.out" }, ${t});`);
    }
    // R2/R3 保留项：功能镜头逐条落定，取代「整块位移」的假动效
    if (s.layout === "card-grid") {
      for (let i = 0; i < 3; i++) lines.push(`tl.fromTo("#shot-${s.index}-body .mini-card:nth-child(${i + 1})", { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.45, ${EASE} }, ${q(0.18 + i * 0.14)});`);
    }
    if (s.layout === "checklist") {
      for (let i = 0; i < 3; i++) lines.push(`tl.fromTo("#shot-${s.index}-body .check-row:nth-child(${i + 1})", { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.32, ${EASE} }, ${q(0.35 + i * 0.42)});`);
    }
    if (s.layout === "metric") {
      lines.push(`tl.fromTo("#shot-${s.index}-body .metric-num", { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.50, ${EASE} }, ${q(0.35)});`);
    }
    if (s.index === lastIdx) {
      lines.push(`tl.fromTo("#shot-${s.index} .shot__bar span", { width: "0%" }, { width: "100%", duration: 1.2, ease: "power2.out" }, ${Number((t + 0.1).toFixed(3))});`);
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
  const rows = used.filter(u => u.role === "sfx").map(u => `  - ${u.file}  @ ${u.at}s  (${u.duration_s}s / ${u.shot_id || "root"})${u.peak_f != null ? " peak@f" + u.peak_f : ""}${u.action ? " - " + u.action : ""}${u.clamped ? " [clamped to shot end]" : ""}`).join(NL);
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
    "SFX（本片使用上游已核验的 5 个 Mixkit SFX Free License 项；swoosh-quick 保留在素材库但未使用）",
    rows || "  (none)",
    "  许可：Mixkit SFX Free License。上游 template/public/audio/ATTRIBUTION.md 明确",
    "  这些音效不受仓库代码的 Apache-2.0 覆盖。",
    "  未使用 keyboard / riser-cine / sparkle / whoosh-big / pop（原始条目无法反查，",
    "  商用前须复核或换音）。",
    "",
    "代码许可：CineForge 编译器 Apache-2.0；上游 video-shotcraft Apache-2.0。",
    "成片著作权归用户；第三方音频与代码各受其许可约束（见上），商用前请复核。",
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

  const audio = buildAudio(sb, total_s, warnings, shots, canvas.fps);
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
  // P0：极限词/权益宣称自检只扫「会进画面的文案」，内部定位文案不计。
  const screenText = shots.flatMap(s => Object.values(s.copy || {}).flatMap(v => Array.isArray(v) ? v.map(x => String(x.label || "") + " " + String(x.meta || "")) : [String(v)])).join(" ");
  const legalHits = screenText.match(/导演级|Opus|最优|第一|免费商用|绝对|100%|顶级|最好/g) || [];
  const manifest = {
    schema: "cineforge/hf-manifest/v2",
    compiler_version: "0.4.2",
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
    audio_alignment: {
      schema: "cineforge/audio-alignment/v1",
      formula: "from_s = peak_f / fps - SFX_PEAK_OFFSET_S[file] - OUTPUT_OFFSET_S",
      fps: canvas.fps, output_offset_s: OUTPUT_OFFSET_S,
      pipeline: "hyperframes 0.9.88 / FFmpeg native AAC 48kHz / MP4 (Lavf62.12.101) / 30fps",
      pipeline_note: "MP4 elst media_time=1024 已补偿 skip_samples；6/6 SFX 归一化互相关残差 0.000s；判例 2048 samples / 1.28f 在本管线未复现。换管线须重测。",
      peak_offset_s: SFX_PEAK_OFFSET_S,
      evidence: "docs/QA-音频工程实测报告.md",
      sfx: audio.used.filter(u => u.role === "sfx").map(u => ({
        file: u.file, peak_f: u.peak_f, peak_offset_s: u.peak_offset_s,
        computed_at_s: u.at, end_s: Number((u.at + u.duration_s).toFixed(3)),
        shot_id: u.shot_id, clamped_to_shot_end: u.clamped, action: u.action
      }))
    },
    aigc: { explicit_label: AIGC_LABEL, explicit: !!ai.explicit, implicit: !!ai.implicit, metadata_sidecar: "aigc-metadata.json" },
    publish_allowed: !!(ai.explicit && ai.implicit) && !!publish.title && !!publish.description,
    legal_word_check: {
      performed: true, scope: "on-screen copy (shots[].copy) only",
      on_screen_hits: legalHits, clean: legalHits.length === 0,
      note: "project.idea / spec.json 措辞仅为内部定位，未进入画面；发布前仍须人工复核平台规范。"
    },
    conscious_violations: [
      { rule: "Q11", reason: "9:16 下辅助文字 >=5.2% 帧高 = 100px 与抖音字幕安全区冲突；采用 >=32px（实测 37px），口径见 docs/视觉规范与口径.md。" },
      { rule: "Q7", reason: "styleframe_refs=[]，一期为模板可行性验证片，无真实页面截图，非复刻场景。" },
      { rule: "C1", reason: "voiceover=[]，纯字卡段落无解说与硬字幕轨；一期 NOT FOR PUBLISH。" }
    ],
    gsap_vendor: "vendor/gsap.min.js (gsap 3.15.0, local, no CDN)",
    registry_pin: HF_REGISTRY_SHA,
    warnings
  };
  const aigcMeta = {
    schema: "cineforge/aigc/v1",
    generator: "CineForge / dsh-cineforge 0.4.2",
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

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const projectPath = a.project || path.join(ROOT, "examples", "demo-project.json");
  const sb = loadJson(projectPath);
  const r = compile(sb, { out: a.out, strict: a.strict });
  const out = { ok: true, out: r.outDir, duration_s: r.total_s, frames: r.totalF, shots: r.shotCount, audio: r.audioCount, warnings: r.manifest.warnings };
  if (a.animatic) {
    // 预览片：画面是定妆帧、时间线与声音是真的。不能当验收依据，也不发布。
    const { buildAnimatic } = await import("../lib/animatic.mjs");
    const { resolveFfmpeg } = await import("../lib/ffmpeg.mjs");
    const ff = resolveFfmpeg(process.env);
    if (!ff.ffmpeg) { console.error("animatic: 找不到 ffmpeg，请设 CINEFORGE_FFMPEG 或装到 PATH"); process.exit(3); }
    const an = await buildAnimatic({ project: sb, outDir: path.join(r.outDir, "animatic"), ffmpeg: ff.ffmpeg, audioDir: path.join(ROOT, "assets", "audio") });
    out.animatic = { mp4: an.file, duration_s: an.duration_s, shots: an.shots, fps: an.fps, audio_tracks: an.audio_tracks, build_ms: an.build_ms, warnings: an.warnings };
  }
  console.log(JSON.stringify(out, null, 2));
}

export { compile, fill, normalizeShots, buildTweens, HF_CONFIG };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((e) => { console.error(String(e && e.stack || e)); process.exit(1) });
