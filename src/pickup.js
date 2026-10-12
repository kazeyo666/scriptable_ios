// 多多买菜 Worker 只读组件；地址与 READ_TOKEN 仅由手机本地保存。
async function runPickupWidget() {
  const title = "多多买菜取件码";
  const settingKey = "scriptable-pdd-pickup-read-config-v1";
  const query = args.queryParameters || {};
  const family = ["small", "medium", "large"].includes(query.infoFamily) ? query.infoFamily
    : ["small", "medium", "large"].includes(config.widgetFamily) ? config.widgetFamily : "large";
  const urlFor = action => `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}&remoteScript=${encodeURIComponent(title)}&infoAction=${action}&infoFamily=${family}`;
  let settings = null;
  try { if (Keychain.contains(settingKey)) settings = JSON.parse(Keychain.get(settingKey)); } catch (_) { /* 损坏配置可重新填写 */ }
  function normalizeSettings(address, token) {
    const base = String(address || "").trim().replace(/\/+$/, "");
    // 只接受 HTTPS 根地址，防止旧 query 中留下令牌或拼接到错误路径。
    if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(base)) throw Error("请填写 HTTPS Worker 根地址，例如 https://你的名称.workers.dev/");
    const key = String(token || "").trim();
    if (!key) throw Error("请填写 READ_TOKEN");
    return { base, token: key };
  }
  async function configure() {
    let values = [settings?.base || "", ""];
    while (true) {
      const form = new Alert(); form.title = "连接多多买菜 Worker";
      form.message = "填写 Worker 根地址和 READ_TOKEN。配置保存在手机钥匙串；不要填写 WRITE_TOKEN 或拼多多 Cookie。修改时令牌留空可沿用原值。";
      form.addTextField("Worker 地址", values[0]); form.addSecureTextField("READ_TOKEN", values[1]);
      form.addAction("保存并读取"); form.addCancelAction("取消");
      if (await form.presentAlert() < 0) return false;
      values = [form.textFieldValue(0), form.textFieldValue(1)];
      try {
        const next = normalizeSettings(values[0], values[1] || settings?.token);
        Keychain.set(settingKey, JSON.stringify(next)); settings = next; return true;
      } catch (error) {
        const warning = new Alert(); warning.title = "请检查连接设置"; warning.message = error.message;
        warning.addAction("重新填写"); await warning.presentAlert();
      }
    }
  }
  if (config.runsInApp) {
    if (!settings || query.infoAction === "pickup-settings") {
      if (!await configure()) { Script.complete(); return; }
    } else if (query.infoAction !== "refresh") {
      const menu = new Alert(); menu.title = title;
      menu.addAction("刷新并预览"); menu.addAction("修改连接设置"); menu.addCancelAction("取消");
      const action = await menu.presentSheet();
      if (action < 0 || action === 1 && !await configure()) { Script.complete(); return; }
    }
  }
  let packages = [], updatedAt = "", message = "", failed = false;
  if (!settings) message = "请先在 Scriptable 中运行本脚本，填写 Worker 地址和 READ_TOKEN";
  else {
    let request;
    try {
      settings = normalizeSettings(settings.base, settings.token);
      request = new Request(`${settings.base}/api/latest?key=${encodeURIComponent(settings.token)}`);
      request.timeoutInterval = 15;
      const raw = await request.loadJSON();
      if (request.response.statusCode !== 200) throw Error("HTTP");
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || !Array.isArray(data.packages)) throw Error("packages");
      packages = data.packages.map(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw Error("package");
        const code = typeof item.code === "string" ? item.code.trim()
          : typeof item.code === "number" && Number.isFinite(item.code) ? String(item.code) : "";
        if (!code) throw Error("code");
        return { company: typeof item.company === "string" && item.company.trim() ? item.company.trim() : "多多买菜", code };
      });
      if (data.updatedAt) {
        const date = new Date(data.updatedAt);
        if (!Number.isNaN(date.getTime())) updatedAt = `数据更新 ${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      }
    } catch (_) {
      // 请求异常可能包含完整 URL；不记录或展示异常原文、令牌或 Worker 响应。
      failed = true; packages = [];
      const status = request?.response?.statusCode;
      message = status === 401 || status === 403 ? `读取被拒绝（HTTP ${status}），请检查 READ_TOKEN 和 Worker 访问设置` : "读取失败，请检查地址、读取令牌和网络";
    }
  }
  const widget = new ListWidget(); widget.setPadding(12, 12, 12, 12); widget.backgroundColor = new Color("#142137");
  widget.url = urlFor(family === "small" && settings ? "refresh" : "pickup-settings");
  widget.refreshAfterDate = config.runsInApp ? new Date() : new Date(Date.now() + (failed ? 5 : 10) * 60000);
  function text(parent, value, size, color = "#FFFFFF", bold = false) {
    const label = parent.addText(value); label.font = bold ? Font.semiboldSystemFont(size) : Font.systemFont(size);
    label.textColor = new Color(color); label.lineLimit = 1; label.minimumScaleFactor = 0.65; return label;
  }
  const header = widget.addStack(); header.layoutHorizontally(); header.centerAlignContent();
  text(header, title, family === "large" ? 16 : 12, "#FFFFFF", true); header.addSpacer();
  if (settings) text(header, "刷新", 10, "#AAB8CB").url = urlFor("refresh");
  widget.addSpacer(6);
  text(widget, failed ? "连接失败" : settings ? `${packages.length} 件待取` : "未配置", 11, "#AAB8CB");
  widget.addSpacer(8);
  if (message || !packages.length) {
    const label = text(widget, message || "暂无待取包裹", 14); label.lineLimit = family === "small" ? 3 : 2;
  } else {
    const limit = { small: 2, medium: 2, large: 6 }[family];
    packages.slice(0, limit).forEach(item => {
      const row = widget.addStack(); row.layoutHorizontally(); row.centerAlignContent();
      text(row, item.company.slice(0, 16), family === "small" ? 11 : 13, "#AAB8CB"); row.addSpacer(8);
      text(row, item.code, family === "large" ? 23 : 19, "#FFFFFF", true); widget.addSpacer(family === "large" ? 5 : 3);
    });
    if (packages.length > limit) text(widget, `另有 ${packages.length - limit} 件 · 大号显示更多`, 10, "#AAB8CB");
  }
  widget.addSpacer();
  if (updatedAt) text(widget, updatedAt, 10, "#AAB8CB");
  if (family !== "small") { const setting = text(widget, "连接设置", 10, "#AAB8CB"); setting.url = urlFor("pickup-settings"); }
  Script.setWidget(widget);
  if (config.runsInApp) await widget[{ small: "presentSmall", medium: "presentMedium", large: "presentLarge" }[family]]();
  Script.complete();
}
await runPickupWidget();
