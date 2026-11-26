// CineForge · 模板套用（零依赖纯函数）
//
// 模板只存「怎么拍」，不存「拍什么」。这条不变量在三处强制：
//   1) validateTemplate 拒绝任何带具体文案/产品名/客户数据的模板；
//   2) applyTemplate 只写 design_spec / shots 的骨架 / audio 的节奏参数，
//      绝不写 copy、goal、publish；
//   3) slots[] 没填满 → canEnterStoryboard=false，服务端 gate 会挡住。
//
// 五层复用：style（视觉风格）/ structure（分镜结构）/ motion（动效配方）/
//           sound（声音设计）/ script_skeleton（文案骨架，最容易带内容，默认不选）

export const TEMPLATE_SCHEMA = "cineforge/template/v1";

/** 五层的中文名，界面与回执共用。 */
export const LAYER_CN = {
  style: "视觉风格",
  structure: "分镜结构",
  motion: "动效配方",
  sound: "声音设计",
  script_skeleton: "文案骨架",
};

export const ALL_LAYERS = ["style", "structure", "motion", "sound", "script_skeleton"];

/** 模板里出现这些键就说明它带了「拍什么」—— 直接判不合法。 */
const CONTENT_KEYS = ["copy", "title", "subtitle", "headline", "product_name", "cta", "customer", "logo_text", "slogan"];
/** 只在 script_skeleton 层允许出现「文案骨架」，且必须是空位形式 {{slot}}。 */
const SLOT_TOKEN = /^\{\{[a-z0-9_]{1,32}\}\}$/;

function walk(obj, fn, path0) {
  const path = path0 || "";
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) { obj.forEach((v, i) => walk(v, fn, path + "[" + i + "]")); return; }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      fn(k, obj[k], path ? path + "." + k : k);
      walk(obj[k], fn, path ? path + "." + k : k);
    }
  }
}

/**
 * 校验一份模板。
 * 返回 {ok, errors[], warnings[], layers[]}。
 * errors 非空 = 不能套用；warnings 只是提示（例如动效卡未人工确认）。
 */
export function validateTemplate(tpl) {
  const errors = [];
  const warnings = [];
  if (!tpl || typeof tpl !== "object") return { ok: false, errors: ["模板不是对象"], warnings, layers: [] };
  if (tpl.schema && tpl.schema !== TEMPLATE_SCHEMA) errors.push("schema 不是 " + TEMPLATE_SCHEMA);
  if (!tpl.id) errors.push("缺 id");
  if (!tpl.name) errors.push("缺 name");
  const layers = Array.isArray(tpl.layers) ? tpl.layers.filter((x) => ALL_LAYERS.indexOf(x) >= 0) : [];
  if (!layers.length) errors.push("layers 为空或都是未知层");
  if (!Array.isArray(tpl.slots)) errors.push("slots 必须是数组（可以是空数组）");

  // 「不存拍什么」：除 script_skeleton 的 {{slot}} 外，任何位置出现内容键都算违规。
  const badPaths = [];
  walk(tpl, (k, v, p) => {
    if (CONTENT_KEYS.indexOf(k) < 0) return;
    // 允许形如 copy_skeleton: ["{{headline}}"] 的空位
    if (typeof v === "string" && SLOT_TOKEN.test(v.trim())) return;
    if (Array.isArray(v) && v.every((x) => typeof x === "string" && SLOT_TOKEN.test(x.trim()))) return;
    badPaths.push(p);
  });
  if (badPaths.length) errors.push("模板带了具体内容字段：" + badPaths.slice(0, 6).join(", "));

  if (layers.indexOf("motion") >= 0) {
    const cards = (tpl.motion && Array.isArray(tpl.motion.cards)) ? tpl.motion.cards : [];
    if (!cards.length) warnings.push("motion 层没有卡片序列，只给类目倾向（guess），套用后仍需人工选卡");
    if (tpl.motion && tpl.motion.needs_review) warnings.push("动效卡是推测结果，需要人工确认");
  }
  if (layers.indexOf("structure") >= 0) {
    const st = tpl.structure || {};
    const d = Array.isArray(st.durations_f) ? st.durations_f : [];
    if (!d.length) warnings.push("structure 层没有 durations_f，无法生成镜长骨架");
  }
  return { ok: errors.length === 0, errors, warnings, layers };
}

/** 把十六进制色变成 compile-hf 需要的字符串（模板里已经是 #rrggbb，这里只做兜底）。 */
function hex(v, fallback) {
  const s = String(v || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}

/** 从调色板里挑 ground / ink / accent：ground=占比最高，ink=对比最高，accent=最饱和且够亮。 */
export function paletteRoles(colors) {
  const list = (colors || []).filter((c) => c && (c.hex || c.color));
  if (!list.length) return null;
  const lum = (h) => {
    const s = String(h).replace("#", "");
    if (s.length !== 6) return 0;
    const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const byShare = list.slice().sort((a, b) => (Number(b.share) || 0) - (Number(a.share) || 0));
  const ground = byShare[0];
  let ink = null, best = -1;
  for (const c of list) {
    const h = c.hex || c.color;
    const d = Math.abs(lum(h) - lum(ground.hex || ground.color));
    if (d > best) { best = d; ink = c; }
  }
  let accent = null, bestSat = -1;
  for (const c of list) {
    const s = Number(c.sat);
    if (!(s >= 0.3) || (Number(c.share) || 0) < 0.02) continue;
    if (s > bestSat) { bestSat = s; accent = c; }
  }
  return {
    ground: hex(ground.hex || ground.color, "#0B0E14"),
    ink: hex((ink && (ink.hex || ink.color)), "#F4F1EA"),
    accent: accent ? hex(accent.hex || accent.color, "#D3923C") : null,
    support: byShare.slice(1, 4).map((c) => hex(c.hex || c.color, "#888888")),
  };
}

/**
 * 把模板套到一份工程上，返回新工程（不改入参）。
 * opts: {layers[], slots{}, fps, duration_s, at}
 * —— 只覆盖被选中的层，其余字段一律原样保留。
 */
export function applyTemplate(tpl, project, opts) {
  const o = opts || {};
  const v = validateTemplate(tpl);
  if (!v.ok) return { ok: false, errors: v.errors, project };
  const layers = (Array.isArray(o.layers) && o.layers.length ? o.layers : v.layers).filter((x) => v.layers.indexOf(x) >= 0);
  const next = JSON.parse(JSON.stringify(project || {}));
  const applied = [];
  const notes = [];
  const p = next.project || (next.project = {});
  const fps = Number(o.fps || p.fps) || 30;

  // ── style：调色板 + 动效 token + 安全区 ──────────────────────────────
  if (layers.indexOf("style") >= 0 && tpl.style) {
    const ds = next.design_spec || (next.design_spec = {});
    const roles = paletteRoles((tpl.style.palette && (tpl.style.palette.colors || tpl.style.palette)) || []);
    const pal = ds.palette || (ds.palette = {});
    if (roles) {
      pal.ground = roles.ground;
      pal.ink = roles.ink;
      if (roles.accent) pal.accent = roles.accent;
      else notes.push("参考片没有足够饱和的强调色，accent 保持原值（不硬编）");
      if (roles.support[0]) pal.muted = roles.support[0];
      applied.push("style");
    } else {
      notes.push("模板 style 层没有可用调色板");
    }
    if (tpl.style.motion_tokens_id) ds.motion_tokens_id = tpl.style.motion_tokens_id;
    if (tpl.style.safe_area) ds.safe_area = tpl.style.safe_area;
    if (tpl.style.aspect) {
      p.aspect = p.aspect || tpl.style.aspect;
      if (p.aspect !== tpl.style.aspect) notes.push("模板画幅 " + tpl.style.aspect + " 与工程 " + p.aspect + " 不一致，保留工程值");
    }
  }

  // ── structure：按时长缩放生成镜长骨架 ────────────────────────────────
  let skeleton = null;
  if (layers.indexOf("structure") >= 0 && tpl.structure) {
    const durs = (tpl.structure.durations_f || []).map(Number).filter((x) => x > 0);
    const cardsSeq = (tpl.motion && Array.isArray(tpl.motion.cards)) ? tpl.motion.cards : [];
    if (durs.length) {
      const targetF = Math.max(15, Math.round((Number(o.duration_s || p.duration_s) || (durs.reduce((a, b) => a + b, 0) / fps)) * fps));
      const MIN_F = 15; // 0.5s @30fps：一镜短于这个就不是"镜"了
      const maxShots = Math.max(1, Math.floor(targetF / MIN_F));
      let seq = durs.slice();
      if (seq.length > maxShots) {
        // 目标时长装不下这么多镜（每镜至少 15 帧）→ 等间隔抽稀，并明说抽了多少。
        const keep = [];
        for (let k = 0; k < maxShots; k++) keep.push(seq[Math.round((k * (seq.length - 1)) / Math.max(1, maxShots - 1))]);
        notes.push("目标 " + (targetF / fps).toFixed(1) + "s 装不下 " + seq.length + " 镜（每镜最少 " + MIN_F + " 帧），已等间隔抽成 " + maxShots + " 镜");
        seq = keep;
      }
      // 按权重分配帧数，且保证 sum 恰好等于 targetF（每镜 >= MIN_F）。
      // 直接 round(d*scale) 再夹最小值会让总和溢出（76 镜各夹 15 帧就会多出好几十秒），
      // 这里改成「先给每镜 MIN_F，剩余按权重分配 + 最大余数补齐」。
      const sumD = seq.reduce((a, b) => a + b, 0) || 1;
      const remain = targetF - seq.length * MIN_F;
      const rawShare = seq.map((d) => remain * (d / sumD));
      const floorShare = rawShare.map((x) => Math.floor(x));
      const usedShare = floorShare.reduce((a, b) => a + b, 0);
      let leftShare = remain - usedShare;
      const order = rawShare
        .map((x, i) => ({ i, frac: x - Math.floor(x) }))
        .sort((a, b) => b.frac - a.frac);
      for (let k = 0; leftShare > 0; k++, leftShare--) floorShare[order[k % order.length].i] += 1;
      let acc = 0;
      skeleton = seq.map((d, i) => {
        const f = MIN_F + floorShare[i];
        const item = {
          id: "s" + String(i + 1).padStart(2, "0"),
          card_id: cardsSeq[i] || "",
          category: "",
          intent: "",
          duration_f: f,
          energy: "mid",
          origin: "template",
        };
        acc += f;
        return item;
      });
      notes.push("结构层：按 " + seq.length + " 镜的密度缩放到 " + (targetF / fps).toFixed(1) + "s（同密度改写，不是原片结构）");
      applied.push("structure");
    } else {
      notes.push("模板 structure 层没有 durations_f，跳过");
    }
  }

  // ── motion：只写卡片序列与类目倾向，不臆造动效 ──────────────────────
  if (layers.indexOf("motion") >= 0 && tpl.motion) {
    const cardsSeq = Array.isArray(tpl.motion.cards) ? tpl.motion.cards : [];
    if (cardsSeq.length && skeleton) {
      skeleton.forEach((s, i) => { if (cardsSeq[i]) s.card_id = cardsSeq[i]; });
    }
    next.template_motion = {
      cards: cardsSeq,
      guess: Array.isArray(tpl.motion.guess) ? tpl.motion.guess : [],
      needs_review: tpl.motion.needs_review !== false,
    };
    applied.push("motion");
    if (tpl.motion.needs_review !== false) notes.push("动效层是类目倾向，不是确定卡名 —— 需要在分镜板上人工确认");
  }

  // ── sound：只取 BPM 与卡拍倾向，不复制原片音频 ──────────────────────
  if (layers.indexOf("sound") >= 0 && tpl.sound) {
    const au = next.audio || (next.audio = {});
    const bgm = au.bgm || (au.bgm = {});
    if (tpl.sound.bpm) {
      if (!bgm.bpm) { bgm.bpm = Math.round(tpl.sound.bpm); bgm.bpm_source = "template"; }
      else notes.push("工程已有 BGM BPM " + bgm.bpm + "，保留");
    }
    au.template_sound = { bpm: tpl.sound.bpm || null, bpm_is_estimate: !!tpl.sound.bpm_is_estimate, cut_beat_alignment: tpl.sound.cut_beat_alignment || null };
    applied.push("sound");
  }

  // ── script_skeleton：只允许空位，不写具体文案 ────────────────────────
  if (layers.indexOf("script_skeleton") >= 0 && tpl.script_skeleton) {
    next.script_skeleton = tpl.script_skeleton;
    applied.push("script_skeleton");
  }

  // 记录套用出处与槽位
  const slots = Array.isArray(tpl.slots) ? tpl.slots.slice() : [];
  const given = (o.slots && typeof o.slots === "object") ? o.slots : {};
  const filled = {};
  for (const k of slots) filled[k] = given[k] !== undefined && given[k] !== "" ? given[k] : "";
  next.template = {
    schema: TEMPLATE_SCHEMA,
    id: tpl.id,
    name: tpl.name,
    layers,
    slots: filled,
    slots_complete: slots.every((k) => !!filled[k]),
    applied_at: o.at || new Date().toISOString(),
  };
  if (skeleton && skeleton.length) {
    const cardsSeq = (tpl.motion && Array.isArray(tpl.motion.cards)) ? tpl.motion.cards : [];
    const oldShots = Array.isArray(next.shots) ? next.shots : [];
    // 「已经有真分镜」的判据是：存在带 card_id 的镜头。空壳 shots（只有时长没有卡）不算真分镜，
    // 那种情况可以被模板骨架替换；已配卡的分镜绝不能被无卡的骨架盖掉。
    const hasRealStoryboard = oldShots.some((x) => x && x.card_id);
    if (!cardsSeq.length && hasRealStoryboard) {
      // 模板只给了镜长，没有动效卡 —— 绝不能拿空卡盖掉用户已确认的分镜（会产生一堆 C0 缺卡错误）。
      // 结构层降级为「建议」，写进 template_structure，等用户在分镜板上自己决定要不要用。
      next.template_structure = {
        durations_f: skeleton.map((x) => x.duration_f),
        shot_count: skeleton.length,
        total_f: skeleton.reduce((a, x) => a + x.duration_f, 0),
        total_s: Number((skeleton.reduce((a, x) => a + x.duration_f, 0) / fps).toFixed(2)),
        note: "模板没有动效卡序列，结构只作为镜长建议保存，未覆盖现有分镜",
      };
      notes.push("结构层没有卡片序列：只写镜长建议，不动现有分镜");
    } else {
      // 有卡片序列，或工程还没有分镜 → 用骨架；保留原 shots 的文案（按位置对齐）。
      const old = oldShots;
      next.shots = skeleton.map((s, i) => Object.assign({}, s, old[i] ? { copy: old[i].copy, intent: old[i].intent || s.intent } : {}));
      if (!cardsSeq.length) {
        notes.push("工程原本没有分镜：已按模板密度生成 " + skeleton.length + " 镜骨架，卡片仍需在分镜板上逐镜选定");
      }
    }
  }
  return { ok: true, project: next, applied, notes, slots, slots_complete: next.template.slots_complete, warnings: v.warnings };
}

/** slots 没填满就不许进分镜阶段 —— 服务端 gate 与界面都用这一条。 */
export function canEnterStoryboard(project) {
  const t = project && project.template;
  if (!t) return { ok: true, missing: [] };
  const slots = t.slots || {};
  const missing = Object.keys(slots).filter((k) => !slots[k]);
  return { ok: missing.length === 0, missing };
}
