import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { harness, estimatedHeight } from "./helpers.mjs";
const source = readFileSync(new URL("../scripts/多多买菜取件码.js", import.meta.url), "utf8");
const settingKey = "scriptable-pdd-pickup-read-config-v1";
const settings = { base: "https://example.workers.dev", token: "test-read-token+&" };
const configured = { [settingKey]: JSON.stringify(settings) };
const payload = { packages: [{ company: "多多买菜", code: "0076" }, { company: "驿站", code: 1234 }], updatedAt: "2026-10-12T01:05:00Z" };

test("未配置组件只提示先运行，不请求网络或弹窗", async () => {
  const h = harness(); await h.evaluate(source);
  assert.match(h.text(), /未配置/); assert.equal(h.requests.length, 0); assert.equal(h.dialogs.length, 0);
});
test("首次填写连接信息到钥匙串，GET读取编码令牌并展示取件码", async () => {
  const h = harness({ app: true, responses: [{ action: 0, fields: [settings.base + "/", settings.token] }], pickupResponse: payload });
  await h.evaluate(source);
  assert.deepEqual(JSON.parse(h.keychain.get(settingKey)), settings);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0], settings.base + "/api/latest?key=" + encodeURIComponent(settings.token));
  assert.match(h.text(), /0076/); assert.match(h.text(), /1234/); assert.match(h.text(), /2 件待取/); assert.match(h.text(), /数据更新/);
  assert.doesNotMatch(h.text(), /test-read-token/); assert.equal(h.files.size, 0); assert.equal(h.previews.length, 1);
});
test("首次配置取消不保存、不请求网络、不展示旧数据", async () => {
  const h = harness({ app: true, responses: [-1] }); await h.evaluate(source);
  assert.equal(h.keychain.size, 0); assert.equal(h.requests.length, 0); assert.equal(h.rendered, undefined); assert.ok(h.complete);
});
test("地址必须是HTTPS根地址，错误后可重新填写", async () => {
  const h = harness({ app: true, responses: [{ action: 0, fields: ["http://example.test/?key=secret", "x"] }, 0, { action: 0, fields: [settings.base, settings.token] }] });
  await h.evaluate(source); assert.equal(h.requests.length, 1); assert.equal(h.dialogs[1].title, "请检查连接设置");
  assert.doesNotMatch(h.dialogs[1].message, /secret/);
});
test("修改地址时令牌留空可沿用，取消保留现有配置", async () => {
  const h = harness({ app: true, keychain: configured, query: { infoAction: "pickup-settings" }, responses: [{ action: 0, fields: ["https://new.workers.dev/", ""] }] });
  await h.evaluate(source); assert.equal(JSON.parse(h.keychain.get(settingKey)).token, settings.token);
  assert.match(h.requests[0], /^https:\/\/new.workers.dev\/api\/latest/);
  const cancelled = harness({ app: true, keychain: configured, query: { infoAction: "pickup-settings" }, responses: [-1] });
  await cancelled.evaluate(source); assert.equal(cancelled.keychain.get(settingKey), configured[settingKey]); assert.equal(cancelled.requests.length, 0);
});
for (const family of ["small", "medium", "large"]) {
  test(`${family} 显示有数量上限且刷新保留尺寸，入口参数不含令牌`, async () => {
    const data = { updatedAt: payload.updatedAt, packages: Array.from({ length: 10 }, (_, i) => ({ company: "多多买菜", code: `00${i}` })) };
    const h = harness({ family, keychain: configured, pickupResponse: data }); await h.evaluate(source);
    const codes = h.text().match(/^00\d$/gm) || []; assert.equal(codes.length, { small: 2, medium: 2, large: 6 }[family]);
    assert.match(h.text(), /另有/);
    assert.ok(estimatedHeight(h.rendered) <= { small: 155, medium: 155, large: 329 }[family]);
    const button = h.nodes.flatMap(n => n.children).find(n => n.value === "刷新");
    const url = new URL(family === "small" ? h.rendered.url : button.url);
    assert.equal(url.searchParams.get("remoteScript"), "多多买菜取件码");
    assert.equal(url.searchParams.get("infoAction"), "refresh"); assert.equal(url.searchParams.get("infoFamily"), family);
    assert.doesNotMatch(url.href, /test-read-token/);
    const clicked = harness({ app: true, query: Object.fromEntries(url.searchParams), keychain: configured, pickupResponse: payload });
    await clicked.evaluate(source); assert.equal(clicked.dialogs.length, 0); assert.equal(clicked.previews[0].family, family); assert.match(clicked.text(), /0076/);
    assert.ok(clicked.rendered.refreshAfterDate.getTime() <= Date.now());
  });
}
test("空数组显示暂无待取，非法更新时间不显示Invalid Date", async () => {
  const h = harness({ keychain: configured, pickupResponse: { packages: [], updatedAt: "invalid" } });
  await h.evaluate(source); assert.match(h.text(), /暂无待取包裹/); assert.doesNotMatch(h.text(), /Invalid|数据更新/);
});
test("网络、HTTP、字段异常明确失败，不将异常响应或令牌展示为取件码", async () => {
  for (const options of [{ offline: true }, { status: 403, pickupResponse: payload }, { pickupResponse: { error: settings.token } }, { pickupResponse: { packages: [null] } }, { pickupResponse: { packages: [{ code: "" }] } }]) {
    const h = harness({ keychain: configured, ...options }); await h.evaluate(source);
    assert.match(h.text(), /连接失败/); assert.match(h.text(), /读取失败|读取被拒绝/); assert.doesNotMatch(h.text(), /test-read-token|0076/);
  }
});
test("字符串JSON响应也可显示，不改变取件码前导零", async () => {
  const h = harness({ keychain: configured, pickupResponse: JSON.stringify(payload) }); await h.evaluate(source); assert.match(h.text(), /0076/);
});
test("入口能安装和执行多多买菜取件码且保留钥匙串配置", async () => {
  const h = harness({ parameter: "多多买菜取件码", keychain: configured, pickupResponse: payload });
  await h.evaluate(readFileSync(new URL("../入口.js", import.meta.url), "utf8"));
  assert.ok(h.files.has("/docs/多多买菜取件码.js")); assert.match(h.text(), /0076/);
  assert.equal(h.keychain.get(settingKey), configured[settingKey]);
});
