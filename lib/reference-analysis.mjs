/**
 * CineForge / 参考视频分析（切分 + 关键帧 + 拼图）
 *
 * 用途：用户给一段参考视频，要"复刻它的风格 / 分镜结构 / 某个片段"。
 * 我们不做语义理解（看不清"这是什么产品"），只做可量化的结构提取：
 *
 *   ① probe    —— 尺寸 / 帧率 / 时长 / 有无音轨
 *   ② segment  —— 找切点，切成镜头。**必须用帧差法**（见下）
 *   ③ keyframes—— 每镜 15% / 50% / 85% 三帧，用来人眼核对切分是否正确
 *   ④ contactSheet —— 每镜中点帧拼一张横图，给用户"一眼看全片结构"
 *
 * ⚠ 已知失败方案（不要再试，本机实测 0 命中）：
 *   ffmpeg 的 scdet 滤镜、select='gt(scene,0.25)' + showinfo，
 *   在本机测试片（大面积静态 + 缓动过渡的宣传片）上阈值降到 0.08 仍是
 *   0 个切点。官方场景检测假设的是硬切为主的实拍素材。故自研帧差：
 *   4fps 灰度 48 宽小图逐帧平均绝对差，阈值 max(mean*2.0, 5)，
 *   0.5s 内合并取较大者，剔除片头 t<0.25，镜头短于 0.35s 丢弃。
 *   实测 demo（20s / 6 镜）命中 5/6，漏掉的是 14s 处最弱的一次转场。
 *   这是**已知精度上限**，所以必须让人看 keyframes 与拼图复核。
 */
import fs from "node:fs";
import path from "node:path";
import { run, probeMedia } from "./ffmpeg.mjs";

/** 切分参数。改这里就要同步改上面的注释与 docs 里的实测结论。 */
export const SEGMENT_DEFAULTS = Object.freeze({
  sampleFps: 4,
  thumbWidth: 48,
  thresholdFactor: 2.0,
  thresholdMin: 5,
  mergeGapS: 0.5,
  headGuardS: 0.25,
  minShotS: 0.35,
});

/** 读一小段灰度 rawvideo，返回每帧的像素数组（Uint8Array[]）。 */
async function grayFrames(ffmpeg, file, { sampleFps, thumbWidth }, meta) {
  const w = thumbWidth;
  // 保持源片宽高比；w 固定，h 按比例算，最小 2 行（极宽片也不至于崩）。
  const h = Math.max(2, Math.round((w * meta.height) / meta.width));
  const buf = await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-i", file,
    "-vf", "fps=" + sampleFps + ",scale=" + w + ":" + h + ",format=gray",
    "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { binary: true });
  const F = w * h;
  const n = Math.floor(buf.length / F);
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(buf.subarray(i * F, (i + 1) * F));
  return { frames, w, h };
}

/** 逐帧平均绝对差。 */
function frameDiffs(frames) {
  const out = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i], b = frames[i - 1];
    let s = 0;
    for (let j = 0; j < a.length; j++) s += Math.abs(a[j] - b[j]);
    out.push(s / a.length);
  }
  return out;
}

/**
 * 切分。
 * @param {string} ffmpeg
 * @param {string} file
 * @param {{width:number,height:number,fps:number,duration_s:number}} meta
 * @param {Partial<typeof SEGMENT_DEFAULTS>} [opts]
 */
export async function segment(ffmpeg, file, meta, opts = {}) {
  const o = { ...SEGMENT_DEFAULTS, ...opts };
  const { frames } = await grayFrames(ffmpeg, file, o, meta);
  const diffs = frameDiffs(frames);
  const mean = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
  const threshold = Math.max(mean * o.thresholdFactor, o.thresholdMin);

  const peaks = [];
  for (let i = 0; i < diffs.length; i++) {
    if (diffs[i] <= threshold) continue;
    const t = (i + 1) / o.sampleFps;
    const last = peaks[peaks.length - 1];
    if (last && t - last.t < o.mergeGapS) {
      if (diffs[i] > last.d) { last.t = t; last.d = diffs[i]; }
      continue;
    }
    peaks.push({ t, d: diffs[i] });
  }

  const cuts = peaks
    .filter((p) => p.t > o.headGuardS)
    .map((p) => Number(p.t.toFixed(2)));

  const bounds = [0, ...cuts, meta.duration_s];
  const shots = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    if (to - from < o.minShotS) continue;
    shots.push({
      index: shots.length + 1,
      from: Number(from.toFixed(2)),
      to: Number(to.toFixed(2)),
      duration_s: Number((to - from).toFixed(2)),
      duration_f: Math.round((to - from) * meta.fps),
    });
  }

  return {
    shots,
    mean_diff: Number(mean.toFixed(2)),
    threshold: Number(threshold.toFixed(2)),
    peak_count: peaks.length,
    cut_count: cuts.length,
    sample_fps: o.sampleFps,
    params: o,
  };
}

/** 每镜取 15% / 50% / 85% 三张关键帧。 */
export async function keyframes(ffmpeg, file, shots, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  for (const shot of shots) {
    const picks = [
      ["start", shot.from + shot.duration_s * 0.15],
      ["mid", shot.from + shot.duration_s * 0.5],
      ["end", shot.from + shot.duration_s * 0.85],
    ];
    for (const [label, t] of picks) {
      const name = "shot" + String(shot.index).padStart(2, "0") + "-" + label + ".jpg";
      const target = path.join(outDir, name);
      await run(ffmpeg, [
        "-hide_banner", "-loglevel", "error",
        "-ss", t.toFixed(3), "-i", file,
        "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "3", "-y", target,
      ]);
      if (fs.existsSync(target)) {
        files.push({ shot: shot.index, label, t: Number(t.toFixed(2)), file: target, bytes: fs.statSync(target).size });
      }
    }
  }
  return files;
}

/** 每镜中点帧横向拼接，左上角标 S01/S02… */
export async function contactSheet(ffmpeg, file, shots, outPng) {
  if (!shots.length) throw new Error("没有镜头，无法生成拼图。");
  const inputs = [];
  const filters = [];
  shots.forEach((shot, i) => {
    const t = (shot.from + shot.duration_s / 2).toFixed(3);
    inputs.push("-ss", t, "-i", file);
    const label = "S" + String(i + 1).padStart(2, "0");
    filters.push(
      "[" + i + ":v]scale=300:-2,drawtext=text='" + label + "':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=5[v" + i + "]"
    );
  });
  const concatIn = shots.map((_, i) => "[v" + i + "]").join("");
  filters.push(concatIn + "hstack=inputs=" + shots.length + "[out]");
  await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", ...inputs,
    "-filter_complex", filters.join(";"), "-map", "[out]", "-frames:v", "1", "-y", outPng,
  ]);
  return outPng;
}


/**
 * 逐镜技术统计（模板提取用）。
 *
 * 为什么需要：切分只给出「哪里断」，但做模板必须知道「每镜是什么性质」——
 * 是纸面长驻 UI、是黑场字卡、还是数据可视化。这三个量足够粗分类：
 *   luma        该镜平均亮度（0–255）
 *   dark_ratio  该镜内亮度 < 46 的采样帧占比
 *   motion      该镜内平均帧差（与 motion() 同口径，48 宽灰度）
 *   kind        paper | dark | mixed（阈值宽，只用于人工复核时排序）
 */
export async function shotStats(ffmpeg, file, shots, meta, opts = {}) {
  const fps = opts.fps ?? 6;
  const w = opts.width ?? 48;
  const h = Math.max(2, Math.round((w * meta.height) / meta.width));
  const buf = await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-i", file,
    "-vf", "fps=" + fps + ",scale=" + w + ":" + h + ",format=gray",
    "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { binary: true });
  const F = w * h;
  const n = Math.floor(buf.length / F);
  const frameLuma = new Array(n);
  for (let i = 0; i < n; i++) {
    let s2 = 0;
    for (let j = 0; j < F; j++) s2 += buf[i * F + j];
    frameLuma[i] = s2 / F;
  }
  const out = [];
  for (const shot of shots) {
    const a = Math.max(0, Math.floor(shot.from * fps));
    const b = Math.min(n - 1, Math.ceil(shot.to * fps) - 1);
    let sum = 0, cnt = 0, dark = 0, mo = 0, mc = 0;
    for (let i = a; i <= b; i++) {
      sum += frameLuma[i]; cnt++;
      if (frameLuma[i] < 46) dark++;
      if (i > a) {
        let d = 0;
        for (let j = 0; j < F; j++) d += Math.abs(buf[i * F + j] - buf[(i - 1) * F + j]);
        mo += d / F; mc++;
      }
    }
    const luma = cnt ? Number((sum / cnt).toFixed(1)) : 0;
    const darkRatio = cnt ? Number((dark / cnt).toFixed(3)) : 0;
    out.push({
      index: shot.index,
      from: shot.from,
      to: shot.to,
      duration_s: shot.duration_s,
      luma,
      dark_ratio: darkRatio,
      motion: mc ? Number((mo / mc).toFixed(2)) : 0,
      kind: darkRatio >= 0.6 ? "dark" : luma >= 150 ? "paper" : "mixed",
    });
  }
  return out;
}

/**
 * 完整分析：probe → segment → keyframes → contactSheet。
 * @param {{ffmpeg:string, ffprobe:string, source:string}} bin resolveFfmpeg() 的返回
 */
export async function analyzeReference(bin, file, outDir, opts = {}) {
  if (!fs.existsSync(file)) throw new Error("参考视频不存在：" + file);
  const meta = await probeMedia(bin.ffprobe, file);
  const seg = await segment(bin.ffmpeg, file, meta, opts);
  const kf = await keyframes(bin.ffmpeg, file, seg.shots, path.join(outDir, "keyframes"));
  const sheet = path.join(outDir, "contact-sheet.png");
  await contactSheet(bin.ffmpeg, file, seg.shots, sheet);
  const stats = opts.stats === false ? null : await shotStats(bin.ffmpeg, file, seg.shots, meta, opts);
  return {
    schema: "cineforge/reference-analysis/v1",
    source: file,
    ffmpeg_source: bin.source,
    meta,
    segmentation: seg,
    stats,
    keyframes: kf,
    contact_sheet: sheet,
    caveats: [
      "切分靠帧差，弱转场会漏（实测 20s/6 镜命中 5 个切点）；必须看 keyframes 复核。",
      "只提取可量化结构，不做语义理解：不知道画面里是什么产品、在讲什么。",
      "关键帧是截图，不是动效参数；无法 1:1 反解缓动曲线与位移量。",
    ],
  };
}
