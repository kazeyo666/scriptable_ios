// Quantumult X 定时任务。Worker连接配置只保存于本机$prefs。
// pdd_pickup_worker_url: Worker根地址
// pdd_pickup_write_token: /api/update使用的上传令牌
(async function () {
  const VERSION = "2026-10-13-v4";
  const log = message => console.log("[PDD自动刷新 " + VERSION + "] " + message);
  let finished = false;
  const done = () => { if (!finished) { finished = true; $done(); } };
  let worker = String($prefs.valueForKey("pdd_pickup_worker_url") || "").trim().replace(/\/+$/, "");
  let token = String($prefs.valueForKey("pdd_pickup_write_token") || "").trim();
  // 任务URL的#参数只在Quantumult X本机使用，不会随下载请求发送到GitHub。
  // $environment.variables从Quantumult X v1.5.6 build 918起支持。
  const variables = typeof $environment !== "undefined" && $environment.variables || {};
  if (variables.worker !== undefined || variables.token !== undefined) {
    try {
      const input = value => decodeURIComponent(String(value)).trim();
      const nextWorker = variables.worker === undefined ? worker : input(variables.worker).replace(/\/+$/, "");
      const nextToken = variables.token === undefined ? token : input(variables.token);
      if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(nextWorker) || !nextToken) throw Error("configuration");
      if ($prefs.setValueForKey(nextWorker, "pdd_pickup_worker_url") === false
        || $prefs.setValueForKey(nextToken, "pdd_pickup_write_token") === false) throw Error("storage");
      worker = nextWorker; token = nextToken;
      log("连接配置已保存到Quantumult X本机；以后可移除任务URL的#参数");
    } catch (_) { log("本地任务参数无效或保存失败；未执行刷新"); done(); return; }
  }
  function extract(html) {
    const match = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script\s*>/i);
    if (!match) { log("没有__NEXT_DATA__，无法确认取件状态；保留旧数据"); return null; }
    let data;
    try { data = JSON.parse(match[1]); } catch (_) { log("JSON解析失败，无法确认取件状态；保留旧数据"); return null; }
    const entries = data?.props?.pageProps?.serverData;
    const entry = Array.isArray(entries) ? entries.find(item => item?.key === "queryStationPackageInfo") : null;
    const result = entry?.res?.result;
    if (!entry || !entry.res || entry.res.success === false || !result || typeof result !== "object" || Array.isArray(result)) {
      log("缺少有效包裹业务结果，无法确认取件状态；保留旧数据"); return null;
    }
    const groups = result.combine_list;
    log("combine_list类型: " + (Array.isArray(groups) ? "array(" + groups.length + ")" : typeof groups));
    // 用户确认：包裹取走后会从业务结果消失。成功业务响应中的缺省/空列表才视为无待取件。
    if (groups == null) { log("业务查询成功，已查不到待取包裹"); return []; }
    if (!Array.isArray(groups)) { log("包裹列表格式异常，保留旧数据"); return null; }
    const packages = [], seen = new Set();
    for (const group of groups) {
      if (!group || !Array.isArray(group.combine_track_list)) { log("包裹明细格式异常，保留旧数据"); return null; }
      for (const item of group.combine_track_list) {
        if (!item || typeof item !== "object" || Array.isArray(item)) { log("包裹对象格式异常，保留旧数据"); return null; }
        if (typeof item.pick_code !== "string" && !(typeof item.pick_code === "number" && Number.isFinite(item.pick_code))) {
          log("查询仍有包裹但取件码字段异常，保留旧数据"); return null;
        }
        const code = String(item.pick_code).replace(/^\s*取件码\s*[:：]?\s*/, "").trim();
        const company = String(item?.shipping_name || "快递");
        const signature = JSON.stringify([company, code]);
        if (!code) { log("查询仍有包裹但无法解析取件码，保留旧数据"); return null; }
        if (!seen.has(signature)) { seen.add(signature); packages.push({ company, code }); }
      }
    }
    if (!packages.length) log("业务查询成功，当前无待取包裹");
    return packages;
  }
  try {
    log("开始刷新；成功查询无包裹才清空，查询异常保留旧数据");
    if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(worker) || !token) {
      log("本机未保存有效Worker连接配置；请在本地任务URL的#参数填写worker和token一次"); return;
    }
    let headers;
    try { headers = JSON.parse($prefs.valueForKey("pdd_pickup_request_v1") || "{}").headers; } catch (_) { /* 缺少凭据时无法判断是否已取件 */ }
    let packages = null;
    if (!headers || typeof headers !== "object" || Array.isArray(headers) || !Object.keys(headers).length) { log("缺少请求头，无法确认取件状态；保留旧数据"); return; }
    else {
      try {
        const response = await $task.fetch({ url: "https://m.pinduoduo.net/mdkd/package", method: "GET", headers, timeout: 15 });
        const html = String(response.body || ""), status = Number(response.statusCode || response.status || 0);
        log("HTTP " + status + ", 响应长度 " + html.length);
        if (status === 200) packages = extract(html);
        else { log("查询HTTP异常，无法确认取件状态；保留旧数据"); return; }
      } catch (_) { log("查询失败，无法确认取件状态；保留旧数据"); return; }
    }
    if (packages === null) return;
    const upload = await $task.fetch({ url: worker + "/api/update", method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ packages }), timeout: 15 });
    const status = Number(upload.statusCode || upload.status || 0);
    log("Worker上传 HTTP " + status + "，本次 " + packages.length + " 件");
    if (status < 200 || status >= 300) { log("上传未成功，Worker旧数据尚未清除"); return; }
    let previous = [];
    try { const saved = JSON.parse($prefs.valueForKey("pdd_pickup_latest") || "{}"); if (Array.isArray(saved.packages)) previous = saved.packages; } catch (_) { /* 无旧数据 */ }
    const signature = rows => JSON.stringify(rows.map(item => [item.company, item.code]).sort());
    $prefs.setValueForKey(JSON.stringify({ updatedAt: new Date().toISOString(), packages, source: "scheduled" }), "pdd_pickup_latest");
    log(packages.length ? "已覆盖为最新待取列表" : "已清空Worker及本机待取列表");
    if (signature(previous) !== signature(packages)) {
      $notify("多多买菜取件码已更新", packages.length + "件待取", packages.length ? packages.map(item => item.code).join("\n") : "当前无待取件包裹");
    }
  } catch (_) { log("上传或本机保存失败；未确认清空成功"); }
  finally { done(); }
})();
