/**
 * CineForge / 风格指纹（调色板 + 明暗分布 + 运动能量 + 律动）
 *
 * 输入一段参考视频，输出可被 design_spec 直接消费的结构化指纹：
 *   palette  6 色（k-means）+ 占比 + 亮度
 *   tone     暗 / 中 / 亮三档百分比
 *   motion   p50/p90/p99 帧差 + 静态占比（<1.2 视为静态）
 *   audio    onsets / median_ioi / bpm_est / bpm_score / bpm_top / rms
 *
 * ⚠ BPM 的算法坑（本机踩过，别再退回）：
 *   最初用「谱通量峰值 → 峰值间隔中位数 → 折进 70–180 并偏向 110」，
 *   在 129 BPM 的测试片上得 95.2。错因是阈值支配了峰值数量、且折返逻辑
 *   人为吸附到 110。改用**谐波求和自相关**：
 *     对每个候选 BPM 算 L=60/bpm（以 10ms 帧为单位），
 *     score = acAt(L) + 0.8*acAt(2L) + 0.6*acAt(3L) + 0.4*acAt(4L)，取最高。
 *   同一片子上得 130.0（真值 129），前三个候选 130 / 129.5 / 130.5 同分。
 *   所以 bpm 是**估计值**，UI 必须标注「估计」，并把 bpm_top 一起给出供人工核对。
 *
 * ⚠ 调色板是 k-means，初始化用「按样本顺序等距取 k 个」，没有随机数 ——
 *   同输入必然同输出，符合本插件"确定性优先"的总纪律。
 */
import { run } from "./ffmpeg.mjs";

export const FINGERPRINT_DEFAULTS = Object.freeze({
  paletteSamples: 2,      // 每秒采 2 帧做调色板
  paletteSize: 64,        // 采样边长
  paletteK: 6,
  paletteIters: 12,
  motionFps: 8,
  motionWidth: 48,
  staticThreshold: 1.2,
  audioSampleRate: 22050,
  bpmMin: 60,
  bpmMax: 180,
  bpmStep: 0.5,
  bpmTopN: 8,
});

function kmeans(points, k, iters) {
  if (!points.length) return [];
  const centers = [];
  for (let i = 0; i < k; i++) centers.push(points[Math.floor(((i + 0.5) * points.length) / k)].slice());
  const assign = new Array(points.length).fill(0);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < points.length; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = points[i][0] - centers[c][0];
        const dg = points[i][1] - centers[c][1];
        const db = points[i][2] - centers[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) { bestD = d; best = c; }
      }
      assign[i] = best;
    }
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const a = assign[i];
      sum[a][0] += points[i][0]; sum[a][1] += points[i][1]; sum[a][2] += points[i][2]; sum[a][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sum[c][3]) centers[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
  }
  const counts = new Array(k).fill(0);
  for (const a of assign) counts[a]++;
  return centers
    .map((c, i) => ({
      hex: "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""),
      share: Number((counts[i] / points.length).toFixed(3)),
      lum: Number((0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]).toFixed(1)),
    }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}

/** 以 fps 采样、scale 到 w×h 的 rgb24 原始帧。 */
async function rgbFrames(ffmpeg, file, fps, w, h) {
  const buf = await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-i", file,
    "-vf", "fps=" + fps + ",scale=" + w + ":" + h,
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ], { binary: true });
  const F = w * h * 3;
  return { buf, F, n: Math.floor(buf.length / F), w, h };
}

export async function palette(ffmpeg, file, o = FINGERPRINT_DEFAULTS) {
  const fr = await rgbFrames(ffmpeg, file, o.paletteSamples, o.paletteSize, o.paletteSize);
  const points = [];
  for (let i = 0; i < fr.n; i++) {
    const base = i * fr.F;
    for (let j = 0; j < o.paletteSize * o.paletteSize; j++) {
      const off = base + j * 3;
      points.push([fr.buf[off], fr.buf[off + 1], fr.buf[off + 2]]);
    }
  }
  let dark = 0, mid = 0, light = 0;
  for (const p of points) {
    const l = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    if (l < 60) dark++; else if (l < 170) mid++; else light++;
  }
  const total = points.length || 1;
  return {
    palette: kmeans(points, o.paletteK, o.paletteIters),
    tone: {
      dark_pct: Number(((dark / total) * 100).toFixed(1)),
      mid_pct: Number(((mid / total) * 100).toFixed(1)),
      light_pct: Number(((light / total) * 100).toFixed(1)),
    },
  };
}

export async function motion(ffmpeg, file, meta, o = FINGERPRINT_DEFAULTS) {
  const w = o.motionWidth;
  const h = Math.max(2, Math.round((w * meta.height) / meta.width));
  const buf = await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-i", file,
    "-vf", "fps=" + o.motionFps + ",scale=" + w + ":" + h + ",format=gray",
    "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { binary: true });
  const F = w * h;
  const n = Math.floor(buf.length / F);
  const diffs = [];
  for (let i = 1; i < n; i++) {
    let s = 0;
    for (let j = 0; j < F; j++) s += Math.abs(buf[i * F + j] - buf[(i - 1) * F + j]);
    diffs.push(s / F);
  }
  const sorted = diffs.slice().sort((a, b) => a - b);
  const q = (p) => (sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(2)) : 0);
  return {
    p50: q(0.5),
    p90: q(0.9),
    p99: q(0.99),
    static_ratio: Number((diffs.filter((d) => d < o.staticThreshold).length / Math.max(1, diffs.length)).toFixed(3)),
    sample_fps: o.motionFps,
    frames: n,
  };
}

export async function rhythm(ffmpeg, file, o = FINGERPRINT_DEFAULTS, window) {
  const SR = o.audioSampleRate;
  const seek = window ? ["-ss", String(window.from), "-t", String(window.to - window.from)] : [];
  const buf = await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", ...seek, "-i", file,
    "-ac", "1", "-ar", String(SR), "-f", "s16le", "-acodec", "pcm_s16le", "-",
  ], { binary: true });
  const n = Math.floor(buf.length / 2);
  if (!n) return null;

  const hop = Math.round(SR * 0.01); // 10ms 包络
  const env = [];
  for (let i = 0; i + hop < n; i += hop) {
    let s = 0;
    for (let j = 0; j < hop; j += 2) {
      const v = buf.readInt16LE((i + j) * 2) / 32768;
      s += v * v;
    }
    env.push(Math.sqrt(s / (hop / 2)));
  }
  const flux = env.map((v, i) => (i === 0 ? 0 : Math.max(0, v - env[i - 1])));

  // 起音点（用于 UI 显示"重音 N 处"与切点密度对照）
  const mean = flux.reduce((a, b) => a + b, 0) / Math.max(1, flux.length);
  const onsets = [];
  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] > mean * 1.6 && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
      const t = i * 0.01;
      if (onsets.length && t - onsets[onsets.length - 1] < 0.12) continue;
      onsets.push(Number(t.toFixed(3)));
    }
  }
  const ioi = [];
  for (let i = 1; i < onsets.length; i++) ioi.push(onsets[i] - onsets[i - 1]);
  const sortedIoi = ioi.slice().sort((a, b) => a - b);
  const medianIoi = sortedIoi.length ? sortedIoi[Math.floor(sortedIoi.length / 2)] : 0;
  const rms = env.reduce((a, b) => a + b, 0) / Math.max(1, env.length);

  // 谐波求和自相关（见文件头 ⚠）
  const win = 12;
  const detr = flux.map((_, i) => {
    let sum = 0, count = 0;
    for (let k = -win; k <= win; k++) {
      const j = i + k;
      if (j >= 0 && j < flux.length) { sum += flux[j]; count++; }
    }
    return Math.max(0, flux[i] - sum / count);
  });
  const acf = (lag) => {
    let sum = 0, count = 0;
    for (let i = 0; i + lag < detr.length; i++) { sum += detr[i] * detr[i + lag]; count++; }
    return count ? sum / count : 0;
  };
  const acAt = (lagF) => {
    const l0 = Math.floor(lagF);
    const f = lagF - l0;
    return acf(l0) * (1 - f) + acf(l0 + 1) * f;
  };
  const scored = [];
  for (let b = o.bpmMin; b <= o.bpmMax; b += o.bpmStep) {
    const L = (60 / b) * 100; // 包络是 10ms 帧
    if (L * 4 > detr.length / 5) continue;
    scored.push({ bpm: b, score: acAt(L) + 0.8 * acAt(L * 2) + 0.6 * acAt(L * 3) + 0.4 * acAt(L * 4) });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, o.bpmTopN).map((c) => ({ bpm: c.bpm, score: Number(c.score.toFixed(6)) }));

  return {
    onsets: onsets.length,
    median_ioi_s: Number(medianIoi.toFixed(3)),
    bpm_est: top.length ? top[0].bpm : null,
    bpm_score: top.length ? top[0].score : null,
    bpm_top: top,
    bpm_is_estimate: true,
    rms: Number(rms.toFixed(4)),
  };
}


/**
 * 长片 BPM 稳定性。
 *
 * 为什么必须有：5 分钟片的配乐常常换段（前段悬疑 90 BPM、后段推进 140 BPM），
 * 对整片估一个 BPM 在数学上"有个答案"，在工程上是错的。
 * 这里把片子切三份分别估，把离散度一起报出来；不稳定就明确说"别信整片 BPM"。
 */
export async function bpmStability(ffmpeg, file, meta, o = FINGERPRINT_DEFAULTS, parts = 3) {
  if (!meta.has_audio || meta.duration_s < 45) return null;
  const seg = meta.duration_s / parts;
  const rows = [];
  for (let i = 0; i < parts; i++) {
    const a = await rhythm(ffmpeg, file, o, { from: i * seg, to: (i + 1) * seg });
    if (a && a.bpm_est) rows.push({ from: Number((i * seg).toFixed(1)), to: Number(((i + 1) * seg).toFixed(1)), bpm: a.bpm_est, onsets: a.onsets });
  }
  if (rows.length < 2) return null;
  const bpms = rows.map((r) => r.bpm);
  const mean = bpms.reduce((x, y) => x + y, 0) / bpms.length;
  const spread = Math.max(...bpms) - Math.min(...bpms);
  return {
    parts: rows,
    mean_bpm: Number(mean.toFixed(1)),
    spread_bpm: Number(spread.toFixed(1)),
    stable: spread <= 5,
    verdict: spread <= 5 ? "全片节奏稳定，整片 BPM 可信" : "分段 BPM 差异 " + spread.toFixed(1) + "，整片 BPM 只是平均值，逐段用法更可靠",
  };
}

/**
 * 完整指纹。无音轨时 audio 为 null（不编造 BPM）。
 */
export async function styleFingerprint(bin, file, meta, o = FINGERPRINT_DEFAULTS) {
  const p = await palette(bin.ffmpeg, file, o);
  const m = await motion(bin.ffmpeg, file, meta, o);
  const a = meta.has_audio ? await rhythm(bin.ffmpeg, file, o) : null;
  // 长片额外给分段稳定性；短片（<45s）没必要，直接 null。
  const stab = meta.has_audio ? await bpmStability(bin.ffmpeg, file, meta, o) : null;
  if (a) a.stability = stab;
  return {
    schema: "cineforge/style-fingerprint/v3",
    source: file,
    meta: {
      width: meta.width,
      height: meta.height,
      aspect: Number((meta.width / meta.height).toFixed(3)),
      fps: meta.fps,
      duration_s: meta.duration_s,
      has_audio: meta.has_audio,
    },
    palette: p.palette,
    tone: p.tone,
    motion: m,
    audio: a,
    caveats: [
      "调色板是 6 色 k-means 归纳，不是「设计用的色板」；可直接当 design_spec.palette 起点。",
      "BPM 是自相关估计值（本机 129 BPM 测试片得 130.0），bpm_top 给出候选供人工确认。",
      "超过 45s 的片子会做三段独立估价（audio.stability）；spread 大就不要用整片 BPM。",
      "运动能量是帧差，反映整体画面变化强度，不区分是运镜、文字动画还是噪声。",
    ],
  };
}
