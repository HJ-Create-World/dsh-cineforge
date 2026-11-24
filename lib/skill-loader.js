/**
 * dsh-cineforge / 技能加载器（零依赖）
 *
 * 与 dsh-hyperframes/lib/skill-bundle.js 的差别只有一个：注册时 resourceBase
 * 指向【插件根目录】而不是 skills/<name>/ 子目录。因为 CineForge 的技能正文里
 * 引用了 knowledge/... 与 upstream/...（基准是插件根），宿主把 resourceBase.path
 * 当作技能文档所在目录用于解析相对资源，且不会改写注册方给的值。
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

export const SKILL_NAMES = ['cineforge-director', 'cineforge-cards', 'cineforge-qa'];

/** 解析 SKILL.md 的 YAML frontmatter（只取 name / description，值均为单行）。 */
export function parseSkill(text) {
  const lines = text.split(CR).join('').split(NL);
  if (lines[0].trim() !== '---') throw new Error('SKILL.md 缺少 YAML frontmatter 起始行');
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end < 0) throw new Error('SKILL.md 缺少 YAML frontmatter 结束行');
  const fields = {};
  for (let i = 1; i < end; i += 1) {
    const line = lines[i];
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.length >= 2 && ((value[0] === '"' && value[value.length - 1] === '"') || (value[0] === "'" && value[value.length - 1] === "'"))) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  const content = lines.slice(end + 1).join(NL).trimStart();
  const name = fields.name || '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error('frontmatter name 必须为 kebab-case：' + name);
  if (!fields.description) throw new Error('frontmatter description 为空');
  if (!content.trim()) throw new Error('技能正文为空');
  return { name, description: fields.description, content };
}

export function loadSkills(root) {
  const skillsDir = resolve(root, 'skills');
  return SKILL_NAMES.map((name) => {
    const file = join(skillsDir, name, 'SKILL.md');
    const parsed = parseSkill(readFileSync(file, 'utf8'));
    if (parsed.name !== name) throw new Error('frontmatter name 与技能目录名不一致：' + name + ' vs ' + parsed.name);
    return { ...parsed, file };
  });
}
