// CineForge · 把当前工程存成模板（零依赖纯函数）
//
// 需求 4 的另一半：extract-template.mjs 从「别人的参考片」提取模板，
// 这里从「自己做完的工程」提取模板 —— 用户跑通一次流程后，把风格/分镜结构/
// 动效配方/声音设计存下来，下一个片子直接复用，只填内容空位。
//
// 铁律：模板只存「怎么拍」，不存「拍什么」。
//   工程里每镜都有 copy{title,sub,foot}、caption、intent —— 这些全是内容，
//   一个字节都不许进模板。validateTemplate 会再拦一道（CONTENT_KEYS）。
//   slots[] 明确列出「下次必须由用户填」的空位，填不满不能进分镜。

export const SAVE_SCHEMA = "cineforge/template/v1";

/** 从工程字段推导模板 id：只保留 a-z0-9-，中文名走时间戳兜底（id 要能当文件名）。 */
export function templateIdOf(nameOrId, fallbackSeed) {
  const raw = String(nameOrId || "").trim().toLowerCase();
  const slug = raw
    .replace(/[\u4e00-\u9fa5]+/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (slug) return slug;
  const seed = Number(fallbackSeed || Date.now());
  return "tpl-" + Math.abs(Math.floor(seed)).toString(36).slice(-6);
}

const r2 = (v) => Number(Number(v || 0).toFixed(2));
const HEX = /^#[0-9a-fA-F]{6}$/;

/** design_spec.palette 是对象，模板里要的是带 role 的数组；顺带给每个色算亮度。 */
function paletteOf(palette) {
  const out = [];
  const src = palette && typeof palette === "object" ? palette : {};
  const order = ["ground", "ink", "accent", "muted", "panel"];
  for (const role of order) {
    const v = String(src[role] || "").trim();
    if (!HEX.test(v)) continue;
    out.push({ hex: v.toLowerCase(), role });
  }
  // panel 之后可能还有别的色（grid 常是 rgba，跳过）
  for (const k of Object.keys(src)) {
    if (order.indexOf(k) >= 0) continue;
    const v = String(src[k] || "").trim();
    if (HEX.test(v)) out.push({ hex: v.toLowerCase(), role: "support" });
  }
  return out;
}

/** 能量弧：把每镜的 energy 按时间点摊开，给下次「按同一条情绪曲线排」用。 */
function energyArcOf(shots, fps) {
  const RANK = { low: 0, mid: 1, "mid-high": 2, high: 3, peak: 4 };
  let t = 0;
  return (shots || []).map((s) => {
    const dur = Number(s.duration_f || 0) / fps;
    const item = { at_s: r2(t), level: s.energy || "mid", rank: RANK[s.energy] ?? 1 };
    t += dur;
    return item;
  });
}

function durationStats(shots, fps, totalS) {
  const d = (shots || []).map((s) => Number(s.duration_f || 0) / fps).filter((x) => x > 0);
  if (!d.length) return null;
  const sorted = d.slice().sort((a, b) => a - b);
  const q = (p) => {
    if (!sorted.length) return 0;
    const i = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * p));
    const lo = Math.floor(i), hi = Math.ceil(i);
    return r2(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
  };
  const sum = d.reduce((a, b) => a + b, 0);
  return {
    min: r2(sorted[0]), p25: q(0.25), median: q(0.5), p75: q(0.75), max: r2(sorted[sorted.length - 1]),
    mean: r2(sum / d.length), cuts_per_min: r2((d.length / Math.max(0.001, totalS || sum)) * 60),
  };
}

/**
 * 从工程生成模板。
 * @param {object} project  cineforge/project/v1（可能带 rev / 生成物字段，一律不进模板）
 * @param {object} opts     {id,name,layers,slots,sfxBaseName,now}
 * @returns {{ok:boolean,template?:object,errors?:string[],warnings?:string[],stripped?:string[]}}
 */
export function templateFromProject(project, opts) {
  const o = opts || {};
  const p = (project && project.project) || {};
  const ds = (project && project.design_spec) || {};
  const shots = Array.isArray(project && project.shots) ? project.shots : [];
  const fps = Number(p.fps) || 30;
  const errors = [];
  const warnings = [];
  if (!shots.length) errors.push("工程还没有分镜，存成模板没有可复用的结构");

  const id = templateIdOf(o.id || o.name || p.id || "", o.now);
  const name = String(o.name || p.title || p.id || id).trim().slice(0, 40) || id;

  const totalF = shots.reduce((a, s) => a + (Number(s.duration_f) || 0), 0);
  const totalS = totalF / fps;

  const palette = paletteOf(ds.palette);
  const cards = shots.map((s) => String(s.card_id || "")).filter(Boolean);

  const tpl = {
    schema: SAVE_SCHEMA,
    id,
    name,
    version: 1,
    origin: "project-saved",
    // 只记 project_id 与结构摘要：绝不写本机绝对路径（模板会被提交/分享）。
    from_project: {
      project_id: String(p.id || ""),
      platform: p.platform || "",
      aspect: p.aspect || "",
      fps,
      shot_count: shots.length,
      duration_s: r2(totalS),
      saved_at: o.now ? new Date(o.now).toISOString() : new Date().toISOString(),
      content_stripped: true,
    },
    layers: Array.isArray(o.layers) && o.layers.length ? o.layers.slice() : ["style", "structure", "motion", "sound"],
    style: {
      palette,
      typography: (ds.typography && typeof ds.typography === "object") ? { display: ds.typography.display || "sans-serif", body: ds.typography.body || "sans-serif" } : { display: "sans-serif", body: "sans-serif" },
      motion_tokens_id: ds.motion_tokens_id || "",
      tone: null,
      aspect: p.aspect || "",
      safe_area: { note: "模板不记平台安全区；套用后按目标平台重新检查" },
    },
    structure: {
      shot_count: shots.length,
      durations_f: shots.map((s) => Number(s.duration_f) || 0),
      durations_s: shots.map((s) => r2((Number(s.duration_f) || 0) / fps)),
      duration_stats: durationStats(shots, fps, totalS),
      energy_arc: energyArcOf(shots, fps),
      energy_curve: ds.energy_curve || "",
      aspect: p.aspect || "",
      platform: p.platform || "unspecified",
    },
    motion: {
      // 卡片序列是「怎么拍」，可以存；每镜的 action/copy 是内容，不存。
      cards,
      guess: [],
      needs_review: false,
      note: "这份模板的卡片序列来自已经做完并验收过的工程，可直接复用；换产品后卡片本身的文案仍要重写。",
    },
    sound: soundOf(project, totalF, o),
    slots: Array.isArray(o.slots) ? o.slots.slice() : ((project && project.template && Array.isArray(project.template.slots)) ? Object.keys(project.template.slots) : []),
    caveats: [
      "这份模板从你自己的工程提取：只含风格、镜长配比、卡片序列、节奏，不含任何文案/产品名/客户信息。",
      "复用后仍需重写每一镜的 copy 与 caption —— 模板给的是节奏骨架，不是台词。",
      "BGM 文件本身不复制，只记 BPM 与 SFX 相对位置；套用后在自己工程里挑音轨。",
    ],
  };

  if (!palette.length) warnings.push("工程 design_spec 没有可用调色板，style 层只剩字体与动效 token");
  if (!cards.length) warnings.push("分镜里没有 card_id，motion 层为空（套用后要人工选卡）");
  if (!tpl.sound) warnings.push("工程没有 BGM，sound 层为空");

  return { ok: errors.length === 0, template: tpl, errors, warnings };
}

/** 只抽节奏，不抽音频文件：BPM + 每个 SFX 落在全片的相对位置。 */
function soundOf(project, totalF, o) {
  const au = (project && project.audio) || {};
  const bgm = au.bgm || {};
  const sfx = Array.isArray(au.sfx) ? au.sfx : [];
  if (!bgm.bpm && !sfx.length) return null;
  return {
    bpm: bgm.bpm ? Math.round(Number(bgm.bpm)) : null,
    bpm_is_estimate: false,
    beat_grid: Array.isArray(bgm.beat_grid) ? bgm.beat_grid.slice(0, 64) : [],
    hit_list: Array.isArray(bgm.hit_list) ? bgm.hit_list.slice(0, 32) : [],
    // 相对位置 0..1 —— 换了时长也能按比例铺（这是「怎么拍」不是「用哪个文件」）
    sfx_pattern: sfx.map((s) => ({
      file: String(s.file || "").replace(/\.[a-z0-9]+$/i, ""),
      at_ratio: r2((Number(s.peak_f) || 0) / Math.max(1, totalF)),
      volume: Number(s.volume) || 0.7,
    })),
    cut_beat_alignment: null,
  };
}

/** 文件名：template-<id>.json，路径分隔符一律拒绝。 */
export function templateFileName(id) {
  const s = String(id || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(s)) return null;
  return "template-" + s + ".json";
}
