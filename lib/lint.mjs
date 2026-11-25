/**
 * CineForge / 分镜结构体检（零依赖 · 纯函数）
 *
 * 为什么要有这一层：工作台里用户拖着改分镜，几秒钟就能把 11 个阶段做出来的节奏改坏，
 * 而"节奏坏了"在静帧上完全看不出来。这里把 engineering 能判准的那几条做成机器判据，
 * 让"确认放行"按钮不是随便点的 —— 有 error 就点不动。
 *
 * 判据来源：knowledge/aesthetic-rules.json（27 条），本文件只实现**能从 project.json 算出来**的那部分。
 * 剩下的（色彩对比、字体层级、音频对齐）由静态验收与终检负责，这里不假装能判。
 *
 * 判据分级：
 *   error —— 结构性错误，放行按钮要挡住（缺卡、时长为 0、超长文案溢出）
 *   warn  —— 审美风险，允许放行但要看到（呼吸不足、能量弧倒挂、镜头过碎）
 *   info  —— 提示，不影响放行
 */
const CAT_INFO = ["opening", "typography", "data", "ui-entrance", "outro"];
const ENERGY_RANK = { low: 0, mid: 1, "mid-high": 2, high: 3, peak: 4 };

/** 单镜落定动画时长（与 compile-hf.buildTweens 的 bodyDur 公式保持一致）。 */
export function settleDuration(dur_s) {
  return Math.min(0.62, Math.max(0.32, dur_s * 0.24));
}

function fmt(n) { return Number(n.toFixed(2)); }

/**
 * @param {object} project project.json 内容
 * @param {object} [cardMap] 卡 id → {category,summary}（可缺）
 * @returns {{passed:boolean, findings:Array, summary:{errors:number,warns:number,infos:number,shots:number,duration_s:number}}}
 */
export function lintStoryboard(project, cardMap) {
  const findings = [];
  const p = (project && project.project) || {};
  const shots = Array.isArray(project && project.shots) ? project.shots.slice() : [];
  const fps = Number(p.fps) || 30;
  const cards = cardMap || {};
  const add = (rule, severity, message, shot) => findings.push({ rule, severity, message, shot: shot == null ? null : shot });

  if (!shots.length) {
    add("S0", "error", "分镜为空：至少要有一镜才能放行", null);
  }

  let totalF = 0;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i] || {};
    const idx = i + 1;
    const durF = Number(s.duration_f) || 0;
    const dur_s = durF / fps;
    totalF += durF;

    if (!durF) add("R0", "error", "S" + idx + " 时长为 0，不会出现在成片里", idx);
    if (!s.card_id) add("C0", "error", "S" + idx + " 没有配动效卡，无法渲染", idx);
    else if (Object.keys(cards).length && !cards[s.card_id]) add("C1", "warn", "S" + idx + " 的卡「" + s.card_id + "」不在 124 张卡库里（自造卡名，动效会退化成默认）", idx);

    if (!s.primitive) add("C2", "warn", "S" + idx + " 没有 primitive，渲染会退回 fade", idx);

    // R1：关键信息落定后必须呼吸。承载信息的三类（字卡/数据/界面）要求更严。
    if (durF) {
      const hold = dur_s - settleDuration(dur_s);
      const carriesInfo = CAT_INFO.indexOf(s.category) >= 0 || s.layout === "hero" || s.layout === "outro-finale";
      const need = carriesInfo ? 1.0 : 0.6;
      if (hold < need) {
        add("R1", hold < need * 0.6 ? "error" : "warn",
          "S" + idx + " 落定后只停了 " + fmt(hold) + "s（要求 ≥" + need + "s）：观众还没读完就切走了", idx);
      }
    }

    // C3：画面文案长度。竖屏 1080 宽时标题超过 18 字会换行溢出安全区。
    const copy = s.copy || {};
    const title = String(copy.title || "");
    if (title.length > 18) add("C3", "warn", "S" + idx + " 标题 " + title.length + " 字，竖屏会挤成三行：建议拆成两镜或删到 18 字内", idx);
    const sub = String(copy.sub || "");
    if (sub.length > 34) add("C3", "info", "S" + idx + " 副标题 " + sub.length + " 字，可能超出安全区", idx);

    // R5：单镜过长。超过 8 秒还没有内部位移，观感会"卡住"。
    if (dur_s > 8) add("R5", "info", "S" + idx + " 单镜 " + fmt(dur_s) + "s，超过 8 秒：确认中间有位移或分镜里再拆一层", idx);
  }

  // R3：镜头过碎。中位镜长 < 1.2s 时观众来不及认，只适合节奏蒙太奇。
  if (shots.length >= 4) {
    const ds = shots.map((s) => (Number(s.duration_f) || 0) / fps).sort((a, b) => a - b);
    const med = ds[Math.floor(ds.length / 2)];
    if (med < 1.2) add("R3", "warn", "中位镜长 " + fmt(med) + "s：全片偏碎，除非刻意做节奏蒙太奇", null);
  }

  // R4：能量弧。开头不许是峰值，结尾要落回来。
  const firstE = shots.length ? ENERGY_RANK[shots[0].energy] : null;
  if (firstE != null && firstE >= 3) add("R4", "warn", "第一镜能量是「" + shots[0].energy + "」：开场就顶满，后面没有上升空间", 1);
  const lastE = shots.length ? ENERGY_RANK[shots[shots.length - 1].energy] : null;
  if (lastE != null && lastE >= 3) add("R4", "warn", "最后一镜能量仍很高：收尾没有落回来，观众不会「松口气」", shots.length);

  // P1：时长声明与实际分镜不一致（编排器按 from 排，不按 duration_s 排）。
  const declared = Math.round(Number(p.duration_s || 0) * fps);
  if (declared && totalF && Math.abs(declared - totalF) > fps * 0.5) {
    add("P1", "warn", "project.duration_s 声明 " + p.duration_s + "s（" + declared + "f），实际分镜 " + fmt(totalF / fps) + "s（" + totalF + "f）", null);
  }

  // P2：from 不连续（拖动重排后可能出现空洞，成片里会黑一下）。
  let cursor = 0;
  for (let i = 0; i < shots.length; i++) {
    const from = Number(shots[i].from);
    if (Number.isFinite(from) && from !== cursor) {
      add("P2", "warn", "S" + (i + 1) + " 的 from=" + from + " 与上一镜结尾 " + cursor + " 不连续：成片会出现空档", i + 1);
    }
    cursor = (Number.isFinite(from) ? from : cursor) + (Number(shots[i].duration_f) || 0);
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  return {
    passed: errors === 0 && shots.length > 0,
    findings,
    summary: { errors, warns, infos, shots: shots.length, duration_s: fmt(totalF / fps) },
  };
}
