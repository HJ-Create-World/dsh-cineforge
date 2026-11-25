/**
 * CineForge / 参考片 → 模板提取
 *
 * 输入：reference-analysis（切分 + 关键帧 + 逐镜统计）+ style-fingerprint（调色板/明暗/运动/律动）
 * 输出：cineforge/template/v1 —— 只保存「怎么拍」，不保存「拍什么」。
 *
 * ⚠ 这个模块的红线（写给以后改代码的人）：
 *   1. 绝不从视频里"反解"出具体文案、产品名、品牌。看到画面里写着"大肥鱼"也不能写进模板。
 *      模板的 slots[] 是空的，等用户自己填。
 *   2. 镜头卡（card_id）**不能**从画面反推。我们可以说"这一镜像 ui-entrance 类的长驻演示"，
 *      但说不出它是 124 张卡里的哪一张。所以 motion.cards 恒为 []，
 *      只在 motion.guess 里给"类目倾向 + 置信度"，且 needs_review 恒为 true。
 *   3. 时长、切点密度、调色板、BPM 是可量化的，照实给；估计值必须带 _is_estimate 标记。
 *   4. 76 镜的 5 分钟片不是 20 秒宣传片的模板。所以除了原样统计，
 *      还给一份"按该片切点密度缩放到目标时长"的提案（scaled_proposals），
 *      并明确标注这是估算而不是它原本的结构。
 */
import { createHash } from "node:crypto";

const FPS_FALLBACK = 30;

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function saturation(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}
function quantile(arr, p) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
}
const r2 = (v) => Number(v.toFixed(2));

/**
 * 调色板 → 语义角色。
 *
 * ⚠ 这里踩过一次：最初「最暗的当 ground」，结果在浅色片（纸面 42.7%）上把
 *   深色正文块当成背景、把纸面当成文字色 —— 角色全反了。
 *   正确规则：**占比最高的颜色是画布（ground）**，与它对比度最高的才是 ink。
 *   强调色必须真的够饱和才算数；单色片就老实返回 accent=null，不硬编一个。
 */
function assignRoles(palette) {
  if (!palette.length) return [];
  const withSat = palette.map((c) => ({ ...c, sat: saturation(c.hex) }));
  const byShare = withSat.slice().sort((a, b) => b.share - a.share);
  const ground = byShare[0];
  const contrast = (a, b) => {
    const L = (c) => { const [r, g, bl] = hexToRgb(c.hex).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
    const l1 = L(a), l2 = L(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const ink = byShare.slice(1).sort((a, b) => contrast(b, ground) - contrast(a, ground))[0] || null;
  const accent = withSat
    .filter((c) => c !== ground && c !== ink && c.share >= 0.02 && c.sat >= 0.30 && c.lum > 30 && c.lum < 240)
    .sort((a, b) => b.sat - a.sat || b.share - a.share)[0] || null;
  const out = [];
  const push = (c, role) => { if (c && !out.some((o) => o.hex === c.hex)) out.push({ hex: c.hex, share: c.share, lum: c.lum, sat: r2(c.sat), role }); };
  push(ground, "ground");
  push(ink, "ink");
  push(accent, "accent");
  for (const c of byShare) { if (out.length >= 6) break; push(c, "support"); }
  return out;
}

/** 连续同 kind 的镜头并成"段落"。 */
function chaptersOf(stats) {
  const out = [];
  for (const s of stats) {
    const last = out[out.length - 1];
    const kind = s.kind === "dark" ? "dark" : "paper";
    if (!last || last.kind !== kind) out.push({ kind, from: s.from, to: s.to, shots: 1 });
    else { last.to = s.to; last.shots++; }
  }
  return out.map((c) => ({ ...c, from: r2(c.from), to: r2(c.to), duration_s: r2(c.to - c.from) }));
}

/** 按时间分成 n 段，算每段平均运动能量 → 极简能量曲线。 */
function energyArcOf(stats, duration, n = 10) {
  const buckets = Array.from({ length: n }, () => ({ sum: 0, w: 0 }));
  for (const s of stats) {
    const weight = s.duration_s;
    const center = (s.from + s.to) / 2;
    const i = Math.min(n - 1, Math.floor((center / Math.max(0.001, duration)) * n));
    buckets[i].sum += s.motion * weight;
    buckets[i].w += weight;
  }
  const vals = buckets.map((b) => (b.w ? b.sum / b.w : 0));
  const max = Math.max(...vals, 0.001);
  return vals.map((v, i) => ({
    at_s: r2((i / n) * duration),
    motion: r2(v),
    level: v / max < 0.33 ? "low" : v / max < 0.66 ? "mid" : "high",
  }));
}

/** 按切点密度估算目标时长下应该切几镜、每镜多长。 */
function scaledProposal(durations, targetS, fps) {
  const med = quantile(durations, 0.5) || 2;
  const count = Math.max(3, Math.round(targetS / med));
  // 用分位数取样，保证长中短都有，且完全确定性（不随机）
  const picks = [];
  for (let i = 0; i < count; i++) {
    const p = count === 1 ? 0.5 : i / (count - 1);
    picks.push(quantile(durations, 0.2 + p * 0.6));
  }
  const sum = picks.reduce((a, b) => a + b, 0);
  const k = targetS / sum;
  const scaled = picks.map((d) => r2(d * k));
  return {
    target_s: targetS,
    shot_count: count,
    durations_s: scaled,
    durations_f: scaled.map((d) => Math.round(d * fps)),
    note: "按参考片的切点密度(" + r2(med) + "s/镜)等比缩放到 " + targetS + "s；不是原片结构，是「同密度改写」。",
  };
}

export function extractTemplate(analysis, fingerprint, opts = {}) {
  const meta = analysis.meta;
  const fps = meta.fps || FPS_FALLBACK;
  const stats = analysis.stats || [];
  const shots = analysis.segmentation.shots;
  const durations = shots.map((s) => s.duration_s);
  const id = opts.id || "tpl-extracted";
  const name = opts.name || id;
  const chapters = chaptersOf(stats);
  const proposalTargets = opts.targets || [15, 20, 30, 45];
  const hash = opts.sourceHash || null;

  const darkMs = stats.filter((s) => s.kind === "dark");
  const cardsGuess = [];
  if (chapters.some((c) => c.kind === "dark" && c.duration_s >= 8)) {
    cardsGuess.push({ like: "typography", why: "存在 ≥8s 黑场长镜，通常是字卡/概念陈述", confidence: "medium" });
  }
  if (chapters.some((c) => c.kind === "paper" && c.shots >= 8)) {
    cardsGuess.push({ like: "ui-entrance / interaction", why: "存在 ≥8 镜的纸面连续演示段，通常是界面逐层浮现", confidence: "medium" });
  }
  if (durations.filter((d) => d < 1).length / durations.length >= 0.2) {
    cardsGuess.push({ like: "rhythm", why: "≥20% 的镜头短于 1s，节奏靠快切堆叠", confidence: "medium" });
  }
  if ((fingerprint.motion || {}).p99 > 10) {
    cardsGuess.push({ like: "transition / effects", why: "p99 帧差 " + fingerprint.motion.p99 + "，说明有多次高强度画面跳变", confidence: "low" });
  }

  const tpl = {
    schema: "cineforge/template/v1",
    id,
    name,
    version: 1,
    origin: "reference-extracted",
    from_reference: {
      // 脱敏：模板会被提交进仓库，绝不写入本机绝对路径（含用户名）。
      source: opts.sourceLabel || String(analysis.source).split(/[\\/]/).pop(),
      sha256: hash,
      size_bytes: meta.size_bytes,
      duration_s: meta.duration_s,
      width: meta.width,
      height: meta.height,
      fps: meta.fps,
      has_audio: meta.has_audio,
    },
    layers: ["style", "structure", "motion", "sound"],
    style: {
      palette: assignRoles(fingerprint.palette || []),
      tone: fingerprint.tone,
      aspect: meta.width + ":" + meta.height,
      motion_tokens_id: (fingerprint.motion || {}).p90 >= 4 ? "kinetic-sharp" : (fingerprint.motion || {}).p90 >= 1.5 ? "energetic-bold" : "calm-editorial",
      motion_tokens_basis: "按 p90 帧差 " + ((fingerprint.motion || {}).p90 ?? "?") + " 归到既有 token 档，仅供起点",
      safe_area: { note: "参考片未标注平台；发布前按目标平台重新检查安全区" },
    },
    structure: {
      shot_count: shots.length,
      durations_s: durations.map(r2),
      durations_f: durations.map((d) => Math.round(d * fps)),
      duration_stats: {
        min: r2(Math.min(...durations)),
        p25: r2(quantile(durations, 0.25)),
        median: r2(quantile(durations, 0.5)),
        p75: r2(quantile(durations, 0.75)),
        max: r2(Math.max(...durations)),
        mean: r2(durations.reduce((a, b) => a + b, 0) / durations.length),
        cuts_per_min: r2((shots.length / Math.max(1, meta.duration_s)) * 60),
      },
      chapters,
      energy_arc: energyArcOf(stats, meta.duration_s),
      aspect: meta.width + ":" + meta.height,
      platform: "unspecified",
      scaled_proposals: proposalTargets.map((t) => scaledProposal(durations, t, fps)),
    },
    motion: {
      cards: [],
      guess: cardsGuess,
      needs_review: true,
      note: "镜头卡无法从画面反推：只能给类目倾向，具体 card_id 必须由人在工作台 C 区选定。",
    },
    sound: meta.has_audio && fingerprint.audio ? {
      bpm: fingerprint.audio.bpm_est,
      bpm_is_estimate: true,
      bpm_top: fingerprint.audio.bpm_top.slice(0, 5),
      onsets: fingerprint.audio.onsets,
      median_ioi_s: fingerprint.audio.median_ioi_s,
      cut_hits_s: shots.filter((s) => s.index > 1).map((s) => r2(s.from)),
      cut_beat_alignment: alignment(shots, fingerprint.audio),
    } : null,
    slots: [],
    caveats: [
      "模板只保存怎么拍：调色板、切点密度、段落结构、节奏。不含任何具体文案与品牌信息。",
      ...(shots.length / Math.max(1, meta.duration_s) * 60 > 12
        ? ["切点密度 " + r2((shots.length / Math.max(1, meta.duration_s)) * 60) + " 切/分偏高：帧差法无法区分「真剪辑点」与「同镜内大幅变化」（文字整屏替换、界面切换都会被记为一次切）。请把 chapters 当宏观结构、duration_stats 当节奏参考，不要把这 " + shots.length + " 个切点当成 " + shots.length + " 个镜头照抄。"]
        : []),
      "镜头卡（card_id）无法从画面反解，motion.cards 恒为空；motion.guess 只是类目倾向且 needs_review=true。",
      "scaled_proposals 是「按同一切点密度改写」，不是原片结构；原片 " + shots.length + " 镜 / " + r2(meta.duration_s) + "s。",
      "BPM 为自相关估计值（bpm_top 给出候选），有音轨才给，无音轨为 null。",
    ],
  };
  return tpl;
}

/** 切点是否卡在拍点上：把每个切点映射到最近的拍，统计 |误差| 的中位数。 */
function alignment(shots, audio) {
  const bpm = audio.bpm_est;
  if (!bpm) return null;
  const beat = 60 / bpm;
  const errs = [];
  for (const s of shots) {
    if (s.index === 1) continue;
    const t = s.from;
    const phase = t % beat;
    errs.push(Math.min(phase, beat - phase));
  }
  const med = quantile(errs, 0.5);
  return {
    beat_s: r2(beat),
    median_err_s: r2(med),
    within_50ms: r2(errs.filter((e) => e <= 0.05).length / Math.max(1, errs.length)),
    verdict: med <= 0.08 ? "切点基本卡拍" : med <= 0.2 ? "部分卡拍" : "切点与拍点无明显对齐",
  };
}

export function fileSha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/** 人读版 Markdown（给用户看，也进 docs）。 */
export function renderTemplateMarkdown(tpl, analysis) {
  const L = [];
  const st = tpl.structure;
  L.push("# 模板：" + tpl.name + "（从参考片提取）");
  L.push("");
  L.push("> 只保存**怎么拍**（调色板 / 切点密度 / 段落结构 / 节奏），不保存**拍什么**。镜头卡需人工选定。");
  L.push("");
  L.push("## 源片");
  L.push("");
  L.push("| 项 | 值 |");
  L.push("| --- | --- |");
  L.push("| 文件 | " + tpl.from_reference.source + " |");
  L.push("| 规格 | " + tpl.from_reference.width + "×" + tpl.from_reference.height + " · " + tpl.from_reference.fps + "fps · " + r2(tpl.from_reference.duration_s) + "s |");
  L.push("| 切分 | " + st.shot_count + " 镜 · 中位 " + st.duration_stats.median + "s · " + st.duration_stats.cuts_per_min + " 切/分 |");
  L.push("| sha256 | " + (tpl.from_reference.sha256 || "（未记录）") + " |");
  L.push("");
  L.push("## 调色板（6 色 k-means）");
  L.push("");
  L.push("| 色 | 占比 | 亮度 | 饱和度 | 角色 |");
  L.push("| --- | --- | --- | --- | --- |");
  for (const c of tpl.style.palette) L.push("| `" + c.hex + "` | " + (c.share * 100).toFixed(1) + "% | " + c.lum + " | " + c.sat + " | " + c.role + " |");
  L.push("");
  L.push("明暗分布：暗 " + tpl.style.tone.dark_pct + "% · 中 " + tpl.style.tone.mid_pct + "% · 亮 " + tpl.style.tone.light_pct + "%");
  L.push("");
  L.push("## 段落结构");
  L.push("");
  L.push("| # | 性质 | 起止 | 时长 | 镜数 |");
  L.push("| --- | --- | --- | --- | --- |");
  tpl.structure.chapters.forEach((c, i) => L.push("| " + (i + 1) + " | " + (c.kind === "dark" ? "黑场 / 字卡" : "纸面 / 界面") + " | " + c.from + "–" + c.to + "s | " + c.duration_s + "s | " + c.shots + " |"));
  L.push("");
  L.push("## 节奏");
  L.push("");
  L.push("| 项 | 值 |");
  L.push("| --- | --- |");
  L.push("| 最短 / 中位 / 最长 | " + st.duration_stats.min + "s / " + st.duration_stats.median + "s / " + st.duration_stats.max + "s |");
  L.push("| 切点密度 | " + st.duration_stats.cuts_per_min + " 切/分 |");
  if (tpl.sound) {
    L.push("| BPM（估计） | " + tpl.sound.bpm + " |");
    if (tpl.sound.cut_beat_alignment) L.push("| 切点卡拍 | " + tpl.sound.cut_beat_alignment.verdict + "（中位误差 " + tpl.sound.cut_beat_alignment.median_err_s + "s） |");
  }
  L.push("");
  L.push("## 缩放到目标时长（按同一切点密度改写）");
  L.push("");
  L.push("| 目标 | 镜数 | 每镜时长 |");
  L.push("| --- | --- | --- |");
  for (const p of st.scaled_proposals) L.push("| " + p.target_s + "s | " + p.shot_count + " | " + p.durations_s.map((d) => d + "s").join(" · ") + " |");
  L.push("");
  L.push("## 镜头卡倾向（需人工确认）");
  L.push("");
  for (const g of tpl.motion.guess) L.push("- **" + g.like + "**（" + g.confidence + "）：" + g.why);
  L.push("");
  L.push("## 不能做的");
  L.push("");
  for (const c of tpl.caveats) L.push("- " + c);
  L.push("");
  return L.join("\n");
}
