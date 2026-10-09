import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { harness, plain, dataPath, parcel, cachePath } from "./helpers.mjs";

test("旧配置和旧备份兼容；背景文件路径、颜色和遮罩严格校验", () => {
  const L = harness().logic, old = plain(L.defaults()); delete old.background;
  assert.deepEqual(plain(L.validate("settings", old).background), plain(L.backgroundDefaults()));
  for (const changes of [{ mode: "remote" }, { dim: -1 }, { dim: 0.81 }, { dim: NaN }, { text: "auto" }, { photo: "../private.png" }, { transparent: { small: "https://photo.png", medium: null, large: null } }]) {
    assert.throws(() => L.validate("settings", { ...old, background: { ...plain(L.backgroundDefaults()), ...changes } }));
  }
});
test("内置尺寸自动裁剪：大号底部从中间起始，两种图标大小不混用", () => {
  const G = harness().geometry, size = { width: 1290, height: 2796 };
  assert.deepEqual(plain(G.rect(size, "large", 0, "text")), { x: 98, y: 252, width: 1092, height: 1146 });
  assert.deepEqual(plain(G.rect(size, "large", 1, "text")), { x: 98, y: 888, width: 1092, height: 1146 });
  assert.deepEqual(plain(G.rect(size, "large", 1, "notext")), { x: 75, y: 858, width: 1139, height: 1136 });
  assert.deepEqual(plain(G.rect({ width: 1170, height: 2532 }, "large", 0)), { x: 78, y: 231, width: 1014, height: 1062 });
  assert.deepEqual(plain(G.rect({ width: 1125, height: 2436 }, "small", 1, "mini")), { x: 591, y: 231, width: 465, height: 465 });
  assert.notEqual(G.rect({ width: 1125, height: 2436 }, "small", 1, "x").y, 231);
});
test("所有内置截图尺寸、布局和位置均满足裁剪边界；未知尺寸不猜测", () => {
  const h = harness(), G = h.geometry;
  const widths = {2868:1320,2796:1290,2622:1206,2556:1179,2436:1125,2079:960,1334:750,2778:1284,2688:1242,2532:1170,1792:828,1624:750,2208:1242,2001:1125,1136:640};
  for (const [height, width] of Object.entries(widths)) {
    const size = {width, height:Number(height)};
    for (const choice of G.options(size)) for (const family of ["small","medium","large"]) for (let position=0; position<(family==="small"?6:family==="medium"?3:2); position++) assert.ok(h.logic.cropRect(G.rect(size,family,position,choice.key),size));
  }
  assert.throws(()=>G.options({width:600,height:300}), /暂未适配/);
  assert.throws(()=>G.options({width:1000,height:2796}), /暂未适配/);
  assert.throws(()=>G.rect({width:1290,height:2796},"large",2,"text"), /位置无效/);
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
  let h = harness({ app: true, responses: [10, 0, 0, 0, 0, 0, -1, -1] }); await h.suite.run("dashboard");
  const initial = h.suite.read("settings").data.background.transparent.large;
  assert.ok(initial); assert.equal(h.drawings.length, 1); assert.equal(h.drawings[0].respectScreenScale, false);
  assert.deepEqual(plain(h.drawings[0].operations[0].point), { x: -78, y: -231 });
  assert.equal(h.webviews.length, 0); assert.equal(h.previews[0].family, "large"); assert.ok(h.previews[0].widget.backgroundImage);
  h = harness({ app: true, files: Object.fromEntries(h.files), responses: [10, 0, 0, 1, 1, 0, -1, -1] }); await h.suite.run("dashboard");
  assert.equal(h.previews[0].family, "medium"); assert.ok(h.rendered.backgroundImage);
  assert.equal(h.suite.read("settings").data.background.transparent.large, initial);
  assert.ok(h.suite.read("settings").data.background.transparent.medium);
  const widget = harness({ files: Object.fromEntries(h.files), family: "large" }); await widget.suite.run("dashboard"); assert.ok(widget.rendered.backgroundImage);
});
test("原生自动裁剪直接保存大号，两种图标布局立即预览，不依赖网页完成按钮", async () => {
  for (const choice of [0, 1]) {
    const h = harness({ app: true, image: {size:{width:1290,height:2796}}, responses: [10,0,0,0,1,choice,0,-1,-1] });
    await h.suite.run("dashboard");
    const bg = h.suite.read("settings").data.background;
    assert.equal(bg.mode, "transparent"); assert.ok(bg.transparent.large);
    assert.equal(h.webviews.length, 0); assert.equal(h.previews.length, 1);
    assert.equal(h.previews[0].family, "large"); assert.ok(h.previews[0].widget.backgroundImage);
    assert.deepEqual(plain(h.drawings[0].operations[0].point), choice ? {x:-75,y:-858} : {x:-98,y:-888});
    assert.ok(h.rendered.backgroundImage);
  }
});
test("静默丢失图片写入时不会提示保存成功，也不修改原配置", async () => {
  const h = harness({ app:true, dropImageWrite:true, responses:[10,0,0,0,0,0,-1] });
  await h.suite.run("dashboard");
  assert.equal(h.suite.read("settings").data.background.mode,"theme");
  assert.equal(h.dialogs.some(d=>d.title==="透明背景已保存并校验"),false);
  assert.equal(h.previews.length,0);
});
test("检查背景针对所选尺寸明确提示并预览，保留旧版已存透明图片", async () => {
  const settings=plain(harness().logic.defaults()); settings.background.mode="transparent"; settings.background.transparent.large="transparent-old.png";
  const files={ [dataPath("settings")]:JSON.stringify(settings), "/docs/scriptable-info-data/backgrounds/transparent-old.png":{size:{width:1014,height:1062}} };
  const h=harness({app:true,files,responses:[10,7,0,0,-1,-1]}); await h.suite.run("dashboard");
  assert.match(h.dialogs.find(d=>d.title==="背景检查").message,/可读取/); assert.ok(h.previews[0].widget.backgroundImage);
  const missing=harness({app:true,files,responses:[10,7,1,0,-1,-1]}); await missing.suite.run("dashboard");
  assert.match(missing.dialogs.find(d=>d.title==="背景检查").message,/设置中号背景/);
  assert.equal(missing.previews[0].widget.backgroundImage,undefined);
});
test("取消选图或布局选项不写入配置或图片", async () => {
  for (const options of [{ cancelPhoto: true, responses: [10, 1, -1, -1] }, { image: {size:{width:1290,height:2796}}, responses: [10, 0, 0, 0, 0, -1, -1, -1] }]) {
    const h = harness({ app: true, ...options }); await h.suite.run("dashboard");
    assert.equal(h.files.has(dataPath("settings")), false); assert.equal([...h.files.keys()].some(p => p.endsWith(".png")), false);
  }
});
test("裁剪无效和图片保存失败不覆盖旧背景或记录", async () => {
  for (const options of [{ image: {size:{width:600,height:300}}, responses: [10, 0, 0, 0, 0, 0, -1] }, { failWrite: path => path.endsWith(".png"), responses: [10, 1, 0, -1] }, { failWrite: path => path.endsWith("dashboard.json.pending"), responses: [10, 1, 0, -1] }]) {
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
