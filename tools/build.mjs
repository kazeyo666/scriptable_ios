import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const body = ["src/logic.js", "src/runtime.js"].map(path => readFileSync(resolve(root, path), "utf8")).join("\n");
const scripts = { "parcel-list": "parcels", "train-tickets": "trains", "countdown-list": "countdowns", dashboard: "dashboard" };
const check = process.argv.includes("--check");
for (const [name, kind] of Object.entries(scripts)) {
  const source = `// Variables used by Scriptable.\n// icon-color: blue; icon-glyph: th-large;\n\n// 由 tools/build.mjs 生成；请修改 src/ 后重新生成。独立运行，无外部模块依赖。\n${body}\nawait createInfoSuite().run(${JSON.stringify(kind)});\n`;
  new (Object.getPrototypeOf(async function () {}).constructor)(source);
  const target = resolve(root, "scripts", name + ".js");
  if (check) {
    if (readFileSync(target, "utf8") !== source) throw new Error(`需要重新生成 ${name}.js`);
  } else writeFileSync(target, source);
}
console.log(check ? "独立脚本与源码一致，语法检查通过" : "已生成四个独立 Scriptable 脚本");
