import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
for (const path of ["RemoteLauncher.js", ...readdirSync(resolve(root, "scripts")).filter(n => n.endsWith(".js")).map(n => "scripts/" + n)]) {
  new AsyncFunction(readFileSync(resolve(root, path), "utf8"));
}
console.log("入口及全部组件语法检查通过");
for (const script of ["tools/build.mjs", "tests/logic.test.mjs", "tests/runtime.test.mjs", "tests/launcher.test.mjs"]) {
  const args = script === "tools/build.mjs" ? [script, "--check"] : [script];
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
