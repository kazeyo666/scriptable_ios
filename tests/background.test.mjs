import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { harness, plain, dataPath, parcel, cachePath } from "./helpers.mjs";

test("旧配置和旧备份兼容；背景文件路径、颜色和遮罩严格校验", () => {
  const L = harness().logic, old = plain(L.defaults()); delete old.background;
  assert.deepEqual(plain(L.validate("settings", old).background), plain(L.backgroundDefaults()));
  for (const changes of [{ mode: "remote" }, { dim: -1 }, { dim: 0.81 }, { dim: NaN }, { text: "auto" }, { photo: "../private.png" }, { transparent: { small: "https://photo.png", medium: null, large: null } }]) {
    assert.throws(() => L.validate("settings", { ...old, background: { ...plain(L.backgroundDefaults()), ...changes } }));
  }
});
test("裁剪边界拒绝负数、非整数、溢出；三尺寸初始框适应多种截图", () => {
  const L = harness().logic;
  for (const size of [{ width: 1170, height: 2532 }, { width: 1290, height: 2796 }, { width: 640, height: 1136 }, { width: 600, height: 300 }]) {
    for (const family of ["small", "medium", "large"]) for (let i = 0; i < (family === "small" ? 6 : 3); i++) assert.ok(L.cropRect(L.cropSuggestion(size, family, i), size));
  }
  for (const rect of [{ x: -1, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 0, height: 10 }, { x: 100, y: 0, width: 10, height: 10 }, { x: 0.1, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: NaN, height: 10 }]) assert.throws(() => L.cropRect(rect, { width: 100, height: 100 }));
});
test("实际裁剪页面脚本：拖动、边界、输入、确认和确认后修改作废", () => {
  const h = harness(), html = h.cropHTML("aW1hZ2U=", { width: 1000, height: 2000 }, { x: 100, y: 200, width: 400, height: 400 });
  assert.match(html, /default-src 'none'/); assert.doesNotMatch(html, /https?:\/\//);
  const elements = new Map();
  for (const id of ["stage", "frame", "handle", "message", "save", "x", "y", "width", "height"]) elements.set(id, { style: {}, value: "", events: {}, addEventListener(event, fn) { this.events[event] = fn; }, setPointerCapture() {}, getBoundingClientRect: () => ({ width: 250 }) });
  const context = vm.createContext({ window: {}, document: { getElementById: id => elements.get(id) } });
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
  const frame = elements.get("frame"), handle = elements.get("handle");
  frame.events.pointerdown({ preventDefault() {}, target: frame, clientX: 0, clientY: 0, pointerId: 1 });
  frame.events.pointermove({ clientX: 1000, clientY: 1000 }); frame.events.pointerup();
  elements.get("save").events.click(); assert.deepEqual(plain(context.window.cropResult), { x: 600, y: 1600, width: 400, height: 400 });
  elements.get("x").value = "10"; elements.get("x").events.change(); assert.equal(context.window.cropResult, null);
  frame.events.pointerdown({ preventDefault() {}, target: handle, clientX: 0, clientY: 0, pointerId: 2 }); frame.events.pointermove({ clientX: 500, clientY: -500 });
  elements.get("save").events.click(); assert.deepEqual(plain(context.window.cropResult), { x: 10, y: 1600, width: 990, height: 1 });
  assert.throws(() => h.cropHTML('" onload="bad', { width: 100, height: 100 }, { x: 0, y: 0, width: 10, height: 10 }));
});
test("相册设置一次生成三个背景，Widget 离线直接读取且不覆盖数据", async () => {
  const h = harness({ app: true, files: { [dataPath("parcels")]: JSON.stringify({ version: 1, items: [parcel()] }) }, responses: [10, 1, 0, -1, -1] });
  await h.suite.run("dashboard");
  const settings = h.suite.read("settings").data; assert.equal(settings.background.mode, "photo");
  assert.equal([...h.files.keys()].filter(p => p.endsWith(".png")).length, 4);
  assert.equal(h.suite.read("parcels").data.items[0].code, "0956");
  for (const family of ["small", "medium", "large"]) {
    const widget = harness({ files: Object.fromEntries(h.files), family, offline: true }); await widget.suite.run("dashboard");
    assert.ok(widget.rendered.backgroundImage); assert.equal(widget.drawings.length, 0); assert.equal(widget.webviews.length, 0); assert.equal(widget.dialogs.length, 0); assert.equal(widget.requests.length, 0);
    assert.equal(widget.nodes.flatMap(n => n.children).find(n => n.kind === "text").textColor.value, "#FFFFFF");
  }
});
test("透明截图按尺寸保存，原像素裁剪不加遮罩且其他尺寸的背景保留", async () => {
  const rect = { x: 78, y: 231, width: 1014, height: 1062 };
  let h = harness({ app: true, cropResult: rect, responses: [10, 0, 0, 0, 0, 0, -1, -1] }); await h.suite.run("dashboard");
  const initial = h.suite.read("settings").data.background.transparent.large;
  assert.ok(initial); assert.equal(h.drawings.length, 1); assert.equal(h.drawings[0].respectScreenScale, false);
  assert.deepEqual(plain(h.drawings[0].operations[0].point), { x: -78, y: -231 });
  assert.equal(h.webviews[0].shouldAllowRequest({ url: "https://example.com" }), false);
  h = harness({ app: true, files: Object.fromEntries(h.files), cropResult: { x: 78, y: 819, width: 1014, height: 474 }, responses: [10, 0, 0, 1, 1, 0, -1, -1] }); await h.suite.run("dashboard");
  assert.equal(h.suite.read("settings").data.background.transparent.large, initial);
  assert.ok(h.suite.read("settings").data.background.transparent.medium);
  const widget = harness({ files: Object.fromEntries(h.files), family: "large" }); await widget.suite.run("dashboard"); assert.ok(widget.rendered.backgroundImage);
});
test("取消选图或未确认裁剪不写入配置或图片", async () => {
  for (const options of [{ cancelPhoto: true, responses: [10, 1, -1, -1] }, { responses: [10, 0, 0, 0, 0, -1, -1] }]) {
    const h = harness({ app: true, ...options }); await h.suite.run("dashboard");
    assert.equal(h.files.has(dataPath("settings")), false); assert.equal([...h.files.keys()].some(p => p.endsWith(".png")), false);
  }
});
test("裁剪无效和图片保存失败不覆盖旧背景或记录", async () => {
  for (const options of [{ cropResult: { x: -1, y: 0, width: 10, height: 10 }, responses: [10, 0, 0, 0, 0, 0, -1] }, { failWrite: path => path.endsWith(".png"), responses: [10, 1, 0, -1] }, { failWrite: path => path.endsWith("dashboard.json.pending"), responses: [10, 1, 0, -1] }]) {
    const h = harness({ app: true, ...options }); await h.suite.run("dashboard");
    assert.equal(h.suite.read("settings").data.background.mode, "theme"); assert.equal([...h.files.keys()].some(p => p.endsWith(".png")), false);
  }
});
test("图片丢失、损坏或未设置当前尺寸时回退主题并提示，不中断模块", async () => {
  for (const mode of ["photo", "transparent"]) for (const imageError of [false, true]) {
    const seed = harness(), settings = plain(seed.logic.defaults()); settings.background.mode = mode; settings.background.photo = "photo-test.png";
    const h = harness({ imageError, files: { [dataPath("settings")]: JSON.stringify(settings), [dataPath("parcels")]: JSON.stringify({ version: 1, items: [parcel()] }), ...(imageError ? { "/docs/scriptable-info-data/backgrounds/photo-test-large.png": { size: { width: 900, height: 940 } } } : {}) } });
    await h.suite.run("dashboard"); assert.equal(h.rendered.backgroundImage, undefined); assert.match(h.text(), /背景/); assert.match(h.text(), /0956/); assert.equal(h.dialogs.length, 0);
  }
});
test("文字颜色、遮罩与恢复主题菜单保存，恢复主题不删除本地图片", async () => {
  const h = harness({ app: true, responses: [10, 1, 0, 2, 1, 3, { action: 0, fields: ["40"] }, -1, -1] });
  await h.suite.run("dashboard"); const settings = h.suite.read("settings").data;
  assert.equal(settings.background.text, "dark"); assert.equal(settings.background.dim, 0.4);
  const widget = h.suite.render("dashboard", "large");
  assert.ok(widget.backgroundImage); assert.equal(widget.backgroundImage.operations.at(-1).color.alpha, 0.4);
  const texts = h.nodes.flatMap(n => n.children).filter(n => n.kind === "text"); assert.equal(texts.at(-1).textColor.value, "#17212B");
  const restore = harness({ app: true, files: Object.fromEntries(h.files), responses: [10, 4, -1, -1] }); await restore.suite.run("dashboard");
  assert.equal(restore.suite.read("settings").data.background.mode, "theme"); assert.equal(restore.rendered.backgroundImage, undefined);
  assert.equal([...restore.files.keys()].filter(p => p.endsWith(".png")).length, 8);
});
test("远程更新保留背景 PNG 与配置，恢复旧 JSON 备份仍兼容", async () => {
  const h = harness({ app: true, responses: [10, 1, 0, -1, -1] }); await h.suite.run("dashboard");
  const before = new Map([...h.files].filter(([p]) => p.endsWith(".png") || p === dataPath("settings")));
  const updated = harness({ app: true, files: { ...Object.fromEntries(h.files), [cachePath("dashboard")]: readFileSync(new URL("../scripts/dashboard.js", import.meta.url), "utf8") }, responses: [-1] });
  await updated.evaluate(readFileSync(new URL("../RemoteLauncher.js", import.meta.url), "utf8"));
  for (const [path, value] of before) assert.deepEqual(updated.files.get(path), value);
  const backup = plain(h.suite.backupObject()); delete backup.data.settings.background;
  const restored = harness(); restored.suite.restoreBackup(backup); assert.equal(restored.suite.read("settings").data.background.mode, "theme");
});
