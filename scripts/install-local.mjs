#!/usr/bin/env node
// CineForge 本机接线脚本：把 dsh-cineforge 装进指定 DSH profile。
// 幂等、可回滚、默认 dry-run；只有 --apply 才写文件。
//
// 用法（在插件根目录执行）：
//   node scripts/install-local.mjs status    [--profile-dir <dir>]
//   node scripts/install-local.mjs install --apply   [--profile-dir <dir>] [--spec <spec>]
//   node scripts/install-local.mjs uninstall --apply [--profile-dir <dir>]
//   node scripts/install-local.mjs verify   [--profile-dir <dir>]
//
// 说明：插件的 insert 行来自自身 cordis.patch.yml（package.json 的 dsh.bundle.patch），
// 由宿主在加载 bundle 时自动合并，不需要也不应该写进 profile 的 cordis.patch.yml。
// 本机开发用 link: 依赖（源码改动即时生效）；正式分发请用
//   dsh plugin --profile desktop add <npm 包名或 git URL>

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const NL = String.fromCharCode(10);
const BS = String.fromCharCode(92);
const fwd = (p) => p.split(BS).join("/");
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const cmd = argv.find((a) => ["status", "install", "uninstall", "verify"].includes(a)) || "status";
const apply = has("--apply");
const profile = val("--profile", "desktop");
const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(val("--plugin", path.resolve(here, "..")));
const profileDir = path.resolve(val("--profile-dir", path.join(os.homedir(), ".dsh", "profiles", profile)));
const pkgPath = path.join(profileDir, "package.json");
const spec = val("--spec", "link:" + fwd(pluginRoot));

if (!fs.existsSync(pkgPath)) {
  console.error("profile package.json not found: " + fwd(pkgPath));
  process.exit(2);
}
const readPkg = () => JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const writePkg = (pkg) => fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + NL, "utf8");
const backup = (tag) => {
  if (!apply) return "(dry-run, no backup written)";
  const dir = path.join(pluginRoot, ".local", "profile-backup");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().split(":").join("-").split(".").join("-");
  const dst = path.join(dir, profile + "-" + tag + "-" + stamp + ".json");
  fs.copyFileSync(pkgPath, dst);
  return dst;
};
const state = (pkg) => ({
  profile: path.basename(profileDir),
  profileDir: fwd(profileDir),
  pkgPath: fwd(pkgPath),
  pluginRoot: fwd(pluginRoot),
  dep_spec: (pkg.dependencies && pkg.dependencies["dsh-cineforge"]) || null,
  in_bundles: !!(pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles && pkg.dsh.profile.bundles.includes("dsh-cineforge")),
  installed_entry: fs.existsSync(path.join(profileDir, "node_modules", "dsh-cineforge", "lib", "index.js")),
  insert_source: "package.json dsh.bundle.patch -> ./cordis.patch.yml (auto-merged by host)",
});

if (cmd === "status" || cmd === "install" || cmd === "uninstall") {
  const pkg = readPkg();
  if (cmd === "install") {
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies["dsh-cineforge"] = spec;
    pkg.dsh = pkg.dsh || {};
    pkg.dsh.profile = pkg.dsh.profile || {};
    pkg.dsh.profile.bundles = pkg.dsh.profile.bundles || [];
    if (!pkg.dsh.profile.bundles.includes("dsh-cineforge")) pkg.dsh.profile.bundles.push("dsh-cineforge");
  } else if (cmd === "uninstall") {
    if (pkg.dependencies) delete pkg.dependencies["dsh-cineforge"];
    if (pkg.dsh && pkg.dsh.profile && Array.isArray(pkg.dsh.profile.bundles)) {
      pkg.dsh.profile.bundles = pkg.dsh.profile.bundles.filter((b) => b !== "dsh-cineforge");
    }
  }
  const label = apply ? "APPLY" : "DRY-RUN";
  console.log(label + " " + cmd + " -> " + fwd(pkgPath));
  console.log(JSON.stringify(state(pkg), null, 2));
  if (apply && cmd !== "status") {
    console.log("backup: " + backup("before-" + cmd));
    writePkg(pkg);
    console.log("written: " + fwd(pkgPath));
    console.log("next: reload the DSH profile (or restart DSH), then run: node scripts/install-local.mjs verify --profile-dir <dir>");
  }
} else if (cmd === "verify") {
  let base = path.join(profileDir, "node_modules", "dsh-cineforge");
  if (!fs.existsSync(path.join(base, "lib", "index.js"))) base = pluginRoot;
  const entry = path.join(base, "lib", "index.js");
  const mod = await import(pathToFileURL(entry).href);
  const registered = [];
  const toolDefs = [];
  const disposers = [];
  const ctx = {
    skills: { register: (def) => { registered.push(def); return () => {}; }, get: () => null },
    tools: { register: (def) => { toolDefs.push(def); return () => {}; } },
    effect: (fn) => { const d = fn(); if (typeof d === "function") disposers.push(d); },
    on: (ev, fn) => { if (ev === "dispose") disposers.push(fn); },
  };
  mod.apply(ctx);
  const names = ["cineforge-director", "cineforge-cards", "cineforge-qa"];
  const checks = [];
  const add = (name, ok) => checks.push({ name: name, ok: !!ok });
  add("apply is a function", typeof mod.apply === "function");
  add("name is cineforge-skills", mod.name === "cineforge-skills");
  add("inject includes skills", Array.isArray(mod.inject) && mod.inject.includes("skills"));
  add("exactly 3 skills registered", registered.length === 3);
  for (const n of names) {
    const d = registered.find((x) => x.name === n);
    add("registered " + n, !!d);
    if (d) {
      add(n + " has description", typeof d.description === "string" && d.description.length > 0);
      add(n + " has content", typeof d.content === "string" && d.content.length > 0);
      add(n + " definition name matches", d.name === n);
      add(n + " content excludes frontmatter", !d.content.startsWith("---"));
    }
  }
  const rb = registered[0] && registered[0].resourceBase;
  add("resourceBase kind is directory", !!rb && rb.kind === "directory");
  const root = rb ? rb.path : "";
  // link: installs resolve through a symlink; compare physical paths, not literal strings.
  const real = (p) => { try { return fwd(fs.realpathSync(p)); } catch { return fwd(p); } };
  add("resourceBase resolves to installed root", real(root) === real(base));
  for (const f of ["knowledge/storyboard.schema.json", "knowledge/shot-cards.json", "upstream/catalog.json", "skills/cineforge-qa/SKILL.md"]) {
    add("installed root has " + f, fs.existsSync(path.join(root, f.split("/").join(path.sep))));
  }
  add("cineforge_health tool registered", toolDefs.some((t) => t.name === "cineforge_health"));
  add("disposers wired", disposers.length > 0);
  const failed = checks.filter((c) => !c.ok);
  const out = {
    schema: "cineforge/install-verify/v1",
    imported_from: fwd(base),
    entry: fwd(entry),
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    ok: failed.length === 0,
    checks: checks,
    note: "真实 import 已安装位置的 lib/index.js，用 mock 宿主 ctx 验证 3 个技能与工具注册；不依赖运行中的 DSH 进程。",
  };
  const text = JSON.stringify(out, null, 2);
  console.log(text);
  try {
    const rep = path.join(pluginRoot, ".local", "install-verify.json");
    fs.mkdirSync(path.dirname(rep), { recursive: true });
    fs.writeFileSync(rep, text + "\n", "utf8");
    console.log("report: " + fwd(rep));
  } catch (e) { console.error("report write failed: " + e); }
  process.exitCode = out.ok ? 0 : 1;
} else {
  console.error("unknown command: " + cmd);
  process.exit(2);
}
