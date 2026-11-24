// CineForge · HyperFrames 动效原语（一期）
//
// 一期刻意不追求 124 张卡的逐卡精确映射（那是 docs/ROADMAP.md 三期工作）。
// 本表把 10 类镜头与常见转场名映射到 7 个确定性 GSAP 原语，保证：
//   1. 任何分镜 JSON 都能编译成可过 hyperframes check 的真实成片；
//   2. 不动效参数随卡而异的假象 —— 逐卡精确映射是三期交付物；
//   3. 全部参数可溯源到 knowledge/motion-tokens.json 的 6 个预设。
//
// easing 说明：motion-tokens.json 给的是 CSS cubic-bezier 字符串，
// GSAP 不接受该写法，故此处给出语义等价的 GSAP ease 名（近似映射）。

export const TOKEN_EASE = {
  "professional-trust": "power2.out",
  "refined-premium": "power2.inOut",
  "energetic-bold": "back.out(1.7)",
  "playful-cheerful": "back.out(1.4)",
  "calm-caring": "power1.inOut",
  "friendly-small": "power2.out"
};

// from/to 为 GSAP tween 参数；duration 是默认秒数，编译器会按
// motion-tokens 预设的 duration_f30 与单镜时长重算后覆盖。
export const PRIMITIVES = {
  "fade":       { from: { opacity: 0 },                  to: { opacity: 1, duration: 0.50 } },
  "slide-up":   { from: { opacity: 0, yPercent: 14 },    to: { opacity: 1, yPercent: 0, duration: 0.55 } },
  "slide-left": { from: { opacity: 0, xPercent: 16 },    to: { opacity: 1, xPercent: 0, duration: 0.55 } },
  "scale-in":   { from: { opacity: 0, scale: 0.88 },     to: { opacity: 1, scale: 1, duration: 0.55 } },
  "crash-zoom": { from: { opacity: 0, scale: 1.32 },     to: { opacity: 1, scale: 1, duration: 0.62 } },
  "wipe":       { from: { opacity: 0, xPercent: -12 },   to: { opacity: 1, xPercent: 0, duration: 0.48 } },
  "hold":       { from: { opacity: 0 },                  to: { opacity: 1, duration: 0.28 } }
};

// 10 类镜头（与 knowledge/shot-cards.json 的 categories 一致）到原语的默认映射。
export const CATEGORY_PRIMITIVE = {
  "camera": "crash-zoom",
  "data": "scale-in",
  "effects": "scale-in",
  "interaction": "slide-left",
  "opening": "crash-zoom",
  "outro": "hold",
  "rhythm": "slide-up",
  "transition": "wipe",
  "typography": "slide-up",
  "ui-entrance": "slide-left"
};

// 分镜里 transition_in 若命中这些关键词，优先覆盖类别默认映射。
export const TRANSITION_OVERRIDE = {
  "hidden-cut": "fade",
  "travel": "wipe",
  "push": "slide-up",
  "flip": "scale-in",
  "dissolve": "fade",
  "cut": "fade",
  "zoom": "crash-zoom"
};

export function resolvePrimitive(shot, category) {
  const t = String(shot && shot.transition_in ? shot.transition_in : "").toLowerCase();
  for (const k of Object.keys(TRANSITION_OVERRIDE)) {
    if (t.indexOf(k) >= 0) return TRANSITION_OVERRIDE[k];
  }
  if (category && CATEGORY_PRIMITIVE[category]) return CATEGORY_PRIMITIVE[category];
  return "fade";
}

export function resolveEase(designSpec) {
  const id = designSpec && designSpec.motion_tokens_id;
  return TOKEN_EASE[id] || "power2.out";
}

export const DEFAULT_TOKEN_ID = "professional-trust";