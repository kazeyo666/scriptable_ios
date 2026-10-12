// Quantumult X 定时任务。Worker连接配置只保存于本机$prefs。
// pdd_pickup_worker_url: Worker根地址
// pdd_pickup_write_token: /api/update使用的上传令牌
(async function () {
  const VERSION = "2026-10-12-v2";
  const log = message => console.log("[PDD自动刷新 " + VERSION + "] " + message);
  let finished = false;
  const done = () => { if (!finished) { finished = true; $done(); } };
  const worker = String($prefs.valueForKey("pdd_pickup_worker_url") || "").trim().replace(/\/+$/, "");
  const token = String($prefs.valueForKey("pdd_pickup_write_token") || "").trim();
  function extract(html) {
    const match = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script\s*>/i);
    if (!match) { log("没有__NEXT_DATA__，清空待取列表"); return []; }
    let data;
    try { data = JSON.parse(match[1]); } catch (_) { log("JSON解析失败，清空待取列表"); return []; }
    const entries = data?.props?.pageProps?.serverData;
    const entry = Array.isArray(entries) ? entries.find(item => item?.key === "queryStationPackageInfo") : null;
    const groups = entry?.res?.result?.combine_list;
    log("combine_list类型: " + (Array.isArray(groups) ? "array(" + groups.length + ")" : typeof groups));
    if (!Array.isArray(groups)) { log("无法取得包裹列表，清空待取列表"); return []; }
    const packages = [], seen = new Set();
    for (const group of groups) {
      for (const item of Array.isArray(group?.combine_track_list) ? group.combine_track_list : []) {
        const code = String(item?.pick_code ?? "").replace(/^\s*取件码\s*[:：]?\s*/, "").trim();
        const company = String(item?.shipping_name || "快递");
        const signature = JSON.stringify([company, code]);
        if (code && !seen.has(signature)) { seen.add(signature); packages.push({ company, code }); }
      }
    }
    if (!packages.length) log("未取得有效取件码，清空待取列表");
    return packages;
  }
  try {
    log("开始刷新；无结果或查询失败均上传空列表");
    if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(worker) || !token) {
      log("本机未保存有效Worker连接配置，无法上传；请使用已配置的任务脚本"); return;
    }
    let headers;
    try { headers = JSON.parse($prefs.valueForKey("pdd_pickup_request_v1") || "{}").headers; } catch (_) { /* 读取不到也继续上传空列表 */ }
    let packages = [];
    if (!headers || typeof headers !== "object" || Array.isArray(headers)) log("缺少请求头，清空待取列表");
    else {
      try {
        const response = await $task.fetch({ url: "https://m.pinduoduo.net/mdkd/package", method: "GET", headers, timeout: 15 });
        const html = String(response.body || ""), status = Number(response.statusCode || response.status || 0);
        log("HTTP " + status + ", 响应长度 " + html.length);
        if (status === 200) packages = extract(html);
        else log("查询HTTP异常，清空待取列表");
      } catch (_) { log("查询失败，清空待取列表"); }
    }
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
