#!/usr/bin/env node
/**
 * build-card-index.mjs —— 把上游 124 张镜头配方卡归一化成插件可检索的「品味索引」。
 *
 * 输入：video-shotcraft 快照 references/shots/ 下的配方卡 + gallery/api/library.json
 * 输出：knowledge/shot-cards.json（机器可读） + knowledge/shot-cards.md（人读目录）
 *
 * 上游条款：Apache-2.0，保留作者与出处。派生文件头部自动写入 attribution。
 *
 * 用法：node scripts/build-card-index.mjs --src <video-shotcraft 根目录>
 */
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, relative, basename } from 'node:path';

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SRC = resolve(getArg('--src', join(process.cwd(), '..', '01_Github', '02_video-shotcraft')));
const OUT = resolve(getArg('--out', join(process.cwd(), 'knowledge')));

function parseCard(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (m) for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const ref = (raw.match(/## 参考实现\n+([^\n]+)/) || [])[1] || '';
  const intent = (raw.match(/## 意图\n+([\s\S]*?)\n## /) || [])[1]?.trim().replace(/\n/g, ' ') || '';
  const known = (raw.match(/## 已知坑\n+([\s\S]*?)\n## /) || [])[1]?.trim().split('\n').filter(Boolean) || [];
  return { fm, ref, intent, known };
}

const root = join(SRC, 'references', 'shots');
const cards = [];
for (const cat of readdirSync(root).sort()) {
  const d = join(root, cat);
  if (!statSync(d).isDirectory()) continue;
  for (const f of readdirSync(d).sort()) {
    if (!f.endsWith('.md') || f === 'ATTRIBUTION.md') continue;
    const file = join(d, f);
    const { fm, ref, intent, known } = parseCard(file);
    cards.push({
      id: fm.name || basename(f, '.md'),
      category: cat,
      summary: fm['一句话'] || '',
      use: fm['适用'] || '',
      duration: fm['时长'] || '',
      energy: fm['能量'] || '',
      tags: (fm['标签'] || '').split(/[,，、\s]+/).filter(Boolean),
      intent: intent.slice(0, 300),
      known_pitfalls: known.map(s => s.replace(/^-\s*/, '')).slice(0, 8),
      reference_impl: ref.trim(),
      source_path: relative(SRC, file).replace(/\\/g, '/')
    });
  }
}

// 补齐 gallery style-key / 预览索引
let library = null;
try { library = JSON.parse(readFileSync(join(SRC, 'gallery', 'api', 'library.json'), 'utf8')); } catch {}
const byName = new Map((library?.cards || []).map(c => [c.name, c]));
for (const c of cards) {
  const g = byName.get(c.id);
  c.style_keys = (g?.styles || []).map(s => s.key);
  c.preview_url = g?.styles?.[0]?.media?.url || null;
  c.category_gallery = g?.category || c.category;
}

const index = {
  schema: 'cineforge/shot-cards/v1',
  attribution: 'Derived from video-shotcraft references/shots by Wei Yihao — Apache-2.0. https://github.com/Vincentwei1021/video-shotcraft',
  generated_from: SRC,
  card_count: cards.length,
  style_count: cards.reduce((n, c) => n + c.style_keys.length, 0),
  categories: [...new Set(cards.map(c => c.category))].sort(),
  cards
};
writeFileSync(join(OUT, 'shot-cards.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');

const lines = [
  '# 镜头配方卡索引（派生）',
  '',
  '> 上游：video-shotcraft by Wei Yihao，Apache-2.0。https://github.com/Vincentwei1021/video-shotcraft',
  `> 共 ${index.card_count} 张卡 / ${index.style_count} 个 style。由 scripts/build-card-index.mjs 生成，勿手改。`,
  ''
];
for (const cat of index.categories) {
  lines.push(`## ${cat}（${cards.filter(c => c.category === cat).length}）`, '');
  lines.push('| id | 一句话 | 时长 | 能量 | 参考实现 |', '|---|---|---|---|---|');
  for (const c of cards.filter(c => c.category === cat)) {
    lines.push(`| ${c.id} | ${c.summary.replace(/\|/g, '/').slice(0, 90)} | ${c.duration.replace(/\|/g, '/')} | ${c.energy.replace(/\|/g, '/')} | ${c.reference_impl.replace(/\|/g, '/')} |`);
  }
  lines.push('');
}
writeFileSync(join(OUT, 'shot-cards.md'), lines.join('\n'), 'utf8');
console.log(`OK: ${index.card_count} cards / ${index.style_count} styles -> knowledge/`);
