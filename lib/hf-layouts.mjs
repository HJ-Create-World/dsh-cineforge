// CineForge / HyperFrames 版面模块（v0.3 返工）
// 六种版式解决独立终检 P4「5 镜同模板」：每个功能点有专属版式。
// 返回串只含 {{PLACEHOLDER}}，由 compile-hf.mjs 的 fill() 统一替换，保证产物确定性。

function titleBody() {
  return `<p class="shot__eyebrow">{{N}} / {{TOTAL}} · {{CATEGORY_UPPER}}</p>
<div class="shot__main">
  <h1 class="shot__title">{{TITLE}}</h1>
  <p class="shot__sub">{{SUB}}</p>
</div>
<p class="shot__foot">{{FOOT}}</p>`;
}

function cardGridBody() {
  return `<p class="shot__eyebrow">{{N}} / {{TOTAL}} · {{CATEGORY_UPPER}}</p>
<div class="shot__main">
  <h1 class="shot__title">{{TITLE}}</h1>
  <p class="shot__sub">{{SUB}}</p>
  <div class="shot__cards">{{ITEMS}}</div>
</div>
<p class="shot__foot">{{FOOT}}</p>`;
}

function checklistBody() {
  return `<p class="shot__eyebrow">{{N}} / {{TOTAL}} · {{CATEGORY_UPPER}}</p>
<div class="shot__main">
  <h1 class="shot__title">{{TITLE}}</h1>
  <p class="shot__sub">{{SUB}}</p>
  <div class="shot__list">{{ITEMS}}</div>
</div>
<p class="shot__foot">{{FOOT}}</p>`;
}

function metricBody() {
  return `<p class="shot__eyebrow">{{N}} / {{TOTAL}} · {{CATEGORY_UPPER}}</p>
<div class="shot__main">
  <h1 class="shot__title">{{TITLE}}</h1>
  <div class="metric-num">{{METRIC}}</div>
  <p class="shot__sub">{{SUB}}</p>
</div>
<p class="shot__foot">{{FOOT}}</p>`;
}

function quoteBody() {
  return `<p class="shot__eyebrow">{{N}} / {{TOTAL}} · {{CATEGORY_UPPER}}</p>
<div class="shot__main">
  <div class="quote-rule"></div>
  <h1 class="shot__title">{{TITLE}}</h1>
  <p class="shot__sub">{{SUB}}</p>
</div>
<p class="shot__foot">{{FOOT}}</p>`;
}

function outroBody() {
  return `<p class="shot__eyebrow">{{N}} / {{TOTAL}} · {{CATEGORY_UPPER}}</p>
<div class="shot__main">
  <h1 class="outro-mark">{{TITLE}}</h1>
  <p class="shot__sub">{{SUB}}</p>
</div>
<p class="shot__foot">{{FOOT}}</p>`;
}

export const LAYOUTS = Object.freeze({
  title: titleBody,
  "card-grid": cardGridBody,
  checklist: checklistBody,
  metric: metricBody,
  quote: quoteBody,
  outro: outroBody
});

export const DEFAULT_LAYOUT = "title";

export function resolveLayout(shot) {
  const key = shot && shot.layout;
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(LAYOUTS, key) ? key : DEFAULT_LAYOUT;
}

export function layoutBody(layout) {
  const fn = LAYOUTS[layout] || LAYOUTS[DEFAULT_LAYOUT];
  return fn();
}
