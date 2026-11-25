// 版本号单一真源：package.json。插件运行时与工作台 /health 都从这里取。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function pluginVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(HERE, "..", "package.json"), "utf8"));
    return String(pkg.version || "");
  } catch { return ""; }
}
