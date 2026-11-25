// CineForge / HyperFrames 版面模块（v0.3.2 返工）
// 八种版式：六个功能版式 + Q5 单主体开场 hero + Q8 发布会合影 outro-finale。
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

// Q5：开场单主体 —— 无角标 / 无脚注 / 无进度条，仅字标 + 一圈光环 + 聚光。
// 动作弧「聚光 → 推近 → 悬浮 → 描边光 → 归位」由 buildTweens 分元素实现。
function heroBody() {
  return `<div class="shot__main hero-main">
  <div class="hero-ring"></div>
  <div class="hero-glow"></div>
  <h1 class="shot__title hero-title">{{TITLE}}</h1>
  <p class="hero-sub">{{SUB}}</p>
</div>`;
}

// Q8：收尾发布会合影 —— 四个已展示功能的代表元素从四方飞入围住字标，
// 舞台光自上打下、12 粒子从中心炸开，字标最后落定并 hold 到片尾。
function finaleBody() {
  return `<div class="finale-stage">
   <div class="finale-beam" data-layout-ignore></div>
   <div class="finale-row finale-row--top">
     <span class="finale-chip finale-chip--tl">124 张配方卡</span>
     <span class="finale-chip finale-chip--tr">分镜确认门</span>
   </div>
   <div class="finale-wordmark">
     <h1 class="outro-mark">{{TITLE}}</h1>
     <p class="shot__sub">{{SUB}}</p>
     <p class="finale-tagline">{{FOOT}}</p>
   </div>
   <div class="finale-row finale-row--bottom">
     <span class="finale-chip finale-chip--bl">150 个动效预览</span>
     <span class="finale-chip finale-chip--br">6 种版式</span>
   </div>
 {{SPARKS}}
 </div>`;
}
export const LAYOUTS = Object.freeze({
  title: titleBody,
  "card-grid": cardGridBody,
  checklist: checklistBody,
  metric: metricBody,
  quote: quoteBody,
  outro: outroBody,
  hero: heroBody,
  "outro-finale": finaleBody
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
