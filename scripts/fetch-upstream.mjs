#!/usr/bin/env node
/**
 * fetch-upstream.mjs —— 按 upstream/catalog.json 精确拉取上游快照。
 *
 * 本机（Windows / HJ）实测：git clone github.com:443 经常 Failed to connect，
 * 但 api.github.com 与 codeload.github.com 可达，故走 API 取 SHA → codeload tar.gz。
 *
 * 用法：
 *   node scripts/fetch-upstream.mjs                 # 拉全部（默认 video-shotcraft）
 *   node scripts/fetch-upstream.mjs --id video-shotcraft
 *   node scripts/fetch-upstream.mjs --out /abs/dir  # 指定解压目录
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const wantId = getArg('--id', null);
const outDir = getArg('--out', join(ROOT, 'upstream', '_cache'));

const catalog = JSON.parse(readFileSync(join(ROOT, 'upstream', 'catalog.json'), 'utf8'));
const UA = { 'User-Agent': 'cineforge-upstream-fetch', 'Accept': 'application/vnd.github+json' };

async function apiJSON(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`GitHub API ${r.status} for ${url}`);
  return r.json();
}

async function fetchEntry(e) {
  const [, owner, repo] = e.url.match(/github\.com\/([^/]+)\/([^/]+)/) || [];
  if (!owner || !repo) { console.log(`[skip] ${e.id}: 非 GitHub 条目`); return; }
  const sha = e.pinned_sha || (await apiJSON(`https://api.github.com/repos/${owner}/${repo}/commits/main`)).sha;
  const dest = join(outDir, `${e.id}-${sha.slice(0, 12)}`);
  if (existsSync(dest)) { console.log(`[ok] ${e.id} 已存在 ${dest}`); return dest; }

  console.log(`[get] ${e.id}@${sha} ...`);
  const r = await fetch(`https://codeload.github.com/${owner}/${repo}/tar.gz/${sha}`, { headers: UA });
  if (!r.ok) throw new Error(`codeload ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  mkdirSync(outDir, { recursive: true });
  const tgz = join(tmpdir(), `cineforge-${e.id}-${sha.slice(0,7)}.tar.gz`);
  writeFileSync(tgz, buf);
  console.log(`[got] ${(buf.length / 1048576).toFixed(1)} MB`);

  mkdirSync(dest, { recursive: true });
  execFileSync('tar', ['-xzf', tgz, '-C', dest, '--strip-components=1'], { stdio: 'inherit' });
  console.log(`[extracted] ${dest}`);
  return dest;
}

for (const e of catalog.entries) {
  if (wantId && e.id !== wantId) continue;
  if (!e.url.startsWith('https://github.com/')) continue;
  try { await fetchEntry(e); }
  catch (err) { console.error(`[FAIL] ${e.id}: ${err.message}`); process.exitCode = 1; }
}
