import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../QuantumultX/多多买菜自动刷新.js", import.meta.url), "utf8");
const page = groups => `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { serverData: [{ key: "queryStationPackageInfo", res: { result: { combine_list: groups } } }] } } })}</script>`;
async function run(options = {}) {
  const prefs = new Map(Object.entries({ pdd_pickup_worker_url: "https://example.workers.dev/", pdd_pickup_write_token: "test-upload-token",
    pdd_pickup_request_v1: JSON.stringify({ headers: { Cookie: "test-cookie" } }),
    pdd_pickup_latest: JSON.stringify({ packages: [{ company: "旧快递", code: "OLD" }] }), ...options.prefs }));
  const requests = [], logs = [], notifications = []; let done = 0;
  const result = vm.runInNewContext(source, { $environment: { variables: options.variables || {} }, console: { log: message => logs.push(message) },
    $prefs: { valueForKey: key => prefs.get(key), setValueForKey: (value, key) => prefs.set(key, value) },
    $done: () => done++, $notify: (...args) => notifications.push(args),
    $task: { fetch: async request => {
      requests.push(request);
      if (request.method === "POST") { if (options.uploadError) throw Error("test-upload-token"); return { statusCode: options.uploadStatus || 200 }; }
      if (options.fetchError) throw Error("test-cookie");
      return { statusCode: options.status || 200, body: options.body ?? page([]) };
    } },
  });
  await result; return { prefs, requests, logs, notifications, done };
}
test("正常解析取件码去重、保留前导零并覆盖Worker", async () => {
  const h = await run({ body: page([{ combine_track_list: [{ pick_code: "取件码：0076", shipping_name: "圆通" }, { pick_code: "0076", shipping_name: "圆通" }] }]) });
  assert.deepEqual(JSON.parse(h.requests.at(-1).body), { packages: [{ company: "圆通", code: "0076" }] });
  assert.equal(h.done, 1); assert.match(h.logs[0], /2026-10-13-v4/); assert.doesNotMatch(h.logs.join("\n"), /test-cookie|test-upload-token/);
});
for (const [name, options] of Object.entries({ empty: {}, missing_groups: { body: page(undefined) }, null_groups: { body: page(null) }, empty_tracks: { body: page([{ combine_track_list: [] }]) } })) {
  test(`${name} 成功查询已无包裹时上传空列表`, async () => {
    const h = await run(options); assert.deepEqual(JSON.parse(h.requests.at(-1).body), { packages: [] });
    assert.deepEqual(JSON.parse(h.prefs.get("pdd_pickup_latest")).packages, []); assert.equal(h.done, 1);
    assert.match(h.logs.join("\n"), /已清空Worker/);
  });
}
for (const [name, options] of Object.entries({ missing_next: { body: "<html>login</html>" }, bad_json: { body: '<script id="__NEXT_DATA__">broken</script>' }, http_error: { status: 401 }, network_error: { fetchError: true }, no_headers: { prefs: { pdd_pickup_request_v1: "{}" } }, no_codes: { body: page([{ combine_track_list: [{}] }]) }, malformed_groups: { body: page({}) }, malformed_tracks: { body: page([{}]) }, missing_result: { body: '<script id="__NEXT_DATA__">{"props":{"pageProps":{"serverData":[]}}}</script>' }, malformed_package: { body: page([{ combine_track_list: [null] }]) }, rejected_business: { body: page([]).replace('"res":{"result":', '"res":{"success":false,"result":') }, malformed_code: { body: page([{ combine_track_list: [{ pick_code: {} }] }]) } })) {
  test(`${name} 不能当成已取件，保留旧数据且不上传`, async () => {
    const h = await run(options);
    assert.equal(h.requests.some(r => r.method === "POST"), false);
    assert.equal(JSON.parse(h.prefs.get("pdd_pickup_latest")).packages[0].code, "OLD");
    assert.equal(h.done, 1); assert.equal(h.notifications.length, 0);
    assert.match(h.logs.join("\n"), /保留旧数据/);
    assert.doesNotMatch(h.logs.join("\n"), /已清空Worker|test-cookie|test-upload-token/);
  });
}
test("上传拒绝或网络失败时不谎报已清空，done只执行一次", async () => {
  for (const options of [{ uploadStatus: 403 }, { uploadError: true }]) {
    const h = await run(options); assert.equal(h.done, 1);
    assert.doesNotMatch(h.logs.join("\n"), /已清空Worker|test-upload-token/);
    assert.equal(JSON.parse(h.prefs.get("pdd_pickup_latest")).packages[0].code, "OLD");
  }
});
test("连接配置缺失不能上传，提示本机配置而不走旧占位符判断", async () => {
  const h = await run({ prefs: { pdd_pickup_write_token: "" } });
  assert.equal(h.requests.length, 0); assert.equal(h.done, 1); assert.match(h.logs.join("\n"), /本机未保存/);
});


test("本地任务参数初始化认证到软件prefs，后续无参数运行仍自动沿用", async () => {
  const first = await run({ prefs: { pdd_pickup_worker_url: "", pdd_pickup_write_token: "" }, variables: { worker: "https%3A%2F%2Fnew.workers.dev%2F", token: "local%2Btoken%26" } });
  assert.equal(first.prefs.get("pdd_pickup_worker_url"), "https://new.workers.dev");
  assert.equal(first.prefs.get("pdd_pickup_write_token"), "local+token&");
  assert.equal(first.requests.at(-1).url, "https://new.workers.dev/api/update");
  assert.equal(first.requests.at(-1).headers.Authorization, "Bearer local+token&");
  assert.doesNotMatch(first.logs.join("\n"), /local\+token|test-cookie/);
  const later = await run({ prefs: Object.fromEntries(first.prefs) });
  assert.equal(later.requests.at(-1).headers.Authorization, "Bearer local+token&"); assert.equal(later.done, 1);
});
test("脚本更新不带任务参数时不修改已经保存的认证", async () => {
  const h = await run(); assert.equal(h.prefs.get("pdd_pickup_worker_url"), "https://example.workers.dev/");
  assert.equal(h.prefs.get("pdd_pickup_write_token"), "test-upload-token");
});
test("无效任务参数不覆盖认证、不请求网络，也不输出参数值", async () => {
  const h = await run({ variables: { worker: "http://bad.test", token: "secret-input" } });
  assert.equal(h.requests.length, 0); assert.equal(h.done, 1);
  assert.equal(h.prefs.get("pdd_pickup_write_token"), "test-upload-token");
  assert.doesNotMatch(h.logs.join("\n"), /secret-input|bad.test/);
});
