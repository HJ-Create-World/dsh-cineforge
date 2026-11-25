/**
 * CineForge / animatic 生成器（零依赖 · 纯 ffmpeg）
 *
 * animatic 是什么：把已确认的分镜编译成低分辨率、静帧驱动，但**时间线与声音完全真实**的预览片。
 * 它解决的是行业里最常见的一次翻车 —— 分镜图上每张都好看，剪起来节奏不对，
 * 而等到成片渲染完（几分钟）才发现，节奏问题已经烧进每一帧。
 *
 * 为什么不用 HyperFrames 渲染一遍再降分辨率：
 *   渲染是分钟级、需要浏览器与 npx，还不能在用户拖分镜时反复重跑。
 *   animatic 要的是「改完立刻看到新节奏」，所以这里用 ffmpeg 直接拼：
 *   每镜一张定妆卡（真实文字/序号/时长/分类/能量）→ 按真实帧数切时长 →
 *   BGM 与 SFX 用真实时间轴混音。20 秒片约 1–3 秒出片，40 镜也只要十几秒。
 *
 * 诚实边界（UI 里也要写）：
 *   - 画面不是最终画质，动效只用淡入近似，不能当验收依据；
 *   - 文字内容是分镜里的真实文案，但版式与成片不完全一致；
 *   - 不能发布。
 */
import fs from "node:fs";
import path from "node:path";
import { run } from "./ffmpeg.mjs";

const FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc";
const FONT_REG = "C:/Windows/Fonts/msyh.ttc";
export const ANIMATIC_FPS = 24;

/** ffmpeg filter 里出现这些字符会破坏语法，直接换成安全的空格。 */
function clean(s) {
  return String(s == null ? "" : s).replace(/[\\':%,;\[\]=\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
}
/** 路径要进 filter，冒号必须转义。 */
function fpath(p) { return String(p).replace(/\\/g, "/").replace(/:/g, "\\:"); }

/** 按字符宽度折行（中文按 1 个宽度，英文按 0.56）。 */
export function wrapText(text, maxWidth) {
  const s = String(text == null ? "" : text).trim();
  if (!s) return [];
  const lines = [];
  let cur = "";
  let w = 0;
  for (const ch of s) {
    const cw = /[\u4e00-\u9fff\uff00-\uffef]/.test(ch) ? 1 : 0.56;
    if (w + cw > maxWidth && cur) { lines.push(cur); cur = ""; w = 0; }
    cur += ch; w += cw;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 画布尺寸：竖屏 540×960，横屏 960×540，方 540×540。 */
export function canvasOf(aspect) {
  if (aspect === "9:16") return { w: 540, h: 960, portrait: true };
  if (aspect === "1:1") return { w: 540, h: 540, portrait: false };
  if (aspect === "3:4") return { w: 540, h: 720, portrait: true };
  if (aspect === "4:3") return { w: 720, h: 540, portrait: false };
  return { w: 960, h: 540, portrait: false };
}

/** 分镜 → 真实时间轴（按 from 排序；缺 from 时按顺序累加）。 */
export function timelineOf(project) {
  const p = (project && project.project) || {};
  const fps = Number(p.fps) || 30;
  const list = ((project && project.shots) || []).slice();
  let cursor = 0;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i] || {};
    const durF = Math.max(1, Math.round(Number(s.duration_f) || 90));
    const fromF = Number.isFinite(Number(s.from)) ? Math.round(Number(s.from)) : cursor;
    const start_s = fromF / fps;
    const dur_s = durF / fps;
    out.push({ index: i, id: s.id || ("s" + String(i + 1).padStart(2, "0")), shot: s, start_s: start_s, dur_s: dur_s, durF: durF, fromF: fromF, end_s: Number((start_s + dur_s).toFixed(3)) });
    cursor = fromF + durF;
  }
  const total_s = out.length ? Math.max.apply(null, out.map(function (x) { return x.end_s; })) : 0;
  return { fps: fps, total_s: total_s, shots: out };
}

/** 调色板 → ffmpeg 颜色字面量（0xRRGGBB）。 */
export function animaticColors(project) {
  const pal = ((project && project.design_spec && project.design_spec.palette) || {});
  return {
    ground: String(pal.ground || "#0B0E14").replace("#", "0x"),
    ink: String(pal.ink || "#F4F1EA").replace("#", "0x"),
    accent: String(pal.accent || "#D3923C").replace("#", "0x"),
    muted: String(pal.muted || "#C9C3B6").replace("#", "0x"),
  };
}

const CAT_CN = { opening: "开场", typography: "字卡", "ui-entrance": "界面", transition: "转场", effects: "特效", interaction: "交互", camera: "运镜", rhythm: "节奏", outro: "收尾", data: "数据" };

/** 生成「定妆卡」：一镜一张 PNG。真实文字 + 序号 + 时长 + 分类，一眼能认出是哪一镜。 */
export function frameFilter(shot, total, canvas, col) {
  const s = shot.shot || {};
  const copy = s.copy || {};
  const title = copy.title || s.intent || s.card_id || "";
  const sub = copy.sub || "";
  const pad = Math.round(canvas.w * 0.11);
  const titleSize = Math.round(canvas.w * (canvas.portrait ? 0.062 : 0.052));
  const subSize = Math.round(canvas.w * 0.036);
  const smallSize = Math.round(canvas.w * 0.028);
  const maxW = Math.floor((canvas.w - pad * 2) / (titleSize * 0.52));
  const titleLines = wrapText(title, Math.max(6, maxW)).slice(0, 3);
  const subLines = wrapText(sub, Math.max(8, Math.floor(maxW * 1.5))).slice(0, 2);
  const cy = Math.round(canvas.h * 0.46);
  const totalH = titleLines.length * titleSize * 1.38 + subLines.length * subSize * 1.7;
  let y = Math.round(cy - totalH / 2);

  const f = [];
  f.push("color=c=" + col.ground + ":s=" + canvas.w + "x" + canvas.h + ":d=1");
  f.push("drawtext=fontfile='" + fpath(FONT_BOLD) + "':text='S" + String(shot.index + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0") + "':x=" + pad + ":y=" + Math.round(canvas.h * 0.06) + ":fontsize=" + smallSize + ":fontcolor=" + col.accent);
  const meta = [CAT_CN[s.category] || s.category || "", s.energy || ""].filter(Boolean).join(" · ");
  if (meta) f.push("drawtext=fontfile='" + fpath(FONT_REG) + "':text='" + clean(meta) + "':x=w-tw-" + pad + ":y=" + Math.round(canvas.h * 0.06) + ":fontsize=" + smallSize + ":fontcolor=" + col.muted);
  for (let i = 0; i < titleLines.length; i++) {
    f.push("drawtext=fontfile='" + fpath(FONT_BOLD) + "':text='" + clean(titleLines[i]) + "':x=" + pad + ":y=" + Math.round(y + i * titleSize * 1.38) + ":fontsize=" + titleSize + ":fontcolor=" + col.ink);
  }
  y += titleLines.length * titleSize * 1.38 + Math.round(subSize * 0.7);
  for (let i = 0; i < subLines.length; i++) {
    f.push("drawtext=fontfile='" + fpath(FONT_REG) + "':text='" + clean(subLines[i]) + "':x=" + pad + ":y=" + Math.round(y + i * subSize * 1.7) + ":fontsize=" + subSize + ":fontcolor=" + col.muted);
  }
  const footY = canvas.h - Math.round(canvas.h * 0.115);
  f.push("drawtext=fontfile='" + fpath(FONT_REG) + "':text='" + clean(shot.shot.card_id || "") + "':x=" + pad + ":y=" + footY + ":fontsize=" + smallSize + ":fontcolor=" + col.muted);
  f.push("drawtext=fontfile='" + fpath(FONT_BOLD) + "':text='" + shot.dur_s.toFixed(2) + "s  ·  " + shot.durF + "f':x=w-tw-" + pad + ":y=" + footY + ":fontsize=" + smallSize + ":fontcolor=" + col.accent);
  f.push("drawtext=fontfile='" + fpath(FONT_REG) + "':text='ANIMATIC · 预览 · 非最终':x=" + pad + ":y=" + (canvas.h - Math.round(canvas.h * 0.062)) + ":fontsize=" + Math.round(smallSize * 0.82) + ":fontcolor=" + col.muted);
  const barY = canvas.h - Math.round(canvas.h * 0.035);
  f.push("drawbox=x=" + pad + ":y=" + barY + ":w=" + (canvas.w - pad * 2) + ":h=3:color=" + col.muted + "@0.25:t=fill");
  const prog = Math.max(0.02, (shot.index + 1) / Math.max(1, total));
  f.push("drawbox=x=" + pad + ":y=" + barY + ":w=" + Math.round((canvas.w - pad * 2) * prog) + ":h=3:color=" + col.accent + ":t=fill");
  return f.join(",");
}

const SFX_DUR = { "click-camera.mp3": 0.351, "transition-soft.mp3": 1.275, "transition-snap.mp3": 0.574, "swoosh-quick.mp3": 0.781, "whoosh-fast.mp3": 1.757, "impact-cine.mp3": 4.063 };
const SFX_PEAK = { "click-camera.mp3": 0.1945, "transition-soft.mp3": 0.4346, "transition-snap.mp3": 0.1174, "swoosh-quick.mp3": 0.2959, "whoosh-fast.mp3": 0.7128, "impact-cine.mp3": 0.5511 };

/**
 * 生成 animatic。
 * @param {object} o
 * @param {object} o.project   project.json 内容
 * @param {string} o.outDir    产物目录（工程内的 animatic/）
 * @param {string} o.ffmpeg
 * @param {string} [o.audioDir] 音频资源根（插件 assets/audio）
 * @param {(done:number,total:number)=>void} [o.onProgress]
 * @returns {Promise<object>}
 */
export async function buildAnimatic(o) {
  const project = o.project;
  const outDir = o.outDir;
  const ffmpeg = o.ffmpeg;
  const audioDir = o.audioDir;
  const onProgress = o.onProgress;
  const t0 = Date.now();
  const warnings = [];
  const canvas = canvasOf(((project && project.project) || {}).aspect || "9:16");
  const col = animaticColors(project);
  const tl = timelineOf(project);
  if (!tl.shots.length) throw new Error("分镜为空，不能生成 animatic");
  if (tl.total_s <= 0) throw new Error("分镜总时长为 0，不能生成 animatic");
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = path.join(outDir, ".build");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  const clips = [];
  for (const shot of tl.shots) {
    const png = path.join(tmp, "frame-" + String(shot.index + 1).padStart(2, "0") + ".png");
    await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", frameFilter(shot, tl.shots.length, canvas, col), "-frames:v", "1", "-update", "1", png]);
    const clip = path.join(tmp, "clip-" + String(shot.index + 1).padStart(2, "0") + ".mp4");
    const frames = Math.max(1, Math.round(shot.dur_s * ANIMATIC_FPS));
    await run(ffmpeg, [
      "-y", "-hide_banner", "-loglevel", "error",
      "-loop", "1", "-framerate", String(ANIMATIC_FPS), "-i", png,
      "-t", shot.dur_s.toFixed(3),
      "-vf", "scale=" + canvas.w + ":" + canvas.h + ":force_original_aspect_ratio=decrease,pad=" + canvas.w + ":" + canvas.h + ":(ow-iw)/2:(oh-ih)/2:color=" + col.ground + ",format=yuv420p",
      "-r", String(ANIMATIC_FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-g", "48", "-frames:v", String(frames),
      clip,
    ]);
    clips.push(clip);
    if (onProgress) onProgress(shot.index + 1, tl.shots.length);
  }

  const listFile = path.join(tmp, "clips.txt");
  // concat demuxer 解析相对路径时以 list 文件所在目录为基准，必须写绝对路径（反斜杠转正斜杠）。
  const listText = clips.map(function (c) { return "file '" + path.resolve(c).replace(/\\/g, "/") + "'"; }).join("\n") + "\n";
  fs.writeFileSync(listFile, listText, "utf8");

  const audio = (project && project.audio) || {};
  const inputs = ["-f", "concat", "-safe", "0", "-i", listFile];
  const filters = [];
  const labels = [];
  let ai = 1;
  const bgm = audio.bgm || null;
  if (bgm && bgm.ref && audioDir) {
    const f = path.join(audioDir, "bgm", bgm.ref);
    if (fs.existsSync(f)) {
      inputs.push("-i", f);
      filters.push("[" + ai + ":a]atrim=0:" + tl.total_s.toFixed(3) + ",asetpts=PTS-STARTPTS,volume=" + (bgm.volume != null ? bgm.volume : 0.5) + "[a0]");
      labels.push("[a0]");
      ai++;
    } else warnings.push("BGM 找不到，animatic 无背景音：" + bgm.ref);
  }
  for (const x of audio.sfx || []) {
    if (!x || !x.file || !audioDir) continue;
    const srcDur = SFX_DUR[x.file];
    if (!srcDur) { warnings.push("未知音效跳过：" + x.file); continue; }
    const f = path.join(audioDir, "sfx", x.file);
    if (!fs.existsSync(f)) { warnings.push("音效找不到，已跳过：" + x.file); continue; }
    let at;
    if (x.peak_f != null) at = Number(x.peak_f) / tl.fps - (SFX_PEAK[x.file] || 0);
    else at = Number(x.at);
    if (!Number.isFinite(at) || at < 0) { warnings.push("音效起点非法，已跳过：" + x.file); continue; }
    inputs.push("-i", f);
    const ms = Math.round(at * 1000);
    filters.push("[" + ai + ":a]atrim=0:" + srcDur + ",asetpts=PTS-STARTPTS,adelay=" + ms + "|" + ms + ",volume=" + (x.volume != null ? x.volume : 0.9) + "[a" + ai + "]");
    labels.push("[a" + ai + "]");
    ai++;
  }
  let audioMap = null;
  if (labels.length) {
    filters.push(labels.join("") + "amix=inputs=" + labels.length + ":duration=first:normalize=0[aout]");
    audioMap = "[aout]";
  }

  const outFile = path.join(outDir, "animatic.mp4");
  const args = ["-y", "-hide_banner", "-loglevel", "error"].concat(inputs);
  if (filters.length) args.push("-filter_complex", filters.join(";"));
  args.push("-map", "0:v");
  if (audioMap) args.push("-map", audioMap, "-c:a", "aac", "-b:a", "128k", "-shortest");
  else args.push("-an");
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p", "-r", String(ANIMATIC_FPS), "-movflags", "+faststart", outFile);
  await run(ffmpeg, args, { maxBuffer: 64 * 1024 * 1024 });

  const ms = Date.now() - t0;
  const meta = {
    schema: "cineforge/animatic/v1",
    generated_at: new Date().toISOString(),
    file: "animatic.mp4",
    width: canvas.w, height: canvas.h, fps: ANIMATIC_FPS,
    duration_s: tl.total_s, shots: tl.shots.length,
    audio_tracks: labels.length,
    build_ms: ms,
    warnings: warnings,
  };
  fs.writeFileSync(path.join(outDir, "animatic.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { }
  return meta;
}
