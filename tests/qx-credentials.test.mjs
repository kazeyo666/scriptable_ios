import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../QuantumultX/多多买菜登录凭证.js", import.meta.url), "utf8");
const key = "pdd_pickup_request_v1";
const original = JSON.stringify({ headers: { cookie: "old-test-cookie", "x-pdd-info": "old-test-context" } });
function run(options = {}) {
  const prefs = new Map([[key, original]]), logs = [], completions = [];
  let writes = 0;
  const sandbox = {
    console: { log: message => logs.push(message) },
    $done: result => completions.push(result),
    $prefs: { setValueForKey(value, name) {
      writes++;
      if (options.storageError) throw Error("secret-test-error");
      if (options.storageRejected) return false;
      prefs.set(name, value); return true;
    } },
  };
  if (!options.noRequest) sandbox.$request = {
    url: "https://m.pinduoduo.net/mdkd/package?source=test", method: "GET",
    headers: { Cookie: "new-test-cookie", "X-PDD-Info": "new-test-context" }, ...options.request,
  };
  vm.runInNewContext(source, sandbox);
  assert.equal(completions.length, 1);
  assert.equal(JSON.stringify(completions[0]), "{}");
  assert.doesNotMatch(logs.join("\n"), /old-test-cookie|old-test-context|new-test-cookie|new-test-context|secret-test-error/);
  return { prefs, logs: logs.join("\n"), writes };
}

test("保存同一次请求的非空白名单字段，可被刷新任务读取且不合并旧Cookie", () => {
  const h = run({ request: { headers: {
    "P-Uno-Context": "new-test-context", "User-Agent": "test-agent", Host: "ignored.test",
    Authorization: "ignored", "X-PDD-Info": " ", Accept: "text/html", Cookie: "",
    "X-Client-Region": 123, "X-Yak-Llt": "unsafe\r\nheader",
  } } });
  const saved = JSON.parse(h.prefs.get(key));
  assert.deepEqual(saved.headers, { "p-uno-context": "new-test-context", "user-agent": "test-agent", accept: "text/html" });
  assert.equal(typeof saved.savedAt, "number");
  assert.match(h.logs, /已保存到本机/);
});
test("忽略空的大小写重复字段并保留有效登录上下文", () => {
  const h = run({ request: { headers: { "X-PDD-Info": "new-test-context", "x-pdd-info": " " } } });
  assert.equal(JSON.parse(h.prefs.get(key)).headers["x-pdd-info"], "new-test-context");
});
for (const [name, options] of Object.entries({
  no_request: { noRequest: true },
  other_host: { request: { url: "https://other.test/mdkd/package" } },
  lookalike_host: { request: { url: "https://m.pinduoduo.net.other.test/mdkd/package" } },
  other_path: { request: { url: "https://m.pinduoduo.net/mdkd/package-other" } },
  post: { request: { method: "POST" } },
  missing_headers: { request: { headers: undefined } },
  cookie_only: { request: { headers: { Cookie: "new-test-cookie" } } },
  blank_context: { request: { headers: { "X-PDD-Info": " ", "P-Uno-Context": "" } } },
  malformed_context: { request: { headers: { "X-PDD-Info": {}, "P-Uno-Context": "bad\ncontext" } } },
})) {
  test(`${name} 保留原凭证且结束请求`, () => {
    const h = run(options);
    assert.equal(h.prefs.get(key), original); assert.equal(h.writes, 0);
    assert.match(h.logs, /保留原凭证/);
  });
}
for (const option of ["storageError", "storageRejected"]) {
  test(`${option} 不谎报成功且不打印敏感异常`, () => {
    const h = run({ [option]: true });
    assert.equal(h.prefs.get(key), original);
    assert.doesNotMatch(h.logs, /已保存到本机/);
    assert.match(h.logs, /失败|异常/);
  });
}
test("重写规则和脚本均接受取件页及查询参数，拒绝其它路径", () => {
  const config = readFileSync(new URL("../QuantumultX/多多买菜登录凭证.conf", import.meta.url), "utf8");
  const line = config.split("\n").find(line => line.includes(" url script-request-header "));
  const [pattern, scriptURL] = line.split(" url script-request-header ");
  const regex = new RegExp(pattern);
  assert.match(config, /^hostname = m\.pinduoduo\.net$/m);
  assert.ok(decodeURI(scriptURL).endsWith("/QuantumultX/多多买菜登录凭证.js"));
  for (const path of ["/mdkd/package", "/mdkd/package/", "/mdkd/package?foo=bar", "/mdkd/package/?foo=bar"]) {
    const url = "https://m.pinduoduo.net" + path;
    assert.ok(regex.test(url)); assert.equal(run({ request: { url } }).writes, 1);
  }
  assert.equal(regex.test("https://m.pinduoduo.net/mdkd/package-other"), false);
});
