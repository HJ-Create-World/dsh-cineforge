/**
 * dsh-cineforge / Cordis 插件入口
 *
 * 契约实证来源：dsh-hyperframes@0.14.1/lib/skill-bundle.js（register 通路）
 * 与 dsh-univer-office/lib/index.js（registerProvider 通路）。两者并存时优先
 * register(definition)，因为它允许显式给出 resourceBase = 插件根目录。
 *
 * 取服务姿势（v0.3.1 修复，真机踩坑）：Cordis 的 ctx 是 Proxy
 * （src/reflect.ts:144-169 的 get 陷阱）。读取未在 inject 声明的服务属性
 * 不是返回 undefined，而是当场抛「cannot get property X without inject」。
 * v0.3.0 用 ctx.tools 直读做可选自检，真机报
 * 「1 entry did not activate cineforge-skills (dsh-cineforge): Error:
 *  cannot get property "tools" without inject」，3 个技能全没注册上。
 * 修法：一律经 optionalService() —— 优先 ctx.get(name, false) 非严格形式
 * （服务缺席返回 undefined 而不抛），普通对象 mock 才回退到属性读取且包 try/catch。
 * 依据 dsh-github-flow/lib/api/routes.js、dsh-our-free-model/index.js、
 * @linxin666/dsh-client-ui-skill-explorer/lib/index.js 的同款姿势。
 *
 * tools 只用于可选自检，绝不写进 inject：声明后若某 profile（CLI/TUI）没有
 * 该服务，插件会一直 PENDING，连核心技能都注册不了。技能注册只依赖 skills。
 *
 * 工作台（v0.4.0 起）：HTTP 路由与客户端面板都不写进 inject。路由由
 * mountWorkbench() 在 ctx.inject(['webServer'], …) 子作用域里注册；
 * 客户端面板走 package.json 的 exports["./client"] + dsh.client，由宿主
 * 的 __ModuleLoader__ 单独加载，与本文件完全解耦。任一缺失都只降级、不抛。
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkills } from './skill-loader.js';
import { mountWorkbench } from './server/workbench-service.mjs';
import { pluginVersion } from './version.mjs';

export const name = 'cineforge-skills';
export const inject = ['skills'];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = 'dsh-cineforge';

/** 读取宿主服务：兼容真机 Cordis Proxy 与自测用的普通对象 ctx。 */
function optionalService(ctx, name) {
  if (typeof ctx.get === 'function') {
    try { return ctx.get(name, false); } catch { return undefined; }
  }
  try { return ctx[name]; } catch { return undefined; }
}

function warn(ctx, detail) {
  const text = '[' + PLUGIN + '] ' + detail;
  const logger = optionalService(ctx, 'logger');
  if (logger && typeof logger.warn === 'function') logger.warn(text);
  else console.warn(text);
}

export function apply(ctx, config) {
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

  // 工作台服务端：失败不影响技能，只降级为「只有技能、没有面板」。
  let workbench = { mounted: false };
  try {
    workbench = mountWorkbench(ctx, {
      pluginRoot: ROOT,
      workspace: config && typeof config.workspace === 'string' ? config.workspace : '',
    });
  } catch (e) {
    warn(ctx, '工作台路由未能挂载（技能仍可用）：' + String((e && e.message) || e));
  }

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const remove of disposers.splice(0).reverse()) {
      try { remove(); } catch (e) { warn(ctx, '卸载失败：' + String(e)); }
    }
  };
  if (ctx.effect) ctx.effect(() => dispose);
  if (ctx.on) ctx.on('dispose', dispose);

  const skillsService = optionalService(ctx, 'skills');
  if (skillsService && typeof skillsService.register === 'function') {
    for (const def of definitions) {
      const remove = skillsService.register(def);
      if (typeof remove !== 'function') throw new Error('skills.register 未返回卸载函数。');
      disposers.push(remove);
    }
  } else if (skillsService && typeof skillsService.registerProvider === 'function') {
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
    const remove = skillsService.registerProvider(() => provider);
    if (typeof remove === 'function') disposers.push(remove);
  } else {
    dispose();
    throw new Error(PLUGIN + ' 需要宿主提供 skills.register 或 skills.registerProvider');
  }

  // 可选自检工具：tools 服务缺席时静默跳过，绝不影响技能注册（见文件头 inject 说明）。
  const toolsService = optionalService(ctx, 'tools');
  if (toolsService && typeof toolsService.register === 'function') {
    const health = async () => {
      const rows = [];
      for (const def of definitions) {
        let registered = false;
        let registryChecked = false;
        if (!disposed && skillsService && typeof skillsService.get === 'function') {
          try {
            const actual = await skillsService.get(def.name);
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
        version: pluginVersion(),
        skills: rows,
        workbench: {
          mounted: !!workbench.mounted,
          route_prefix: '/dsh-cineforge',
          workspace_root: (workbench.info && workbench.info.workspace_root) || '',
          workspace_source: (workbench.info && workbench.info.workspace_source) || '',
          projects_root: (workbench.info && workbench.info.projects_root) || '',
        },
        backend: 'hyperframes',
        shot_cards: 124,
        resource_base: ROOT,
      };
    };
    try {
      const remove = toolsService.register({
        name: 'cineforge_health',
        description: PLUGIN + ' 自检：核对 3 个导演技能的注册状态、宿主技能注册表一致性，以及工作台路由是否挂载。',
        parameters: { type: 'object', properties: {} },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render(_args, value) {
            const lines = [PLUGIN + ' 自检' + (value.ok ? '：技能资源完整且已注册。' : '：发现技能注册异常。')];
            for (const s of value.skills) {
              lines.push('- ' + s.name + '：' + (s.ok ? 'OK' : 'FAIL ' + s.detail) + ' [' + s.file + ']');
            }
            lines.push('- 工作台：' + (value.workbench && value.workbench.mounted ? '路由已挂载 ' + value.workbench.route_prefix : '未挂载（只有技能可用）'));
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
