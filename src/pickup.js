// 多多买菜只读提供器：与手动快递记录分开保存，合并展示。
function createPickupProvider(cachePath) {
  const settingKey = "kazeyo-pdd-pickup-read-config-v1";
  const fm = FileManager.local();
  function normalizeSettings(address, token) {
    const base = String(address || "").trim().replace(/\/+$/, "");
    if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(base)) throw Error("请填写 HTTPS Worker 根地址，例如 https://你的名称.workers.dev/");
    const key = String(token || "").trim(); if (!key) throw Error("请填写 READ_TOKEN");
    return { base, token: key };
  }
  function settings() {
    try {
      if (!Keychain.contains(settingKey)) return null;
      const saved = JSON.parse(Keychain.get(settingKey));
      return normalizeSettings(saved.base, saved.token);
    } catch (_) { return null; }
  }
  function packages(value) {
    if (!Array.isArray(value)) throw Error("packages");
    return value.map(item => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw Error("package");
      const code = typeof item.code === "string" ? item.code.trim()
        : typeof item.code === "number" && Number.isFinite(item.code) ? String(item.code) : "";
      if (!code) throw Error("code");
      return { company: typeof item.company === "string" && item.company.trim() ? item.company.trim() : "多多买菜", code };
    });
  }
  let state = { packages: [], warning: "", updatedAt: "" };
  if (settings() && fm.fileExists(cachePath)) {
    try {
      const saved = JSON.parse(fm.readString(cachePath));
      if (Date.now() - Date.parse(saved.fetchedAt) <= 30 * 60000) {
        state = { packages: packages(saved.packages), warning: "", updatedAt: saved.updatedAt || "" };
      } else state.warning = "多多买菜缓存已过期，请刷新";
    } catch (_) { state.warning = "多多买菜缓存不可用，请刷新"; }
  }
  async function configure() {
    const old = settings(); let values = [old?.base || "", ""];
    while (true) {
      const form = new Alert(); form.title = "多多买菜连接设置";
      form.message = "填写 Worker 根地址和 READ_TOKEN。配置保存在手机钥匙串；不要填写 WRITE_TOKEN 或拼多多 Cookie。修改时令牌留空可沿用原值。";
      form.addTextField("Worker 地址", values[0]); form.addSecureTextField("READ_TOKEN", values[1]);
      form.addAction("保存并读取"); form.addCancelAction("取消");
      if (await form.presentAlert() < 0) return false;
      values = [form.textFieldValue(0), form.textFieldValue(1)];
      try {
        const next = normalizeSettings(values[0], values[1] || old?.token);
        Keychain.set(settingKey, JSON.stringify(next)); return true;
      } catch (error) {
        const warning = new Alert(); warning.title = "请检查连接设置"; warning.message = error.message;
        warning.addAction("重新填写"); await warning.presentAlert();
      }
    }
  }
  async function refresh() {
    const connection = settings();
    if (!connection) { state = { packages: [], warning: "", updatedAt: "" }; return; }
    let request;
    try {
      request = new Request(`${connection.base}/api/latest?key=${encodeURIComponent(connection.token)}`);
      request.timeoutInterval = 15;
      request.headers = { Accept: "application/json", "User-Agent": "Scriptable-Pickup-Check/1.0" };
      const raw = await request.loadJSON();
      if (request.response.statusCode !== 200) throw Error("HTTP");
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      const rows = packages(data?.packages);
      const date = new Date(data.updatedAt);
      state = { packages: rows, warning: "", updatedAt: Number.isNaN(date.getTime()) ? "" : date.toISOString() };
      // 缓存仅保存显示数据，不保存地址或令牌，也不覆盖手动快递数据库。
      try { fm.writeString(cachePath, JSON.stringify({ ...state, fetchedAt: new Date().toISOString() })); } catch (_) { /* 存储失败不影响本次显示 */ }
    } catch (_) {
      const status = request?.response?.statusCode;
      state = { packages: [], updatedAt: "", warning: status === 401 || status === 403
        ? `多多买菜读取被拒绝（HTTP ${status}）` : "多多买菜读取失败，请刷新或检查连接设置" };
      // 失败时不展示旧取件码；本地手动记录继续显示。
      try { if (fm.fileExists(cachePath)) fm.remove(cachePath); } catch (_) { /* 本次仍不使用旧缓存 */ }
    }
  }
  function merged(localItems) {
    const local = localItems.filter(p => p.status === "pending");
    const seen = new Set(), rows = [];
    for (const remote of state.packages) {
      const item = local.find(p => p.company === remote.company && p.code === remote.code)
        || { ...remote, station: "多多买菜", note: "", status: "pending" };
      const key = JSON.stringify([item.company, item.code]);
      if (!seen.has(key)) { rows.push(item); seen.add(key); }
    }
    for (const item of local) {
      const key = JSON.stringify([item.company, item.code]);
      if (!seen.has(key)) { rows.push(item); seen.add(key); }
    }
    return rows;
  }
  return { configure, refresh, merged, snapshot: () => state, configured: () => Boolean(settings()) };
}
