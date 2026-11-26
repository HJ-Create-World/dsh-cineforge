// CineForge · GOAL 模式状态机（零依赖纯函数，服务端与自检共用）
//
// 设计口径（docs/工作台设计.md §5、§12）：
//   1) GOAL 不改变阶段顺序，只改变「谁按继续」—— 用户按 → AI 按。
//   2) 硬门（分镜确认 / 发布）默认不由 GOAL 自动通过；要自动过必须在启动时手写 overrides 记录。
//   3) 打断只在安全点生效：阶段边界，或单镜渲染完成。打断不删除已完成产物。
//   4) 回退置 status=interrupted，且绝不自动重启 GOAL。
//
// 这个文件只描述「状态」，不执行任何渲染 —— 执行器在对话里（导演技能），
// 工作台负责把状态写进 goal-state.json 并如实展示。

export const GOAL_SCHEMA = "cineforge/goal-state/v1";

/** 与 client.js 的 STAGE_ORDER 同序，但用大写下划线形式（schema 要求）。 */
export const GOAL_STAGES = [
  "IDEA", "BRIEF", "SCRIPT", "SPEC", "MAPPING", "STORYBOARD",
  "ASSETS", "BUILD", "SOUND", "QA", "DELIVER", "PUBLISHED",
];

/** 低阶段名（project.stage 用的形式）→ GOAL 阶段名。 */
export const STAGE_TO_GOAL = {
  idea: "IDEA", brief: "BRIEF", copy: "SCRIPT", visual: "SPEC", cards: "MAPPING",
  storyboard: "STORYBOARD", assets: "ASSETS", build: "BUILD", audio: "SOUND",
  qa: "QA", deliver: "DELIVER", published: "PUBLISHED",
};

/** 硬门清单：这两道门默认不允许 GOAL 自动通过。 */
export const HARD_GATES = ["storyboard_approve", "publish_approve"];

export function goalStageOf(stage) {
  return STAGE_TO_GOAL[String(stage || "").toLowerCase()] || "IDEA";
}

export function stageIndexOfGoal(stage) {
  const i = GOAL_STAGES.indexOf(String(stage || "").toUpperCase());
  return i < 0 ? 0 : i;
}

/** 新建一份 goal 状态（默认停在当前阶段、running）。 */
export function newGoalState(opts) {
  const o = opts || {};
  const stage = o.stage ? goalStageOf(o.stage) : "IDEA";
  return {
    schema: GOAL_SCHEMA,
    stage,
    status: "running",
    mode: o.mode || "auto",
    waiting_for: null,
    safe_point: { stage, shot_id: null },
    completed_stages: [],
    interrupt_requested: false,
    overrides: Array.isArray(o.overrides) ? o.overrides.slice() : [],
    last_heartbeat: o.at || new Date().toISOString(),
  };
}

/** 读工程里的 goal（没有就返回 null，不臆造）。 */
export function goalOf(project) {
  const g = project && project.goal;
  if (!g || typeof g !== "object" || !g.stage) return null;
  return g;
}

/** 某道硬门是否被 overrides 手写放行。 */
export function hasOverride(state, gate) {
  const list = (state && state.overrides) || [];
  return list.some((o) => o && o.gate === gate);
}

/**
 * 能不能自动往下走。
 * 返回 {ok:true} 或 {ok:false, reason, waiting_for}。
 * —— 这就是「GOAL 不越过硬门」的唯一判据，UI 与服务端都调它。
 */
export function canAutoAdvance(state, gates) {
  if (!state) return { ok: false, reason: "no-goal", waiting_for: null };
  if (state.status !== "running") return { ok: false, reason: "status-" + state.status, waiting_for: state.waiting_for || null };
  if (state.interrupt_requested) return { ok: false, reason: "interrupt-pending", waiting_for: null };
  const g = gates || {};
  const sb = g.storyboard && g.storyboard.open;
  if (!sb && !hasOverride(state, "storyboard_approve")) {
    return { ok: false, reason: "hard-gate-storyboard", waiting_for: "storyboard_approve" };
  }
  return { ok: true, reason: "", waiting_for: null };
}

/**
 * 到达一个安全点（阶段边界 / 单镜渲染完成）时落盘。
 * 如果之前请求过打断，就在这里停住 —— 这是「随时可打断」的真实语义。
 */
export function reachSafePoint(state, opts) {
  const o = opts || {};
  if (!state) return null;
  const next = Object.assign({}, state, {
    safe_point: { stage: o.stage || state.stage, shot_id: o.shot_id === undefined ? (state.safe_point && state.safe_point.shot_id) || null : o.shot_id },
    last_heartbeat: o.at || new Date().toISOString(),
  });
  if (o.stage) next.stage = o.stage;
  if (o.completed_stage && next.completed_stages.indexOf(o.completed_stage) < 0) {
    next.completed_stages = (next.completed_stages || []).concat([o.completed_stage]);
  }
  if (next.interrupt_requested) {
    next.status = "interrupted";
    next.interrupt_requested = false;
  }
  return next;
}

/** 请求打断：只置标记，真正停下要等下一个安全点。 */
export function requestInterrupt(state, at) {
  if (!state) return null;
  return Object.assign({}, state, { interrupt_requested: true, last_heartbeat: at || new Date().toISOString() });
}

/** 恢复 / 开始跑。interrupted → running；不自动跳过已完成阶段。 */
export function resumeGoal(state, at) {
  if (!state) return null;
  return Object.assign({}, state, {
    status: "running",
    interrupt_requested: false,
    last_heartbeat: at || new Date().toISOString(),
  });
}

/** 暂停（用户主动），与「打断」不同：立刻生效，不需要等安全点。 */
export function pauseGoal(state, at) {
  if (!state) return null;
  return Object.assign({}, state, { status: "waiting", last_heartbeat: at || new Date().toISOString() });
}

/** 处于等待硬门时，门被放行 → 回到 running。 */
export function clearWaiting(state, at) {
  if (!state) return null;
  if (state.status !== "waiting") return Object.assign({}, state, { last_heartbeat: at || new Date().toISOString() });
  return Object.assign({}, state, {
    status: "running",
    waiting_for: null,
    last_heartbeat: at || new Date().toISOString(),
  });
}

/** 给界面用的人话摘要。 */
export function goalSummary(state) {
  if (!state) return { text: "未启用 GOAL", tone: "off" };
  const map = {
    running: "自动推进中", waiting: "等用户拍板", interrupted: "已打断（停在安全点）",
    done: "已完成", failed: "执行失败",
  };
  const idx = stageIndexOfGoal(state.stage);
  const text = (map[state.status] || state.status) + " · " + (idx + 1) + "/" + GOAL_STAGES.length + " " + state.stage;
  return { text, tone: state.status === "interrupted" ? "warn" : state.status === "running" ? "ok" : "idle" };
}

/** 把一个阶段的推进写回工程（stage 用小写形式，保持与 project.stage 一致）。 */
export function goalToProjectStage(state) {
  if (!state) return "";
  const s = String(state.stage || "").toUpperCase();
  const i = GOAL_STAGES.indexOf(s);
  if (i < 0) return "";
  const low = ["idea", "brief", "copy", "visual", "cards", "storyboard", "assets", "build", "audio", "qa", "deliver", "deliver"];
  return low[i] || "";
}
