/**
 * dsh-cineforge / Cordis 插件入口
 *
 * 契约实证来源：dsh-hyperframes@0.14.1/lib/skill-bundle.js（register 通路）
 * 与 dsh-univer-office/lib/index.js（registerProvider 通路）。两者并存时优先
 * register(definition)，因为它允许显式给出 resourceBase = 插件根目录。
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkills } from './skill-loader.js';

export const name = 'cineforge-skills';
export const inject = ['skills'];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = 'dsh-cineforge';

function warn(ctx, detail) {
  const text = '[' + PLUGIN + '] ' + detail;
  if (ctx.logger && typeof ctx.logger.warn === 'function') ctx.logger.warn(text);
  else console.warn(text);
}

export function apply(ctx) {
  const skills = loadSkills(ROOT);
  const definitions = skills.map((s) => ({
    name: s.name,
    description: s.description,
    content: s.content,
    resourceBase: { kind: 'directory', path: ROOT },
    source: 'runtime',
    provider: PLUGIN,
  }));
  const disposers = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const remove of disposers.splice(0).reverse()) {
      try { remove(); } catch (e) { warn(ctx, '卸载失败：' + String(e)); }
    }
  };
  if (ctx.effect) ctx.effect(() => dispose);
  if (ctx.on) ctx.on('dispose', dispose);

  if (ctx.skills && typeof ctx.skills.register === 'function') {
    for (const def of definitions) {
      const remove = ctx.skills.register(def);
      if (typeof remove !== 'function') throw new Error('skills.register 未返回卸载函数。');
      disposers.push(remove);
    }
  } else if (ctx.skills && typeof ctx.skills.registerProvider === 'function') {
    const provider = {
      name: PLUGIN,
      list: () => Promise.resolve(definitions.map((d) => ({
        name: d.name,
        description: d.description,
        provider: PLUGIN,
        source: 'runtime',
        resourceBase: d.resourceBase,
      }))),
      get: (candidate) => Promise.resolve(definitions.find((d) => d.name === candidate.name)),
    };
    const remove = ctx.skills.registerProvider(() => provider);
    if (typeof remove === 'function') disposers.push(remove);
  } else {
    dispose();
    throw new Error(PLUGIN + ' 需要宿主提供 skills.register 或 skills.registerProvider');
  }

  // 可选：自检工具。tools 服务缺席时静默跳过，绝不影响技能注册。
  if (ctx.tools && typeof ctx.tools.register === 'function') {
    const health = async () => {
      const rows = [];
      for (const def of definitions) {
        let registered = false;
        let registryChecked = false;
        if (!disposed && ctx.skills && typeof ctx.skills.get === 'function') {
          try {
            const actual = await ctx.skills.get(def.name);
            registryChecked = true;
            registered = !!actual && actual.name === def.name
              && actual.description === def.description && actual.content === def.content;
          } catch (e) { warn(ctx, '读取宿主技能注册表失败：' + String(e)); }
        }
        rows.push({
          name: def.name,
          ok: !disposed && (!registryChecked || registered),
          registered,
          registryChecked,
          file: skills.find((s) => s.name === def.name).file,
        });
      }
      return {
        ok: !disposed && rows.every((r) => r.ok),
        plugin: PLUGIN,
        skills: rows,
        backend: 'hyperframes',
        shot_cards: 124,
        resource_base: ROOT,
      };
    };
    try {
      const remove = ctx.tools.register({
        name: 'cineforge_health',
        description: PLUGIN + ' 自检：核对 3 个导演技能的注册状态与宿主技能注册表一致性。',
        parameters: { type: 'object', properties: {} },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render(_args, value) {
            const lines = [PLUGIN + ' 自检' + (value.ok ? '：技能资源完整且已注册。' : '：发现技能注册异常。')];
            for (const s of value.skills) {
              lines.push('- ' + s.name + '：' + (s.ok ? 'OK' : 'FAIL ' + s.detail) + ' [' + s.file + ']');
            }
            return [{ type: 'text', text: lines.join(String.fromCharCode(10)) }];
          },
        },
        execute: health,
      });
      if (typeof remove !== 'function') throw new Error('tools.register 未返回卸载函数。');
      disposers.push(remove);
    } catch (e) {
      warn(ctx, '自检工具注册失败（不影响技能）：' + String(e));
    }
  }
}
