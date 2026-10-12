import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { harness, dataPath, parcel } from "./helpers.mjs";
const settingKey = "kazeyo-pdd-pickup-read-config-v1";
const settings = { base: "https://example.workers.dev", token: "test-read-token+&" };
const configured = { [settingKey]: JSON.stringify(settings) };
const payload = { packages: [{ company: "多多买菜", code: "0076" }, { company: "圆通", code: "1-2-3456" }], updatedAt: "2026-10-12T01:05:00Z" };
const cachePath = "/docs/scriptable-info-data/pdd-pickup-cache.json";
const action = action => ({ action });

test("未配置时快递沿用手动记录，不请求网络、不强制配置", async () => {
  const h = harness(); h.suite.write("parcels", { version: 1, items: [parcel()] });
  await h.suite.run("parcels"); assert.match(h.text(), /0956/); assert.equal(h.requests.length, 0); assert.equal(h.dialogs.length, 0);
});
test("快递和面板自动复用已保存配置，Worker取件码与手动快递一起显示", async () => {
  for (const kind of ["parcels", "dashboard"]) {
    const h = harness({ keychain: configured, pickupResponse: payload });
    h.suite.write("parcels", { version: 1, items: [parcel()] });
    const original = h.files.get(dataPath("parcels"));
    await h.evaluate(readFileSync(new URL(`../scripts/${kind === "parcels" ? "快递" : "信息面板"}.js`, import.meta.url), "utf8"));
    assert.match(h.text(), /0076/); assert.match(h.text(), /1-2-3456/); assert.match(h.text(), /0956/);
    const snapshot = harness({ keychain: configured, files: Object.fromEntries(h.files) });
    assert.equal(snapshot.suite.section("parcels", snapshot.logic.defaults()).count, 3);
    assert.equal(h.requests.length, 1); assert.equal(h.requests[0], settings.base + "/api/latest?key=" + encodeURIComponent(settings.token));
    assert.equal(h.files.get(dataPath("parcels")), original); assert.equal(h.keychain.get(settingKey), configured[settingKey]);
    assert.doesNotMatch(h.files.get(cachePath), /test-read-token|https:/);
  }
});
test("相同公司和取件码去重并沿用本地驿站，不把已取手动包裹展示出来", async () => {
  const h = harness({ keychain: configured, pickupResponse: { packages: [...payload.packages, payload.packages[0]] } });
  h.suite.write("parcels", { version: 1, items: [parcel("same", { company: "多多买菜", code: "0076", station: "北门" }), parcel("collected", { status: "collected", code: "8888" })] });
  await h.suite.run("parcels"); assert.equal(h.suite.section("parcels", h.logic.defaults()).count, 2);
  assert.equal((h.text().match(/0076/g) || []).length, 1); assert.match(h.text(), /北门/); assert.doesNotMatch(h.text(), /8888/);
});
test("Worker空数组清除远程待取，不删除手动记录", async () => {
  const h = harness({ keychain: configured, pickupResponse: payload }); h.suite.write("parcels", { version: 1, items: [parcel()] });
  await h.suite.pickup.refresh(); assert.equal(h.suite.pickup.snapshot().packages.length, 2);
  const next = harness({ files: Object.fromEntries(h.files), keychain: configured, pickupResponse: { packages: [] } });
  await next.suite.run("parcels"); assert.match(next.text(), /0956/); assert.doesNotMatch(next.text(), /0076/);
  assert.equal(next.suite.section("parcels", next.logic.defaults()).count, 1);
});
test("断网、HTTP和结构错误时隐藏旧远程码，但保留手动快递及错误提示", async () => {
  const first = harness({ keychain: configured, pickupResponse: payload }); await first.suite.pickup.refresh();
  first.suite.write("parcels", { version: 1, items: [parcel()] });
  for (const options of [{ offline: true }, { status: 403, pickupResponse: payload }, { pickupResponse: { error: settings.token } }, { pickupResponse: { packages: [null] } }, { pickupResponse: { packages: [{ code: "" }] } }]) {
    const h = harness({ keychain: configured, files: Object.fromEntries(first.files), ...options }); await h.suite.run("parcels");
    assert.match(h.text(), /多多买菜读取/); assert.match(h.text(), /0956/); assert.doesNotMatch(h.text(), /0076|test-read-token/);
    assert.equal(h.files.has(cachePath), false);
  }
});
test("在快递页面直接配置连接，取消不写入，保存后即可合并显示", async () => {
  const h = harness({ app: true, pickupResponse: payload, responses: [action("多多买菜连接设置"), { action: 0, fields: [settings.base + "/", settings.token] }, -1] });
  await h.suite.run("parcels"); assert.deepEqual(JSON.parse(h.keychain.get(settingKey)), settings); assert.match(h.text(), /0076/);
  const cancelled = harness({ app: true, responses: [action("多多买菜连接设置"), -1, -1] });
  await cancelled.suite.run("parcels"); assert.equal(cancelled.keychain.size, 0); assert.equal(cancelled.requests.length, 0);
});
test("非法地址可重新填写，修改地址时令牌留空可沿用", async () => {
  const h = harness({ app: true, keychain: configured, pickupResponse: payload, responses: [action("多多买菜连接设置"), { action: 0, fields: ["http://example.test/?key=secret", ""] }, 0, { action: 0, fields: ["https://new.workers.dev/", ""] }, -1] });
  await h.suite.run("parcels"); assert.equal(JSON.parse(h.keychain.get(settingKey)).token, settings.token);
  assert.match(h.requests.at(-1), /^https:\/\/new.workers.dev\/api\/latest/);
  assert.doesNotMatch(h.dialogs.find(d => d.title === "请检查连接设置").message, /secret/);
});
for (const kind of ["parcels", "dashboard"]) {
  test(`${kind} 刷新按钮重新抓取并展示远程码，不进入管理菜单`, async () => {
    const h = harness({ app: true, keychain: configured, pickupResponse: payload, query: { infoAction: "refresh", infoFamily: "medium" } });
    await h.suite.run(kind); assert.match(h.text(), /0076/); assert.equal(h.requests.length, 1);
    assert.equal(h.dialogs.length, 0); assert.equal(h.previews[0].family, "medium");
  });
}
test("快递管理页可刷新预览，多多买菜未配置不影响其他菜单", async () => {
  const h = harness({ app: true, keychain: configured, pickupResponse: payload, responses: [action("刷新取件码"), -1] });
  await h.suite.run("parcels"); assert.equal(h.requests.length, 2); assert.equal(h.previews.length, 1); assert.match(h.text(), /0076/);
  assert.match(h.dialogs.at(-1).message, /多多买菜.*0076/);
});
test("不启用快递的面板和其他独立组件不请求Worker", async () => {
  for (const kind of ["countdowns", "trains", "dashboard"]) {
    const h = harness({ keychain: configured, pickupResponse: payload });
    if (kind === "dashboard") { const settings = h.logic.defaults(); settings.profiles.default.modules.find(m => m.id === "parcels").enabled = false; h.suite.write("settings", settings); }
    await h.suite.run(kind); assert.equal(h.requests.length, 0);
  }
});
test("最近缓存可供其他页面预览快递，过期缓存不显示旧码，备份不包含远程数据及令牌", async () => {
  const h = harness({ keychain: configured, pickupResponse: payload }); await h.suite.pickup.refresh();
  const recent = harness({ keychain: configured, files: Object.fromEntries(h.files) });
  assert.equal(recent.suite.section("parcels", recent.logic.defaults()).count, 2);
  assert.doesNotMatch(JSON.stringify(recent.suite.backupObject()), /0076|test-read-token/);
  const cached = JSON.parse(h.files.get(cachePath)); cached.fetchedAt = "2000-01-01T00:00:00Z";
  const expired = harness({ keychain: configured, files: { [cachePath]: JSON.stringify(cached) } });
  assert.equal(expired.suite.section("parcels", expired.logic.defaults()).count, 0); assert.match(expired.suite.pickup.snapshot().warning, /过期/);
});
test("字符串JSON和数字取件码可读，前导零保持不变", async () => {
  const h = harness({ keychain: configured, pickupResponse: JSON.stringify({ packages: [{ company: "买菜", code: "0076" }, { code: 1234 }] }) });
  await h.suite.run("parcels"); assert.match(h.text(), /0076/); assert.match(h.text(), /1234/);
});
test("Worker拒绝默认请求头时使用已验证请求头，钥匙串仍拒绝保留前缀", async () => {
  const h = harness({ keychain: configured });
  for (const method of ["contains", "get", "set"]) assert.throws(() => h.context.Keychain[method]("scriptable-reserved", "x"), /reserved/);
  h.context.Request = class {
    constructor() { this.response = { statusCode: 403 }; }
    async loadJSON() { if (this.headers?.Accept !== "application/json" || this.headers?.["User-Agent"] !== "Scriptable-Pickup-Check/1.0") throw Error("rejected"); this.response.statusCode = 200; return payload; }
  };
  await h.suite.run("parcels"); assert.match(h.text(), /0076/);
});
test("旧多多买菜入口自动转到快递组件，复用原来的手机配置", async () => {
  const h = harness({ parameter: "多多买菜取件码", keychain: configured, pickupResponse: payload });
  await h.evaluate(readFileSync(new URL("../入口.js", import.meta.url), "utf8"));
  assert.ok(h.files.has("/docs/快递.js")); assert.equal(h.files.has("/docs/多多买菜取件码.js"), false);
  assert.match(h.text(), /0076/); assert.equal(h.keychain.get(settingKey), configured[settingKey]);
});
