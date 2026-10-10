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

function loadSettings() {
  if (!fm.fileExists(dataPath)) return { events: [], defaultId: null };
  return InfoLogic.validate("countdowns", JSON.parse(fm.readString(dataPath)));
}

function saveSettings() {
  fm.writeString(dataPath, JSON.stringify(settings, null, 2));
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
  const occurrence = InfoLogic.countdownEvent(event);
  const days = occurrence.days;
  widget.addSpacer();
  text(widget, event.text || event.name, 15);
  widget.addSpacer(6);
  text(widget, String(Math.abs(days)), config.widgetFamily === "small" ? 48 : 60);
  text(widget, days > 0 ? "天后到来" : days === 0 ? "就是今天" : "天前已到", 13, "#CBD5E1");
  widget.addSpacer(6);
  text(widget, `${InfoLogic.countdownType(event)} · ${occurrence.nextDate}`, 11, "#CBD5E1");
  if (occurrence.age !== undefined) text(widget, `今年满 ${occurrence.age} 岁`, 13, "#CBD5E1");
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

async function chooseOption(title, options, detail = "") {
  const alert = new Alert(); alert.title = title; alert.message = detail;
  options.forEach(option => alert.addAction(option)); alert.addCancelAction("取消");
  return await alert.presentSheet();
}

async function chooseEventType() {
  const category = await chooseOption("选择倒计时类型", ["生日", "其他倒计时"], "生日每年循环并显示年龄；其他倒计时按目标日期计算。");
  if (category < 0) return null;
  if (category === 1) return "其他";
  const calendar = await chooseOption("选择生日历法", ["阳历", "农历", "闰月农历"], "阳历生日选阳历；农历生日选农历，出生在农历闰月选闰月农历。");
  return calendar < 0 ? null : ["阳历", "农历", "闰月农历"][calendar];
}
async function editEvent(existing = null) {
  let type = existing ? InfoLogic.countdownType(existing) : await chooseEventType();
  if (!type) return;
  let name = existing?.name || "", date = existing?.date || "", caption = existing?.text || "";
  while (true) {
    const birthday = type !== "其他", alert = new Alert();
    alert.title = existing ? "修改倒计时" : birthday ? "添加生日" : "添加其他倒计时";
    alert.message = birthday ? `已选择：${type}生日。填写出生年月日，每年循环并显示今年满几岁。${type === "阳历" ? "2月29日平年按28日。" : "请填写农历数字年月日，例如八月十五填 YYYY-08-15。支持1900—2100年；无对应闰月按普通月；三十遇小月按廿九。"}` : "按设备本地日期计算到目标日期的天数，不按年循环。";
    alert.addTextField(birthday ? "姓名／生日名称" : "事件名称", name);
    alert.addTextField(birthday ? `${type}出生日期 YYYY-MM-DD` : "目标日期 YYYY-MM-DD", date);
    alert.addTextField("显示文案，可留空", caption);
    alert.addAction("保存");
    if (existing) alert.addAction("修改类型／历法");
    alert.addCancelAction("取消");
    const action = await alert.presentAlert();
    if (action < 0) return;
    name = alert.textFieldValue(0).trim();
    date = alert.textFieldValue(1).trim();
    caption = alert.textFieldValue(2).trim();
    if (action === 1) { const selected = await chooseEventType(); if (selected) type = selected; continue; }
    if (!name) {
      await message("请检查输入", "名称不能为空。");
      continue;
    }
    if (settings.events.some(event => event.name === name && event.id !== existing?.id)) {
      await message("名称已存在", "每个事件需要不同的名称，方便小组件选择。");
      continue;
    }
    let event;
    try {
      event = { id: existing?.id || UUID.string(), name, date, text: caption, ...InfoLogic.countdownInput(type) };
      InfoLogic.validate("countdowns", { events: [event] });
    } catch (error) { await message("请检查输入", String(error.message || error)); continue; }
    if (existing) settings.events[settings.events.findIndex(item => item.id === existing.id)] = event;
    else settings.events.push(event);
    if (!settings.defaultId) settings.defaultId = event.id;
    saveSettings();
    return;
  }
}

async function manageEvents() {
  let page = 0;
  while (true) {
    page = Math.min(page, Math.max(0, Math.ceil(settings.events.length / 15) - 1));
    const events = settings.events.slice(page * 15, page * 15 + 15);
    const options = ["添加事件", ...events.map(event => `${InfoLogic.isBirthday(event) ? "生日" : "其他"} · ${event.name} · ${event.date}${event.id === settings.defaultId ? "（默认）" : ""}`)];
    if ((page + 1) * 15 < settings.events.length) options.push("下一页");
    if (page > 0) options.push("上一页");
    const action = await chooseOption("倒计时管理", options, `共 ${settings.events.length} 条。点选事件可编辑、删除、设默认或预览。参数填事件名称，留空显示默认事件。`);
    if (action < 0) return;
    if (action === 0) { await editEvent(); continue; }
    if (options[action] === "下一页") { page++; continue; }
    if (options[action] === "上一页") { page--; continue; }
    const event = events[action - 1]; if (!event) continue;
    const op = await chooseOption(event.name, ["编辑", "删除", "设为默认事件", "预览事件"]);
    if (op === 0) await editEvent(event);
    if (op === 1) {
      const confirm = new Alert(); confirm.title = `删除“${event.name}”？`;
      confirm.message = "使用该名称的小组件将显示找不到事件。";
      confirm.addDestructiveAction("删除"); confirm.addCancelAction("取消");
      if (await confirm.presentAlert() === 0) {
        settings.events = settings.events.filter(item => item.id !== event.id);
        if (settings.defaultId === event.id) settings.defaultId = settings.events[0]?.id || null;
        saveSettings();
      }
    }
    if (op === 2) { settings.defaultId = event.id; saveSettings(); }
    if (op === 3) await eventWidget(event).presentSmall();
  }
}
