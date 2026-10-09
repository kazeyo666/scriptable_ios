// Variables used by Scriptable.
// icon-color: blue; icon-glyph: calendar-alt;

// 在 App 内运行管理事件；小组件参数填写事件名称，留空显示默认事件。
// 经 RemoteLauncher 加载时，参数填写 countdown|事件名称。
const fm = FileManager.local();
const dataPath = fm.joinPath(fm.documentsDirectory(), "scriptable-countdown-events.json");
let settings;
let loadError = "";
try {
  settings = loadSettings();
} catch (error) {
  loadError = String(error.message || error);
}

if (loadError) {
  // 配置损坏时保留原文件，避免下一次保存覆盖用户数据。
  if (!config.runsInWidget) await message("配置读取失败", loadError);
  Script.setWidget(infoWidget("配置读取失败", "请检查本地事件配置文件，原文件已保留。"));
} else if (config.runsInWidget) {
  Script.setWidget(selectedWidget());
} else {
  await manageEvents();
  Script.setWidget(selectedWidget());
}
Script.complete();

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1900 || year > 9999) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1
    && date.getDate() === day ? date : null;
}

function loadSettings() {
  if (!fm.fileExists(dataPath)) return { events: [], defaultId: null };
  const data = JSON.parse(fm.readString(dataPath));
  if (!data || !Array.isArray(data.events)) throw new Error("事件配置格式不正确。");
  const names = new Set(), ids = new Set();
  for (const event of data.events) {
    if (!event || typeof event.id !== "string" || !event.id
      || typeof event.name !== "string" || !event.name.trim()
      || typeof event.date !== "string" || !parseDate(event.date)
      || typeof event.text !== "string" || names.has(event.name) || ids.has(event.id)) {
      throw new Error("事件配置包含无效日期、重复事件或缺失字段。");
    }
    names.add(event.name);
    ids.add(event.id);
  }
  if (!ids.has(data.defaultId)) data.defaultId = data.events[0]?.id || null;
  return data;
}

function saveSettings() {
  fm.writeString(dataPath, JSON.stringify(settings, null, 2));
}

// 用日历日期计算天数，不受当天时间和夏令时的 23/25 小时影响。
function daysUntil(value, now = new Date()) {
  const target = parseDate(value);
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((targetDay - today) / 86400000);
}

function baseWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#223A70");
  widget.setPadding(14, 14, 14, 14);
  const nextDay = new Date();
  nextDay.setHours(24, 0, 0, 0);
  widget.refreshAfterDate = nextDay;
  // 点击组件在 App 内打开配置菜单。
  widget.url = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name());
  return widget;
}

function text(widget, value, size, color = "#FFFFFF") {
  const label = widget.addText(value);
  label.font = Font.boldRoundedSystemFont(size);
  label.textColor = new Color(color);
  label.centerAlignText();
  label.minimumScaleFactor = 0.5;
  label.lineLimit = 2;
  return label;
}

function infoWidget(title, detail) {
  const widget = baseWidget();
  widget.addSpacer();
  text(widget, title, 17);
  widget.addSpacer(8);
  text(widget, detail, 12, "#CBD5E1");
  widget.addSpacer();
  return widget;
}

function eventWidget(event) {
  const widget = baseWidget();
  const days = daysUntil(event.date);
  widget.addSpacer();
  text(widget, event.text || event.name, 15);
  widget.addSpacer(6);
  text(widget, String(Math.abs(days)), config.widgetFamily === "small" ? 48 : 60);
  text(widget, days > 0 ? "天后到来" : days === 0 ? "就是今天" : "天前已到", 13, "#CBD5E1");
  widget.addSpacer(6);
  text(widget, event.date, 11, "#CBD5E1");
  widget.addSpacer();
  return widget;
}

function selectedWidget() {
  const name = String(args.widgetParameter || "").trim();
  const event = name ? settings.events.find(item => item.name === name)
    : settings.events.find(item => item.id === settings.defaultId);
  if (event) return eventWidget(event);
  if (name) return infoWidget("找不到事件", `“${name}”不存在，请检查小组件参数。`);
  return infoWidget("添加倒计时", "点击组件，或在 Scriptable 内运行脚本添加事件。");
}

async function message(title, detail) {
  const alert = new Alert();
  alert.title = title;
  alert.message = detail;
  alert.addAction("好的");
  await alert.presentAlert();
}

async function chooseEvent(title) {
  if (!settings.events.length) {
    await message("暂无事件", "请先添加一个倒计时。");
    return null;
  }
  const alert = new Alert();
  alert.title = title;
  for (const event of settings.events) {
    alert.addAction(`${event.name} · ${event.date}${event.id === settings.defaultId ? "（默认）" : ""}`);
  }
  alert.addCancelAction("取消");
  const index = await alert.presentSheet();
  return index < 0 ? null : settings.events[index];
}

async function editEvent(existing = null) {
  let name = existing?.name || "", date = existing?.date || "", caption = existing?.text || "";
  while (true) {
    const alert = new Alert();
    alert.title = existing ? "修改倒计时" : "添加倒计时";
    alert.message = "日期填 YYYY-MM-DD，例如 2027-01-01。按设备本地日期计算；文案可留空。";
    alert.addTextField("事件名称，例如 生日", name);
    alert.addTextField("目标日期 YYYY-MM-DD", date);
    alert.addTextField("显示文案，可留空", caption);
    alert.addAction("保存");
    alert.addCancelAction("取消");
    if (await alert.presentAlert() < 0) return;
    name = alert.textFieldValue(0).trim();
    date = alert.textFieldValue(1).trim();
    caption = alert.textFieldValue(2).trim();
    if (!name || !parseDate(date)) {
      await message("请检查输入", "名称不能为空，日期必须是有效的 YYYY-MM-DD（1900—9999 年）。");
      continue;
    }
    if (settings.events.some(event => event.name === name && event.id !== existing?.id)) {
      await message("名称已存在", "每个事件需要不同的名称，方便小组件选择。");
      continue;
    }
    const event = { id: existing?.id || UUID.string(), name, date, text: caption };
    if (existing) settings.events[settings.events.findIndex(item => item.id === existing.id)] = event;
    else settings.events.push(event);
    if (!settings.defaultId) settings.defaultId = event.id;
    saveSettings();
    await message("已保存", `小组件参数填事件名称“${name}”。\n使用远程入口时填“countdown|${name}”。${existing && existing.name !== name ? "\n名称已更改，请同步修改原小组件参数。" : ""}`);
    return;
  }
}

async function manageEvents() {
  while (true) {
    const menu = new Alert();
    menu.title = "倒计时管理";
    menu.message = `已保存 ${settings.events.length} 个事件。参数留空显示默认事件，数据仅保存在当前设备。`;
    ["添加事件", "修改事件", "删除事件", "设置默认事件", "预览事件"].forEach(item => menu.addAction(item));
    menu.addCancelAction("完成");
    const action = await menu.presentSheet();
    if (action < 0) return;
    if (action === 0) { await editEvent(); continue; }
    const event = await chooseEvent(["", "选择要修改的事件", "选择要删除的事件", "选择默认事件", "选择预览事件"][action]);
    if (!event) continue;
    if (action === 1) await editEvent(event);
    if (action === 2) {
      const confirm = new Alert();
      confirm.title = `删除“${event.name}”？`;
      confirm.message = "使用该名称的小组件将显示找不到事件。";
      confirm.addDestructiveAction("删除");
      confirm.addCancelAction("取消");
      if (await confirm.presentAlert() === 0) {
        settings.events = settings.events.filter(item => item.id !== event.id);
        if (settings.defaultId === event.id) settings.defaultId = settings.events[0]?.id || null;
        saveSettings();
      }
    }
    if (action === 3) { settings.defaultId = event.id; saveSettings(); }
    if (action === 4) await eventWidget(event).presentSmall();
  }
}
