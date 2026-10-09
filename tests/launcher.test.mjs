import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { harness, dataPath, parcel, cachePath } from "./helpers.mjs";
const launcher = readFileSync(new URL("../RemoteLauncher.js", import.meta.url), "utf8");

test("入口发现、缓存及安装全部五个脚本，私有数据不被覆盖", async () => {
  const privateData = JSON.stringify({ version: 1, items: [parcel()] });
  const h = harness({ parameter: "dashboard|compact", files: { [dataPath("parcels")]: privateData } });
  await h.evaluate(launcher); assert.match(h.text(), /0956/);
  for (const name of ["countdown", "parcel-list", "train-tickets", "countdown-list", "dashboard"]) {
    assert.ok(h.files.has(`/docs/${name}.js`)); assert.ok(h.files.has(cachePath(name)));
  }
  assert.equal(h.files.get(dataPath("parcels")), privateData); assert.equal(h.dialogs.length, 0);
});
test("入口 iCloud 安装、返回列表后不执行远程脚本", async () => {
  const h = harness({ app: true, launcherPath: "/icloud/RemoteLauncher.js", responses: [-1] });
  await h.evaluate(launcher); assert.ok(h.files.has("/icloud/dashboard.js"));
  assert.equal(h.rendered, undefined); assert.ok(h.complete);
});
test("下载异常 HTML/JSON/语法错误时保留已校验缓存", async () => {
  for (const bad of ["<html>not code</html>", '{"message":"not found"}', "syntax !!!"]) {
    const old = readFileSync(new URL("../scripts/dashboard.js", import.meta.url), "utf8");
    const h = harness({ parameter: "dashboard", sources: { dashboard: bad }, files: { [cachePath("dashboard")]: old } });
    await h.evaluate(launcher); assert.equal(h.files.get(cachePath("dashboard")), old); assert.ok(h.rendered);
  }
});
test("首次目录请求失败可直接下载默认脚本；完全离线用缓存", async () => {
  const first = harness({ apiError: true }); await first.evaluate(launcher); assert.ok(first.rendered);
  const offline = harness({ offline: true, parameter: "dashboard", files: { [cachePath("dashboard")]: readFileSync(new URL("../scripts/dashboard.js", import.meta.url), "utf8") } });
  await offline.evaluate(launcher); assert.ok(offline.rendered); assert.equal(offline.dialogs.length, 0);
});
test("无缓存离线给出明确错误，不能执行异常缓存", async () => {
  const h = harness({ offline: true }); await assert.rejects(h.evaluate(launcher), /无法加载/);
  const bad = harness({ offline: true, parameter: "dashboard", files: { [cachePath("dashboard")]: '{"error":"bad"}' } });
  await assert.rejects(bad.evaluate(launcher), /JSON/);
});
test("模块点击转发 remoteScript 和 infoAction，保留旧倒计时参数", async () => {
  const h = harness({ app: true, query: { remoteScript: "dashboard|compact", infoAction: "parcels" }, responses: [0, -1] });
  await h.evaluate(launcher); assert.equal(h.dialogs.at(-1).title, "待取快递管理");
  const old = harness({ parameter: "countdown|生日", files: { [dataPath("countdowns")]: JSON.stringify({ events: [{ id: "a", name: "生日", date: "2099-01-01", text: "生日快乐" }], defaultId: "a" }) } });
  await old.evaluate(launcher); assert.match(old.text(), /生日快乐/);
});
test("入口不会覆盖自身同名脚本", async () => {
  const h = harness({ launcherPath: "/docs/dashboard.js", parameter: "dashboard", files: { "/docs/dashboard.js": "local launcher" } });
  await h.evaluate(launcher); assert.equal(h.files.get("/docs/dashboard.js"), "local launcher"); assert.ok(h.rendered);
});
test("目录 API 不通时从 Raw 清单发现新增 dashboard", async () => {
  const h = harness({ app: true, apiError: true, responses: [-1], files: {
    [cachePath("countdown")]: readFileSync(new URL("../scripts/countdown.js", import.meta.url), "utf8"),
  } });
  await h.evaluate(launcher);
  assert.ok(h.files.has("/docs/dashboard.js"));
  assert.match(h.dialogs[0].message, /已安装 5 个脚本/);
  assert.match(h.dialogs[0].message, /dashboard/);
  assert.match(h.dialogs[0].message, /备用清单/);
});
test("目录和清单均不可用时仍尝试安装当前版本的五个组件", async () => {
  const h = harness({ app: true, apiError: true, manifestError: true, responses: [-1] });
  await h.evaluate(launcher); assert.ok(h.files.has("/docs/dashboard.js"));
  assert.match(h.dialogs[0].message, /已安装 5 个脚本/);
});
test("无效清单不允许路径穿越，写入失败明确列出脚本", async () => {
  const h = harness({ app: true, apiError: true, manifest: { version: 1, scripts: ["../secret"] }, responses: [-1],
    failWrite: path => path === "/docs/dashboard.js" });
  await h.evaluate(launcher);
  assert.equal(h.files.has("/docs/dashboard.js"), false);
  assert.match(h.dialogs[0].message, /已安装 4 个脚本/);
  assert.match(h.dialogs[0].message, /安装失败：\ndashboard/);
  assert.equal(h.requests.some(url => url.includes("../secret")), false);
});
