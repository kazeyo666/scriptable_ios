import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { harness, dataPath, parcel, cachePath } from "./helpers.mjs";
const launcher = readFileSync(new URL("../入口.js", import.meta.url), "utf8");

test("入口发现、缓存及安装全部四个脚本，私有数据不被覆盖", async () => {
  const privateData = JSON.stringify({ version: 1, items: [parcel()] });
  const h = harness({ parameter: "信息面板|compact", files: { [dataPath("parcels")]: privateData } });
  await h.evaluate(launcher); assert.match(h.text(), /0956/);
  for (const name of ["倒计时", "快递", "火车票", "信息面板"]) {
    assert.ok(h.files.has(`/docs/${name}.js`)); assert.ok(h.files.has(cachePath(name)));
  }
  assert.equal(h.files.get(dataPath("parcels")), privateData); assert.equal(h.dialogs.length, 0);
});
test("入口 iCloud 安装、返回列表后不执行远程脚本", async () => {
  const h = harness({ app: true, launcherPath: "/icloud/入口.js", responses: [-1] });
  await h.evaluate(launcher); assert.ok(h.files.has("/icloud/信息面板.js"));
  assert.equal(h.rendered, undefined); assert.ok(h.complete);
});
test("下载异常 HTML/JSON/语法错误时保留已校验缓存", async () => {
  for (const bad of ["<html>not code</html>", '{"message":"not found"}', "syntax !!!"]) {
    const old = readFileSync(new URL("../scripts/信息面板.js", import.meta.url), "utf8");
    const h = harness({ parameter: "信息面板", sources: { 信息面板: bad }, files: { [cachePath("信息面板")]: old } });
    await h.evaluate(launcher); assert.equal(h.files.get(cachePath("信息面板")), old); assert.ok(h.rendered);
  }
});
test("首次目录请求失败可直接下载默认脚本；完全离线用缓存", async () => {
  const first = harness({ apiError: true }); await first.evaluate(launcher); assert.ok(first.rendered);
  const offline = harness({ offline: true, parameter: "信息面板", files: { [cachePath("信息面板")]: readFileSync(new URL("../scripts/信息面板.js", import.meta.url), "utf8") } });
  await offline.evaluate(launcher); assert.ok(offline.rendered); assert.equal(offline.dialogs.length, 0);
});
test("无缓存离线给出明确错误，不能执行异常缓存", async () => {
  const h = harness({ offline: true }); await assert.rejects(h.evaluate(launcher), /无法加载/);
  const bad = harness({ offline: true, parameter: "信息面板", files: { [cachePath("信息面板")]: '{"error":"bad"}' } });
  await assert.rejects(bad.evaluate(launcher), /JSON/);
});
test("模块点击转发 remoteScript 和 infoAction，保留旧倒计时参数", async () => {
  const h = harness({ app: true, query: { remoteScript: "信息面板|compact", infoAction: "parcels" }, responses: [0, -1] });
  await h.evaluate(launcher); assert.equal(h.dialogs.at(-1).title, "待取快递管理");
  const old = harness({ parameter: "倒计时|生日", files: { [dataPath("countdowns")]: JSON.stringify({ events: [{ id: "a", name: "生日", date: "2099-01-01", text: "生日快乐" }], defaultId: "a" }) } });
  await old.evaluate(launcher); assert.match(old.text(), /生日快乐/);
});
test("入口不会覆盖自身同名脚本", async () => {
  const h = harness({ launcherPath: "/docs/信息面板.js", parameter: "信息面板", files: { "/docs/信息面板.js": "local launcher" } });
  await h.evaluate(launcher); assert.equal(h.files.get("/docs/信息面板.js"), "local launcher"); assert.ok(h.rendered);
});
test("目录 API 不通时从 Raw 清单发现新增 信息面板", async () => {
  const h = harness({ app: true, apiError: true, responses: [-1], files: {
    [cachePath("倒计时")]: readFileSync(new URL("../scripts/倒计时.js", import.meta.url), "utf8"),
  } });
  await h.evaluate(launcher);
  assert.ok(h.files.has("/docs/信息面板.js"));
  assert.match(h.dialogs[0].message, /已安装 4 个脚本/);
  assert.match(h.dialogs[0].message, /信息面板/);
  assert.match(h.dialogs[0].message, /备用清单/);
});
test("目录和清单均不可用时仍尝试安装当前版本的四个组件", async () => {
  const h = harness({ app: true, apiError: true, manifestError: true, responses: [-1] });
  await h.evaluate(launcher); assert.ok(h.files.has("/docs/信息面板.js"));
  assert.match(h.dialogs[0].message, /已安装 4 个脚本/);
});
test("无效清单不允许路径穿越，写入失败明确列出脚本", async () => {
  const h = harness({ app: true, apiError: true, manifest: { version: 1, scripts: ["../secret"] }, responses: [-1],
    failWrite: path => path === "/docs/信息面板.js" });
  await h.evaluate(launcher);
  assert.equal(h.files.has("/docs/信息面板.js"), false);
  assert.match(h.dialogs[0].message, /已安装 3 个脚本/);
  assert.match(h.dialogs[0].message, /安装失败：\n信息面板/);
  assert.equal(h.requests.some(url => url.includes("../secret")), false);
});

test("中文脚本下载地址编码、入口参数和脚本清单均可使用", async () => {
  const h = harness({ parameter: "信息面板.js|compact" });
  await h.evaluate(launcher);
  assert.ok(h.requests.some(url => url.includes(`${encodeURIComponent("信息面板")}.js`)));
  assert.equal(new URL(h.rendered.url).searchParams.get("remoteScript"), "信息面板|compact");
  const manifest = JSON.parse(readFileSync(new URL("../scripts/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.scripts.sort(), ["倒计时", "信息面板", "快递", "火车票"].sort());
});
test("旧英文参数兼容中文脚本，旧英文离线缓存迁移但私人数据保留", async () => {
  for (const [oldName, newName] of Object.entries({ countdown: "倒计时", "countdown-list": "倒计时", "倒计时列表": "倒计时", "parcel-list": "快递", "train-tickets": "火车票", dashboard: "信息面板" })) {
    const source = readFileSync(new URL(`../scripts/${newName}.js`, import.meta.url), "utf8");
    const privateData = JSON.stringify({ events: [{ id: "a", name: "生日", date: "2099-01-01", text: "旧生日记录" }], defaultId: "a" });
    const h = harness({ offline: true, parameter: oldName === "countdown" ? "countdown|生日" : oldName,
      files: { [cachePath(oldName)]: source, [dataPath("countdowns")]: privateData } });
    await h.evaluate(launcher);
    assert.ok(h.rendered); assert.ok(h.files.has(`/docs/${newName}.js`));
    assert.equal(h.files.has(`/docs/${oldName}.js`), false);
    assert.equal(h.files.get(dataPath("countdowns")), privateData);
    assert.equal(h.requests.some(url => url.includes(`/scripts/${oldName}.js`)), false);
    if (oldName === "countdown") assert.match(h.text(), /旧生日记录/);
  }
});
test("中文名称同样拒绝路径穿越，损坏旧缓存不能迁移为可执行脚本", async () => {
  for (const parameter of ["../倒计时", "倒计时/其他", "倒计时%2f其他", "倒计时..", "倒计时\\其他"]) {
    const h = harness({ parameter });
    await assert.rejects(h.evaluate(launcher), /脚本名/);
    assert.equal(h.requests.length, 0);
  }
  const invalid = harness({ offline: true, parameter: "countdown", files: { [cachePath("countdown")]: '{"error":"bad"}' } });
  await assert.rejects(invalid.evaluate(launcher), /无法加载/);
  assert.equal(invalid.files.has(cachePath("倒计时")), false);
});


test("入口刷新跳过同步结果和选择菜单，直接显示最新组件预览", async () => {
  const h = harness({ app: true, query: { remoteScript: "倒计时", infoAction: "refresh", infoFamily: "medium" } });
  await h.evaluate(readFileSync(new URL("../入口.js", import.meta.url), "utf8"));
  assert.equal(h.dialogs.length, 0); assert.equal(h.previews.length, 1);
  assert.equal(h.previews[0].family, "medium"); assert.equal(h.complete, true);
});
