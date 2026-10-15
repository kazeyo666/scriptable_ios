// Quantumult X request-header：仅在本机保存多多取件页登录请求，供定时任务复用。
// 捕获请求不代表登录已验证；是否有效仍由定时任务的业务响应判断。
(function () {
  var log = function (message) { console.log("[PDD登录凭证] " + message); };
  try {
    var request = typeof $request !== "undefined" && $request;
    if (!request || !/^https:\/\/m\.pinduoduo\.net\/mdkd\/package\/?(?:\?[^#]*)?$/.test(request.url || "")
      || (request.method && String(request.method).toUpperCase() !== "GET")) {
      log("非目标取件页请求，保留原凭证");
      return;
    }
    var allowed = /^(user-agent|accept|accept-language|x-client-language|x-app-ui|x-client-region|x-pdd-queries|x-pdd-info|p-uno-context|cookie|x-yak-llt|am-web-req-id)$/;
    var headers = {};
    Object.keys(request.headers || {}).forEach(function (key) {
      var name = key.toLowerCase(), value = request.headers[key];
      if (allowed.test(name) && typeof value === "string" && value.trim() && !/[\r\n]/.test(value)) {
        headers[name] = value;
      }
    });
    if (!headers["x-pdd-info"] && !headers["p-uno-context"]) {
      log("缺少非空登录上下文，保留原凭证");
      return;
    }
    // 整份替换同一次请求，不与旧Cookie或上下文混用。
    if ($prefs.setValueForKey(JSON.stringify({ headers: headers, savedAt: Date.now() }), "pdd_pickup_request_v1") === false) {
      log("登录请求保存失败，请检查Quantumult X本机存储");
      return;
    }
    log("登录请求已保存到本机；请运行多多买菜自动刷新验证登录状态");
  } catch (_) {
    // 不打印异常对象，其中可能包含Cookie或登录上下文。
    log("登录请求保存异常，未确认更新成功");
  } finally {
    $done({});
  }
})();
