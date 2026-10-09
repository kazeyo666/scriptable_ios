// Variables used by Scriptable.
// icon-color: blue; icon-glyph: th-large;

// 由 tools/build.mjs 生成；请修改 src/ 后重新生成。独立运行，无外部模块依赖。
// 纯逻辑：不依赖 Scriptable 或 Node，供独立脚本和自动化测试共用。
const InfoLogic = (() => {
  const moduleIds = ["parcels", "trains", "calendar", "countdowns"];
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const clone = value => JSON.parse(JSON.stringify(value));
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function str(value, label, required = false) {
    assert(value === undefined || typeof value === "string", `${label}必须是文字`);
    const result = (value || "").trim();
    assert(!required || result.length > 0, `${label}不能为空`);
    return result;
  }
  function dateParts(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const parts = match.slice(1).map(Number);
    if (parts[0] < 1900 || parts[0] > 9999) return null;
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1
      && date.getUTCDate() === parts[2] ? parts : null;
  }
  function instant(date, time, offset = "local") {
    const parts = dateParts(date), match = /^(\d{2}):(\d{2})$/.exec(time);
    assert(parts && match && +match[1] < 24 && +match[2] < 60, "日期或时间无效，请使用 YYYY-MM-DD 和 HH:mm");
    if (offset === "local") return new Date(parts[0], parts[1] - 1, parts[2], +match[1], +match[2]).getTime();
    const zone = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
    assert(zone && +zone[2] <= 14 && +zone[3] < 60 && (+zone[2] < 14 || +zone[3] === 0), "时区须为 local 或 +08:00 等 UTC 偏移");
    const minutes = (+zone[2] * 60 + +zone[3]) * (zone[1] === "+" ? 1 : -1);
    return Date.UTC(parts[0], parts[1] - 1, parts[2], +match[1], +match[2]) - minutes * 60000;
  }
  function daysUntil(value, now = new Date()) {
    const parts = dateParts(value);
    assert(parts, "倒计时日期无效");
    return Math.round((Date.UTC(parts[0], parts[1] - 1, parts[2])
      - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  }
  const dayText = days => days > 0 ? `还有 ${days} 天` : days === 0 ? "就是今天" : `已过 ${-days} 天`;
  function iso(value, label) {
    const text = str(value, label, true);
    assert(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text) && Number.isFinite(Date.parse(text)), `${label}须为带时区的 ISO 时间`);
    return text;
  }
  function normalizeParcel(input, id, now) {
    assert(input && typeof input === "object" && !Array.isArray(input), "快递记录格式无效");
    const status = input.status === undefined ? "pending" : input.status;
    assert(["pending", "collected"].includes(status), "快递状态须为 pending 或 collected");
    return { id: str(input.id === undefined ? id : input.id, "记录 ID", true),
      company: str(input.company, "快递公司", true), code: str(input.code, "取件码", true),
      station: str(input.station, "驿站"), note: str(input.note, "备注"), status,
      createdAt: iso(input.createdAt === undefined ? now : input.createdAt, "创建时间") };
  }
  function normalizeTrain(input, id, now) {
    assert(input && typeof input === "object" && !Array.isArray(input), "车票记录格式无效");
    const result = { id: str(input.id === undefined ? id : input.id, "记录 ID", true),
      number: str(input.number, "车次", true), from: str(input.from, "出发站", true), to: str(input.to, "到达站", true),
      date: str(input.date, "出发日期", true), time: str(input.time, "出发时间", true),
      endDate: str(input.endDate, "到达日期"), endTime: str(input.endTime, "到达时间"),
      offset: str(input.offset === undefined ? "+08:00" : input.offset, "时区", true),
      seat: str(input.seat, "席别/座位"), note: str(input.note, "备注"),
      createdAt: iso(input.createdAt === undefined ? now : input.createdAt, "创建时间") };
    const start = instant(result.date, result.time, result.offset);
    assert(Boolean(result.endDate) === Boolean(result.endTime), "到达日期和时间需一起填写或一起留空");
    if (result.endDate) assert(instant(result.endDate, result.endTime, result.offset) >= start, "到达时间不能早于出发时间");
    return result;
  }
  function unique(items) {
    const ids = new Set();
    for (const item of items) { assert(!ids.has(item.id), "记录 ID 重复"); ids.add(item.id); }
    return items;
  }
  function defaults() {
    const modules = moduleIds.map(id => ({ id, enabled: id !== "calendar", maxItems: id === "parcels" ? 3 : 2 }));
    return { version: 1, theme: { mode: "system", accent: "#007AFF" },
      profiles: { default: { modules, hideEmpty: true }, compact: { modules: modules.map(m => ({ ...m, maxItems: 1 })), hideEmpty: true } },
      calendar: { enabled: false, days: 7 } };
  }
  function validate(key, input) {
    assert(input && typeof input === "object" && !Array.isArray(input), "数据必须是 JSON 对象");
    if (key === "countdowns") {
      assert(Array.isArray(input.events), "倒计时缺少 events 数组");
      const names = new Set();
      const events = unique(input.events.map(event => {
        assert(event && typeof event === "object", "倒计时格式无效");
        const result = { id: str(event.id, "事件 ID", true), name: str(event.name, "事件名称", true),
          date: str(event.date, "事件日期", true), text: str(event.text, "显示文案") };
        assert(dateParts(result.date) && !names.has(result.name), "倒计时日期无效或名称重复");
        names.add(result.name); return result;
      }));
      return { events, defaultId: events.some(e => e.id === input.defaultId) ? input.defaultId : events[0]?.id || null };
    }
    assert(input.version === 1, "不支持的数据版本，请使用 version: 1");
    if (key === "parcels" || key === "trains") {
      assert(Array.isArray(input.items), "数据缺少 items 数组");
      const normalize = key === "parcels" ? normalizeParcel : normalizeTrain;
      const items = unique(input.items.map(item => normalize(item, undefined, undefined)));
      if (key === "trains") { assert(typeof input.hideEnded === "boolean", "hideEnded 必须是布尔值"); return { version: 1, items, hideEnded: input.hideEnded }; }
      return { version: 1, items };
    }
    if (key === "settings") {
      assert(input.theme && ["system", "light", "dark"].includes(input.theme.mode)
        && /^#[0-9a-fA-F]{6}$/.test(input.theme.accent), "主题模式或颜色无效");
      const profiles = {};
      for (const name of ["default", "compact"]) {
        const profile = input.profiles?.[name];
        assert(profile && Array.isArray(profile.modules) && typeof profile.hideEmpty === "boolean", "面板配置无效");
        const ids = new Set();
        const modules = profile.modules.map(m => {
          assert(m && moduleIds.includes(m.id) && !ids.has(m.id) && typeof m.enabled === "boolean"
            && Number.isInteger(m.maxItems) && m.maxItems >= 1 && m.maxItems <= 20, "模块配置无效（条数 1—20）");
          ids.add(m.id); return { id: m.id, enabled: m.enabled, maxItems: m.maxItems };
        });
        assert(ids.size === moduleIds.length, "模块配置缺少必要模块");
        profiles[name] = { modules, hideEmpty: profile.hideEmpty };
      }
      assert(input.calendar && typeof input.calendar.enabled === "boolean"
        && Number.isInteger(input.calendar.days) && input.calendar.days >= 1 && input.calendar.days <= 30, "日历配置无效");
      return { version: 1, theme: { mode: input.theme.mode, accent: input.theme.accent }, profiles,
        calendar: { enabled: input.calendar.enabled, days: input.calendar.days } };
    }
    if (key === "calendar") {
      assert(Array.isArray(input.items), "日历缓存格式无效");
      return { version: 1, updatedAt: input.updatedAt === null ? null : iso(input.updatedAt, "日历更新时间"),
        items: input.items.map(item => {
          const result = { title: str(item.title, "日程标题") || "未命名日程",
            start: iso(item.start, "日程开始时间"), end: iso(item.end, "日程结束时间"), allDay: item.allDay === undefined ? false : item.allDay };
          assert(typeof result.allDay === "boolean" && Date.parse(result.end) >= Date.parse(result.start), "日历结束时间或全天标记无效");
          return result;
        }) };
    }
    throw new Error("未知数据类型");
  }
  function empty(key) {
    if (key === "settings") return defaults();
    if (key === "countdowns") return { events: [], defaultId: null };
    if (key === "calendar") return { version: 1, updatedAt: null, items: [] };
    return key === "trains" ? { version: 1, items: [], hideEnded: true } : { version: 1, items: [] };
  }
  function parcels(data) { return data.items.filter(p => p.status === "pending").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)); }
  function trains(data, now = Date.now()) {
    return data.items.filter(t => !data.hideEnded || instant(t.endDate || t.date, t.endTime || t.time, t.offset) >= now)
      .sort((a, b) => instant(a.date, a.time, a.offset) - instant(b.date, b.time, b.offset));
  }
  function countdowns(data, now = new Date()) {
    return data.events.map(event => ({ ...event, days: daysUntil(event.date, now) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  function importItems(key, input, uuid, now) {
    const array = Array.isArray(input) ? input : input?.items;
    assert(Array.isArray(array), "请提供 JSON 数组或含 items 的对象");
    const normalize = key === "parcels" ? normalizeParcel : normalizeTrain;
    return unique(array.map(item => normalize(item, uuid(), now)));
  }
  function mergeItems(current, incoming) {
    const ids = new Set(current.map(item => item.id));
    assert(!incoming.some(item => ids.has(item.id)), "导入 ID 与已有记录冲突，未写入任何记录");
    return [...current, ...incoming];
  }
  function validateBackup(input) {
    assert(input && input.format === "scriptable-info-backup" && input.version === 1 && input.data, "备份格式或版本无效");
    const data = {};
    for (const key of ["parcels", "trains", "countdowns", "settings"]) {
      assert(own(input.data, key), `备份缺少 ${key}`); data[key] = validate(key, input.data[key]);
    }
    return data;
  }
  function truncate(value, count) { const chars = Array.from(String(value || "")); return chars.length > count ? chars.slice(0, count - 1).join("") + "…" : chars.join(""); }
  // 点数预算使用保守的小号高度；每行固定单行，禁止自动撑高卡片。
  function metrics(family) {
    return family === "large" ? { height: 248, font: 12, gap: 5, header: 21, row: 18, maxModules: 4 }
      : family === "medium" ? { height: 78, font: 11, gap: 4, header: 18, row: 17, maxModules: 2, columns: 2 }
        : { height: 78, font: 11, gap: 4, header: 18, row: 17, maxModules: 1 };
  }
  function planLayout(sections, family) {
    const m = { ...metrics(family) }, chosen = sections.slice(0, m.maxModules);
    if (chosen.length <= 1) delete m.columns;
    if (m.columns === 2) {
      const plans = chosen.map(s => {
        const rows = []; let used = m.header + 8;
        for (const row of s.rows.slice(0, s.maxItems)) {
          const cost = m.row * (row.lines === 2 ? 2 : 1);
          if (used + cost > m.height) break;
          rows.push(row); used += cost;
        }
        return { ...s, rows, hidden: s.rows.length - rows.length, used };
      });
      return { plans, omittedModules: sections.length - plans.length, used: Math.max(0, ...plans.map(p => p.used)), metrics: m };
    }
    const minimumCost = () => chosen.reduce((sum, s) => sum + m.header + 8
      + (s.rows.length ? m.row * (s.rows[0].lines === 2 ? 2 : 1) : 0), 0) + Math.max(0, chosen.length - 1) * m.gap;
    // 至少保留每个卡片的一条有效内容；不足时减少模块，避免只剩标题。
    while (chosen.length > 1 && minimumCost() > m.height) chosen.pop();
    const plans = chosen.map(s => ({ ...s, rows: [], hidden: s.rows.length }));
    const headerCost = plans.length * (m.header + 8) + Math.max(0, plans.length - 1) * m.gap;
    let remaining = Math.max(0, m.height - headerCost);
    // 先给每个模块一行，再按顺序分配额外空间。
    for (let round = 0; round < 20; round++) {
      for (let i = 0; i < plans.length; i++) {
        const row = chosen[i].rows[round];
        const cost = m.row * (row?.lines === 2 ? 2 : 1);
        if (round < Math.min(chosen[i].maxItems, chosen[i].rows.length) && remaining >= cost) {
          plans[i].rows.push(row); plans[i].hidden--; remaining -= cost;
        }
      }
    }
    return { plans, omittedModules: sections.length - plans.length, used: m.height - remaining, metrics: m };
  }
  // Dashboard 用更清晰的字号层级和分区分隔线；独立列表保留原布局。
  function planDashboard(sections, family, warning = false) {
    const large = family === "large", medium = family === "medium";
    const metrics = { budget: (large ? 211 : medium ? 66 : 60) - (warning ? 15 : 0),
      header: large ? 16 : 14, gap: large ? 8 : 16, maxModules: large ? 4 : medium ? 2 : 1,
      columns: medium ? 2 : 1 };
    const cost = row => row.lines === 2 ? 32 : 21;
    const chosen = sections.slice(0, metrics.maxModules);
    const plans = chosen.map(section => ({ ...section, rows: [], hidden: section.rows.length }));
    if (metrics.columns === 2) {
      for (let i = 0; i < plans.length; i++) {
        let remaining = metrics.budget - metrics.header;
        for (const row of chosen[i].rows.slice(0, chosen[i].maxItems)) {
          if (cost(row) > remaining) break;
          plans[i].rows.push(row); plans[i].hidden--; remaining -= cost(row);
        }
      }
    } else {
      // 先确保每个分区至少有一条内容，再分配剩余空间。
      const required = () => chosen.slice(0, plans.length).reduce((sum, section) => sum + metrics.header
        + (section.rows.length ? cost(section.rows[0]) : 0), 0) + Math.max(0, plans.length - 1) * metrics.gap;
      while (plans.length > 1 && required() > metrics.budget) plans.pop();
      let remaining = metrics.budget - plans.length * metrics.header - Math.max(0, plans.length - 1) * metrics.gap;
      for (let round = 0; round < 20; round++) {
        for (let i = 0; i < plans.length; i++) {
          const row = chosen[i].rows[round];
          if (row && round < chosen[i].maxItems && cost(row) <= remaining) {
            plans[i].rows.push(row); plans[i].hidden--; remaining -= cost(row);
          }
        }
      }
    }
    const heights = plans.map(section => metrics.header + section.rows.reduce((sum, row) => sum + cost(row), 0));
    const used = metrics.columns === 2 ? Math.max(0, ...heights)
      : heights.reduce((a, b) => a + b, 0) + Math.max(0, plans.length - 1) * metrics.gap;
    return { plans, metrics, used, omittedModules: sections.length - plans.length };
  }
  return { clone, assert, str, dateParts, instant, daysUntil, dayText, normalizeParcel, normalizeTrain,
    validate, empty, defaults, parcels, trains, countdowns, importItems, mergeItems, validateBackup,
    truncate, metrics, planLayout, planDashboard, moduleIds };
})();

// Dashboard 专用呈现层：整张面板、留白和分隔线，保留原独立列表样式。
function renderInfoDashboard({ sections, settings, family, urlFor, warning, now = new Date() }) {
  const L = InfoLogic, large = family === "large", small = family === "small";
  const mode = settings.theme.mode;
  const adaptive = (light, dark) => mode === "system" ? Color.dynamic(new Color(light), new Color(dark)) : new Color(mode === "dark" ? dark : light);
  const colors = { background: adaptive("#F7F6F2", "#15191D"), text: adaptive("#202A33", "#F1F3F5"),
    muted: adaptive("#67727B", "#A1ABB4"), line: adaptive("#E0E2DF", "#30373D"),
    accent: new Color(settings.theme.accent), tint: new Color(settings.theme.accent, 0.10) };
  const widget = new ListWidget(); widget.backgroundColor = colors.background;
  widget.setPadding(large ? 16 : 12, large ? 18 : 12, large ? 16 : 12, large ? 18 : 12);
  widget.url = urlFor("dashboard"); widget.refreshAfterDate = new Date(Date.now() + 30 * 60000);
  const text = (stack, value, size, color = colors.text, weight = "regular") => {
    const label = stack.addText(String(value));
    label.font = weight === "rounded" ? Font.boldRoundedSystemFont(size)
      : weight === "medium" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
    label.textColor = color; label.lineLimit = 1; label.minimumScaleFactor = 0.75;
    return label;
  };
  const horizontal = (parent, height) => {
    const stack = parent.addStack(); stack.layoutHorizontally(); stack.centerAlignContent(); stack.size = new Size(0, height); return stack;
  };
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日`, weekday = `星期${"日一二三四五六"[now.getDay()]}`;
  const header = horizontal(widget, large ? 42 : 28);
  if (large) {
    const date = header.addStack(); date.layoutVertically();
    text(date, dateLabel, 23, colors.text, "medium"); date.addSpacer(2);
    text(date, `${weekday} · 今日概览`, 10, colors.muted);
  } else {
    text(header, dateLabel, small ? 17 : 19, colors.text, "medium");
    header.addSpacer(7); text(header, weekday, 9, colors.muted);
  }
  header.addSpacer();
  const parcelCount = sections.find(section => section.id === "parcels")?.count || 0;
  if (!small && parcelCount) {
    const badge = header.addStack(); badge.layoutHorizontally(); badge.centerAlignContent();
    badge.setPadding(5, 8, 5, 8); badge.cornerRadius = 8; badge.backgroundColor = colors.tint;
    text(badge, `${parcelCount} 件待取`, 10, colors.accent, "medium");
  }
  widget.addSpacer(large ? 10 : 8);
  if (warning) { text(widget, "配置异常 · 使用有效快照", 9, colors.muted); widget.addSpacer(3); }
  if (!sections.length) {
    widget.addSpacer(); text(widget, "暂无信息", large ? 22 : 17, colors.text, "medium");
    widget.addSpacer(5); text(widget, "点按添加快递、行程或重要日期", small ? 9 : 11, colors.muted);
    widget.addSpacer(); return widget;
  }
  const layout = L.planDashboard(sections, family, Boolean(warning));
  const columnMode = family === "medium" && layout.plans.length > 1;
  let columns = widget;
  if (columnMode) { columns = widget.addStack(); columns.layoutHorizontally(); }
  const symbols = { parcels: "shippingbox", trains: "tram", calendar: "calendar", countdowns: "flag" };
  function renderRow(parent, section, row) {
    if (row.kind === "parcel") {
      const line = horizontal(parent, 21);
      const code = line.addStack(); code.size = new Size(small || columnMode ? 52 : 66, 0);
      text(code, L.truncate(row.code, 12), large ? 17 : 14, colors.text, "rounded");
      line.addSpacer(8);
      text(line, L.truncate(row.company, small || columnMode ? 8 : 16), large ? 13 : 10, colors.muted);
      if (large && row.station) { line.addSpacer(); text(line, L.truncate(row.station, 8), 10, colors.muted); }
      return;
    }
    if (row.kind === "countdown") {
      const line = horizontal(parent, 21);
      text(line, L.truncate(row.name, small || columnMode ? 7 : 18), large ? 13 : 10);
      line.addSpacer();
      const pill = line.addStack(); pill.layoutHorizontally(); pill.centerAlignContent();
      if (large) { pill.setPadding(2, 6, 2, 6); pill.cornerRadius = 5; pill.backgroundColor = row.days < 0 ? colors.line : colors.tint; }
      const value = row.days === 0 ? "今天" : row.days < 0 ? `已过 ${-row.days} 天` : `${row.days} 天`;
      text(pill, value, large ? 12 : 10, row.days < 0 ? colors.muted : colors.accent, "medium");
      return;
    }
    if (row.lines === 2) {
      const item = parent.addStack(); item.layoutVertically(); item.size = new Size(0, 32);
      const route = horizontal(item, 17);
      text(route, L.truncate(row.main, small || columnMode ? 18 : 36), large ? 13 : 10, colors.text, "medium");
      const details = horizontal(item, 15);
      text(details, L.truncate(row.detail, small || columnMode ? 24 : 45), large ? 10 : 9, colors.muted);
      return;
    }
    const line = horizontal(parent, 21);
    text(line, L.truncate(row.main, small || columnMode ? 18 : 36), large ? 13 : 10, row.status ? colors.muted : colors.text);
    if (large && row.detail) { line.addSpacer(); text(line, L.truncate(row.detail, 12), 10, colors.muted); }
  }
  for (let i = 0; i < layout.plans.length; i++) {
    const section = layout.plans[i];
    if (i) {
      if (columnMode) columns.addSpacer(16);
      else {
        widget.addSpacer(3.5);
        const divider = widget.addStack(); divider.size = new Size(0, 1); divider.backgroundColor = colors.line;
        widget.addSpacer(3.5);
      }
    }
    const group = columns.addStack(); group.layoutVertically();
    if (columnMode) {
      const width = Math.max(108, Math.min(155, (Device.screenSize().width - 96) / 2));
      group.size = new Size(width, 0);
    }
    if (!small) group.url = urlFor(section.id);
    const heading = horizontal(group, layout.metrics.header);
    try { const icon = heading.addImage(SFSymbol.named(symbols[section.id]).image); icon.imageSize = new Size(11, 11); icon.tintColor = colors.muted; heading.addSpacer(5); } catch (_) { /* 无此 SF Symbol 时保留标题 */ }
    text(heading, section.title, large ? 10 : 9, colors.muted, "medium");
    heading.addSpacer();
    if (section.hidden) text(heading, `另 ${section.hidden} 条`, 8, colors.muted);
    else if (section.count) text(heading, section.count, 9, colors.muted);
    for (const row of section.rows) renderRow(group, section, row);
  }
  widget.addSpacer();
  const footer = horizontal(widget, 12);
  text(footer, layout.omittedModules ? `还有 ${layout.omittedModules} 个分组 · 点按查看` : small ? "点按管理" : "点按分区管理", 8, colors.muted);
  return widget;
}

// Scriptable 运行层。公共逻辑打包到每个独立脚本，不需要手机安装依赖。
function createInfoSuite() {
  const L = InfoLogic;
  const fm = FileManager.local();
  const root = fm.joinPath(fm.documentsDirectory(), "scriptable-info-data");
  fm.createDirectory(root, true);
  const labels = { parcels: "待取快递", trains: "近期出行", calendar: "日程", countdowns: "重要倒计时" };
  const symbols = { parcels: "shippingbox.fill", trains: "tram.fill", calendar: "calendar", countdowns: "flag.fill" };
  const files = { parcels: "parcels.json", trains: "trains.json", settings: "dashboard.json", calendar: "calendar-cache.json" };
  const pathFor = key => key === "countdowns"
    ? fm.joinPath(fm.documentsDirectory(), "scriptable-countdown-events.json") : fm.joinPath(root, files[key]);
  const uuid = () => UUID.string();
  const nowISO = () => new Date().toISOString();
  let activeProfile = "default";
  let runningKind = "dashboard";

  function read(key) {
    const path = pathFor(key);
    if (!fm.fileExists(path)) return { data: L.empty(key), warning: "", readOnly: false };
    try {
      const data = L.validate(key, JSON.parse(fm.readString(path)));
      // 为旧倒计时文件和此前有效数据保留最后一次通过校验的快照。
      try { fm.writeString(path + ".last-good", JSON.stringify(data)); } catch (_) { /* 只读文件仍可展示 */ }
      return { data, warning: "", readOnly: false };
    } catch (_) {
      try {
        const data = L.validate(key, JSON.parse(fm.readString(path + ".last-good")));
        return { data, warning: "原文件损坏，显示上次有效数据", readOnly: true };
      } catch (_) {
        return { data: L.empty(key), warning: "数据文件损坏，请从备份恢复", readOnly: true };
      }
    }
  }
  function editable(key) {
    const state = read(key);
    L.assert(!state.readOnly, `${labels[key] || "配置"}文件损坏，原文件已保留。请在备份与恢复菜单恢复后再修改。`);
    return state.data;
  }
  function write(key, value, recovering = false) {
    const data = L.validate(key, value), path = pathFor(key), json = JSON.stringify(data, null, 2);
    if (!recovering) editable(key);
    // 写入预备文件失败时不触碰原文件；最后有效快照支持下次启动容错。
    fm.writeString(path + ".pending", json);
    if (fm.fileExists(path)) {
      const old = fm.readString(path);
      if (recovering) fm.writeString(path + `.before-restore-${Date.now()}`, old);
      else fm.writeString(path + ".last-good", JSON.stringify(L.validate(key, JSON.parse(old))));
    }
    fm.writeString(path, json);
    fm.writeString(path + ".last-good", json);
    try { fm.remove(path + ".pending"); } catch (_) { /* 可在下次保存覆盖 */ }
    return data;
  }
  async function notify(title, detail) {
    if (!config.runsInApp) return;
    const alert = new Alert(); alert.title = title; alert.message = detail;
    alert.addAction("好的"); await alert.presentAlert();
  }
  async function choose(title, actions, detail = "") {
    L.assert(config.runsInApp, "交互仅能在 Scriptable App 内进行");
    const alert = new Alert(); alert.title = title; alert.message = detail;
    actions.forEach(action => alert.addAction(action)); alert.addCancelAction("返回");
    return await alert.presentSheet();
  }
  async function confirm(title, detail) {
    const alert = new Alert(); alert.title = title; alert.message = detail;
    alert.addDestructiveAction("确认"); alert.addCancelAction("取消");
    return await alert.presentAlert() === 0;
  }
  async function fields(title, specs, detail = "") {
    const alert = new Alert(); alert.title = title; alert.message = detail;
    specs.forEach(([label, value]) => alert.addTextField(label, value || ""));
    alert.addAction("保存"); alert.addCancelAction("取消");
    if (await alert.presentAlert() < 0) return null;
    return specs.map((_, i) => alert.textFieldValue(i).trim());
  }
  async function guarded(action) {
    try { await action(); } catch (error) { await notify("操作未完成", String(error.message || error)); }
  }
  async function pickRecord(key) {
    const data = editable(key), items = key === "countdowns" ? data.events : data.items;
    if (!items.length) { await notify("暂无记录", "请先添加记录。"); return null; }
    // 分页不限制保存数量，避免 Alert 一次塞入大量按钮。
    let page = 0;
    while (true) {
      const slice = items.slice(page * 15, page * 15 + 15);
      const titleFor = item => key === "parcels" ? `${item.status === "collected" ? "已取 · " : ""}${item.company} · ${item.code}`
        : key === "trains" ? `${item.date} ${item.number} ${item.from}→${item.to}` : `${item.name} · ${item.date}`;
      const actions = slice.map(item => L.truncate(titleFor(item), 44));
      if ((page + 1) * 15 < items.length) actions.push("下一页");
      if (page > 0) actions.push("上一页");
      const result = await choose("选择记录", actions, `第 ${page + 1} 页，共 ${items.length} 条`);
      if (result < 0) return null;
      if (result < slice.length) return slice[result];
      if (actions[result] === "下一页") page++; else page--;
    }
  }
  async function editParcel(existing) {
    let values = existing ? [existing.company, existing.code, existing.station, existing.note] : ["", "", "", ""];
    while (true) {
      const input = await fields(existing ? "编辑快递" : "新增快递", ["快递公司/来源", "取件码", "驿站名称（可选）", "备注（可选）"].map((s, i) => [s, values[i]]));
      if (!input) return;
      values = input;
      try {
        const record = L.normalizeParcel({ ...existing, company: input[0], code: input[1], station: input[2], note: input[3] }, uuid(), nowISO());
        const data = editable("parcels");
        data.items = existing ? data.items.map(p => p.id === existing.id ? record : p) : [...data.items, record];
        write("parcels", data); return;
      } catch (error) { await notify("请检查输入", error.message); }
    }
  }
  async function editTrain(existing) {
    const keys = ["number", "date", "time", "from", "to", "seat", "endDate", "endTime", "offset", "note"];
    const names = ["车次", "出发日期 YYYY-MM-DD", "出发时间 HH:mm", "出发站", "到达站", "席别/座位（可选）", "到达日期（可选）", "到达时间（可选）", "时区，例如 +08:00 或 local", "备注（可选）"];
    let values = keys.map(key => existing?.[key] || (key === "offset" ? "+08:00" : ""));
    while (true) {
      const input = await fields(existing ? "编辑火车票" : "新增火车票", names.map((s, i) => [s, values[i]]), "到达日期和时间一起填；不填时以出发时刻作为隐藏阈值。中国车票建议使用 +08:00。");
      if (!input) return;
      values = input;
      try {
        const raw = { ...existing }; keys.forEach((key, i) => raw[key] = input[i]);
        const record = L.normalizeTrain(raw, uuid(), nowISO()), data = editable("trains");
        data.items = existing ? data.items.map(t => t.id === existing.id ? record : t) : [...data.items, record];
        write("trains", data); return;
      } catch (error) { await notify("请检查输入", error.message); }
    }
  }
  async function editCountdown(existing) {
    let values = [existing?.name || "", existing?.date || "", existing?.text || ""];
    while (true) {
      const input = await fields(existing ? "编辑倒计时" : "新增倒计时", ["事件名称", "日期 YYYY-MM-DD", "显示文案（可选）"].map((s, i) => [s, values[i]]), "与原 countdown 共用事件数据，按设备本地日历日期计数。");
      if (!input) return;
      values = input;
      try {
        const data = editable("countdowns"), event = { id: existing?.id || uuid(), name: input[0], date: input[1], text: input[2] };
        data.events = existing ? data.events.map(e => e.id === existing.id ? event : e) : [...data.events, event];
        if (!data.defaultId) data.defaultId = event.id;
        write("countdowns", data); return;
      } catch (error) { await notify("请检查输入", error.message); }
    }
  }
  async function readImport() {
    const method = await choose("导入 JSON", ["粘贴 JSON", "选择 JSON 文件"]);
    if (method < 0) return null;
    let content;
    if (method === 0) {
      const input = await fields("粘贴 JSON", [["完整 JSON 内容", ""]]);
      if (!input) return null; content = input[0];
    } else {
      const paths = await DocumentPicker.open(["public.json", "public.plain-text"]);
      if (!paths?.length) return null;
      const fileManager = fm.isFileStoredIniCloud(paths[0]) ? FileManager.iCloud() : fm;
      await fileManager.downloadFileFromiCloud(paths[0]);
      content = fileManager.readString(paths[0]);
    }
    try {
      const parsed = JSON.parse(content);
      L.assert(parsed !== null && typeof parsed === "object", "JSON 内容必须是对象或数组");
      return parsed;
    } catch (_) { throw new Error("JSON 格式不正确，须为对象或数组；未写入任何数据。"); }
  }
  async function importRecords(key) {
    const input = await readImport(); if (input === null) return;
    const incoming = L.importItems(key, input, uuid, nowISO()), data = editable(key);
    if (!incoming.length) { await notify("没有可导入的记录", "JSON 数组为空。"); return; }
    data.items = L.mergeItems(data.items, incoming);
    if (!await confirm(`导入 ${incoming.length} 条记录？`, "将追加到已有数据，所有记录先校验再写入。")) return;
    write(key, data); await notify("导入完成", `已添加 ${incoming.length} 条记录。`);
  }
  async function deleteRecord(key, record) {
    if (!await confirm("删除这条记录？", "删除后可通过此前导出的备份恢复。")) return;
    const data = editable(key);
    if (key === "countdowns") {
      data.events = data.events.filter(e => e.id !== record.id);
      if (data.defaultId === record.id) data.defaultId = data.events[0]?.id || null;
    } else data.items = data.items.filter(item => item.id !== record.id);
    write(key, data);
  }
  async function addToCalendar(ticket) {
    if (!await confirm("添加到 iOS 日历？", "会请求日历权限并创建独立日程。重复操作会产生重复日程；之后修改车票不会自动同步日历。")) return;
    const calendars = (await Calendar.forEvents()).filter(c => c.allowsContentModifications);
    L.assert(calendars.length, "没有可写入的日历，请检查日历权限。");
    const index = await choose("选择日历", calendars.map(c => c.title)); if (index < 0) return;
    const event = new CalendarEvent();
    event.title = `${ticket.number} ${ticket.from}→${ticket.to}`;
    event.startDate = new Date(L.instant(ticket.date, ticket.time, ticket.offset));
    event.endDate = new Date(ticket.endDate ? L.instant(ticket.endDate, ticket.endTime, ticket.offset) : event.startDate.getTime() + 3600000);
    event.location = ticket.from; event.notes = [ticket.seat, ticket.note].filter(Boolean).join("\n");
    event.calendar = calendars[index]; await event.save();
    await notify("已添加日历", "车票记录仍保存在本地；日历内容可能由系统按你的账户设置同步。");
  }
  async function manage(key) {
    const editor = key === "parcels" ? editParcel : key === "trains" ? editTrain : editCountdown;
    while (true) {
      const actions = ["新增记录", "选择记录（编辑、删除等）", "预览组件"];
      if (key !== "countdowns") actions.push("批量导入 JSON");
      if (key === "trains") actions.push("切换已结束行程显示");
      actions.push("数据备份与恢复");
      const result = await choose(`${labels[key]}管理`, actions);
      if (result < 0) return;
      await guarded(async () => {
        if (result === 0) return await editor(null);
        if (result === 2) return await preview(key);
        if (actions[result] === "批量导入 JSON") return await importRecords(key);
        if (actions[result] === "数据备份与恢复") return await backupMenu();
        if (actions[result] === "切换已结束行程显示") {
          const data = editable(key); data.hideEnded = !data.hideEnded; write(key, data);
          return await notify("显示设置已保存", data.hideEnded ? "隐藏已结束行程。未填写到达时间时，以出发时刻作为结束阈值。" : "显示全部行程。");
        }
        const record = await pickRecord(key); if (!record) return;
        const ops = ["编辑", "删除"];
        if (key === "parcels") ops.push(record.status === "pending" ? "标记已取件" : "恢复为待取件");
        if (key === "trains") ops.push("添加到 iOS 日历");
        if (key === "countdowns") ops.push("设为原单事件组件默认事件");
        const op = await choose("记录操作", ops);
        if (op === 0) await editor(record);
        if (op === 1) await deleteRecord(key, record);
        if (op === 2 && key === "parcels") {
          const data = editable(key), item = data.items.find(p => p.id === record.id);
          item.status = item.status === "pending" ? "collected" : "pending"; write(key, data);
        }
        if (op === 2 && key === "trains") await addToCalendar(record);
        if (op === 2 && key === "countdowns") { const data = editable(key); data.defaultId = record.id; write(key, data); }
      });
    }
  }
  async function calendarMenu() {
    const settings = editable("settings");
    const action = await choose("日历设置", [settings.calendar.enabled ? "关闭日历读取" : "启用日历并授权读取", "刷新本地日历缓存", "设置读取天数"], "日历默认关闭。小组件只展示缓存，App 内授权/刷新后更新；不在组件中请求权限。");
    if (action === 0) {
      settings.calendar.enabled = !settings.calendar.enabled;
      for (const profile of Object.values(settings.profiles)) profile.modules.find(m => m.id === "calendar").enabled = settings.calendar.enabled;
      write("settings", settings);
      if (settings.calendar.enabled) await refreshCalendar(true);
      else write("calendar", L.empty("calendar"), true);
    }
    if (action === 1) await refreshCalendar(true);
    if (action === 2) {
      const input = await fields("读取天数", [["1—30", String(settings.calendar.days)]]); if (!input) return;
      settings.calendar.days = Number(input[0]); write("settings", settings);
      if (settings.calendar.enabled) await refreshCalendar(true);
    }
  }
  async function refreshCalendar(force = false) {
    if (!config.runsInApp) return;
    const settings = read("settings").data; if (!settings.calendar.enabled) return;
    const cached = read("calendar");
    if (!force && cached.data.updatedAt && Date.now() - Date.parse(cached.data.updatedAt) < 15 * 60000) return;
    const start = new Date(), end = new Date(start); end.setDate(end.getDate() + settings.calendar.days);
    try {
      const events = await CalendarEvent.between(start, end);
      const items = events.map(e => ({ title: e.title || "未命名日程", start: e.startDate.toISOString(), end: e.endDate.toISOString(), allDay: e.isAllDay }));
      write("calendar", { version: 1, updatedAt: nowISO(), items });
    } catch (_) {
      await notify("日历刷新失败", "请检查 Scriptable 的日历权限。原缓存已保留，其他模块不受影响。");
    }
  }
  function backupObject() {
    const data = {};
    for (const key of ["parcels", "trains", "countdowns", "settings"]) {
      const state = read(key); L.assert(!state.readOnly, "存在损坏文件，不能导出不完整的备份。请先恢复有效快照。"); data[key] = state.data;
    }
    return { format: "scriptable-info-backup", version: 1, exportedAt: nowISO(), data };
  }
  function restoreBackup(input) {
    const data = L.validateBackup(input), before = new Map();
    // 全部校验成功后才写；保存原文件及快照，写入失败时回滚已改文件。
    for (const key of Object.keys(data)) {
      for (const path of [pathFor(key), pathFor(key) + ".last-good"]) before.set(path, fm.fileExists(path) ? fm.readString(path) : null);
    }
    try { for (const key of Object.keys(data)) write(key, data[key], true); }
    catch (error) {
      const failed = [];
      for (const [path, original] of before) {
        try { if (original === null) { if (fm.fileExists(path)) fm.remove(path); } else fm.writeString(path, original); }
        catch (_) { failed.push(path.split("/").pop()); }
      }
      throw new Error(failed.length ? `恢复失败，回滚部分失败：${failed.join("、")}。原文件另有 before-restore 副本。` : "恢复失败，原文件已回滚。");
    }
  }
  async function backupMenu() {
    const action = await choose("数据备份与恢复", ["导出全部数据为 JSON 文件", "从 JSON 恢复全部数据", "恢复损坏文件的有效快照"], "备份包含私人数据，仅在你选择的位置保存。恢复会替换全部数据，原文件保留恢复前副本。");
    if (action === 0) await DocumentPicker.exportString(JSON.stringify(backupObject(), null, 2), "信息组件备份.json");
    if (action === 1) {
      const input = await readImport(); if (input === null) return;
      L.validateBackup(input);
      if (!await confirm("替换全部本地数据？", "会替换快递、车票、倒计时和面板配置；原文件保留恢复前副本。")) return;
      restoreBackup(input); await notify("恢复完成", "本地记录和配置已恢复。");
    }
    if (action === 2) {
      const keys = ["parcels", "trains", "countdowns", "settings", "calendar"];
      const index = await choose("选择要恢复的文件", keys.map(k => labels[k] || "面板配置")); if (index < 0) return;
      const key = keys[index], path = pathFor(key);
      L.assert(fm.fileExists(path + ".last-good"), "没有可恢复的有效快照，请导入备份。");
      const data = L.validate(key, JSON.parse(fm.readString(path + ".last-good")));
      if (await confirm("恢复有效快照？", "原文件会保留副本；快照可能不包含最近的修改。")) write(key, data, true);
    }
  }
  async function selectProfile() {
    const index = await choose("选择面板配置", ["默认面板", "紧凑面板"]);
    return index < 0 ? null : index === 0 ? "default" : "compact";
  }
  async function configureModules(orderOnly = false) {
    const name = await selectProfile(); if (!name) return;
    while (true) {
      const data = editable("settings"), profile = data.profiles[name];
      const actions = profile.modules.map(m => `${m.enabled ? "✓" : "○"} ${labels[m.id]} · 最多 ${m.maxItems} 条`);
      if (!orderOnly) actions.push(profile.hideEmpty ? "空模块：自动隐藏（点击切换）" : "空模块：展示（点击切换）", "日历授权与缓存设置");
      const index = await choose(orderOnly ? "调整模块顺序" : "配置显示模块", actions);
      if (index < 0) return;
      if (index === profile.modules.length) { profile.hideEmpty = !profile.hideEmpty; write("settings", data); continue; }
      if (index === profile.modules.length + 1) { await calendarMenu(); continue; }
      const module = profile.modules[index];
      if (orderOnly) {
        const place = await choose("移到第几位？", profile.modules.map((m, i) => `${i + 1} · ${labels[m.id]}`));
        if (place >= 0) { profile.modules.splice(index, 1); profile.modules.splice(place, 0, module); write("settings", data); }
      } else {
        const action = await choose(labels[module.id], [module.enabled ? "禁用模块" : "启用模块", "最大展示条数"]);
        if (action === 0) { module.enabled = !module.enabled; write("settings", data); }
        if (action === 1) {
          const input = await fields("最大展示条数", [["1—20，实际显示受组件尺寸限制", String(module.maxItems)]]);
          if (input) { module.maxItems = Number(input[0]); write("settings", data); }
        }
      }
    }
  }
  async function themeMenu() {
    const data = editable("settings");
    const mode = await choose("主题模式", ["跟随系统", "浅色", "深色"]); if (mode < 0) return;
    const input = await fields("主题强调色", [["六位 HEX，例如 #007AFF", data.theme.accent]]); if (!input) return;
    data.theme = { mode: ["system", "light", "dark"][mode], accent: input[0] }; write("settings", data);
  }
  function palette(theme) {
    const dynamic = (light, dark) => theme.mode === "system" ? Color.dynamic(new Color(light), new Color(dark)) : new Color(theme.mode === "dark" ? dark : light);
    return { background: dynamic("#F2F2F7", "#000000"), card: dynamic("#FFFFFF", "#1C1C1E"),
      text: dynamic("#1C1C1E", "#FFFFFF"), secondary: dynamic("#636366", "#AEAEB2"), accent: new Color(theme.accent) };
  }
  function link(action) {
    // 指向当前脚本，无需假设其他脚本安装或命名；入口也会转发 queryParameters。
    const scripts = { dashboard: "dashboard", parcels: "parcel-list", trains: "train-tickets", countdowns: "countdown-list" };
    const parameter = scripts[runningKind] + (runningKind === "dashboard" ? `|${activeProfile}` : "");
    return `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}&remoteScript=${encodeURIComponent(parameter)}&infoAction=${encodeURIComponent(action)}`;
  }
  function section(key, settings, now = new Date()) {
    const state = read(key), data = state.data; let rows = [], hint = state.warning;
    const providers = {
      parcels: value => L.parcels(value).map(p => ({ main: `${p.code}  ${p.company}`, detail: [p.station, p.note].filter(Boolean).join(" · "), kind: "parcel", code: p.code, company: p.company, station: p.station })),
      trains: value => L.trains(value, now.getTime()).map(t => ({ main: `${t.date.slice(5).replace("-", "/")} ${t.from}→${t.to}`, detail: `${t.number} · ${t.time} · ${t.seat || "座位未填"}`, lines: 2 })),
      countdowns: value => L.countdowns(value, now).map(e => ({ main: `${e.name}：${L.dayText(e.days)}`, detail: e.date, kind: "countdown", name: e.name, days: e.days })),
    };
    if (providers[key]) rows = providers[key](data);
    if (key === "calendar") {
      if (!settings.calendar.enabled) hint = "未启用日历，请在 App 内授权";
      else {
        const end = new Date(now); end.setDate(end.getDate() + settings.calendar.days);
        rows = data.items.filter(e => Date.parse(e.end) >= now.getTime() && Date.parse(e.start) <= end.getTime())
          .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).map(e => {
            const date = new Date(e.start), pad = n => String(n).padStart(2, "0");
            return { main: `${date.getMonth() + 1}/${date.getDate()} ${e.title}`, detail: e.allDay ? "全天" : `${pad(date.getHours())}:${pad(date.getMinutes())}` };
          });
        if (!data.updatedAt) hint = "请在 App 内刷新日历缓存";
        else if (now.getTime() - Date.parse(data.updatedAt) > 24 * 3600000) hint = "日历缓存超过一天，请刷新";
      }
    }
    if (hint) rows = [{ main: hint, detail: "", status: true }, ...rows];
    return { id: key, title: labels[key], count: key === "parcels" ? L.parcels(data).length : rows.length - (hint ? 1 : 0), rows, warning: Boolean(hint), maxItems: 20 };
  }
  function addText(stack, value, font, color) {
    const text = stack.addText(value); text.font = font; text.textColor = color;
    text.lineLimit = 1; text.minimumScaleFactor = 0.8; return text;
  }
  function renderSection(widget, section, m, colors, family) {
    const card = widget.addStack(); card.layoutVertically(); card.setPadding(4, 9, 4, 9);
    if (m.columns === 2) card.size = new Size(120, 0);
    card.backgroundColor = colors.card; card.cornerRadius = 12;
    if (family !== "small") card.url = link(section.id);
    const header = card.addStack(); header.layoutHorizontally(); header.centerAlignContent(); header.size = new Size(0, m.header);
    try { const icon = header.addImage(SFSymbol.named(symbols[section.id]).image); icon.imageSize = new Size(13, 13); icon.tintColor = colors.accent; header.addSpacer(5); } catch (_) { /* 系统没有此符号时保留文字 */ }
    addText(header, `${section.title}${section.count ? ` ${section.count}` : ""}${section.hidden ? ` · 另${section.hidden}条` : ""}`, Font.semiboldSystemFont(m.font), colors.text);
    for (const row of section.rows) {
      if (row.lines === 2) {
        const item = card.addStack(); item.layoutVertically(); item.size = new Size(0, m.row * 2);
        addText(item, L.truncate(row.main, family === "small" ? 20 : 42), Font.systemFont(m.font), colors.text);
        addText(item, L.truncate(row.detail, family === "small" ? 22 : 42), Font.systemFont(m.font - 1), colors.secondary);
        continue;
      }
      const line = card.addStack(); line.layoutHorizontally(); line.centerAlignContent(); line.size = new Size(0, m.row);
      const primary = L.truncate(row.main, family === "small" || m.columns === 2 ? 20 : 42);
      addText(line, primary, Font.systemFont(m.font), colors.text);
      if (row.detail && family !== "small" && m.columns !== 2) { line.addSpacer(6); addText(line, L.truncate(row.detail, 24), Font.systemFont(m.font - 1), colors.secondary); }
    }
  }
  function render(kind, family = config.widgetFamily || "large") {
    const supported = ["small", "medium", "large"].includes(family);
    const settingsState = read("settings"), settings = settingsState.data, colors = palette(settings.theme);
    if (kind === "dashboard" && supported) {
      const profile = settings.profiles[activeProfile];
      const sections = profile.modules.filter(m => m.enabled).map(module => {
        try { return { ...section(module.id, settings), maxItems: module.maxItems }; }
        catch (_) { return { id: module.id, title: labels[module.id], count: 0, rows: [{ main: "此模块暂时不可用", detail: "", status: true }], maxItems: 1, warning: true }; }
      }).filter(s => !profile.hideEmpty || s.rows.length || s.warning)
        .map(s => s.rows.length ? s : { ...s, rows: [{ main: "暂无记录", detail: "", status: true }] });
      return renderInfoDashboard({ sections, settings, family, urlFor: link, warning: settingsState.warning });
    }
    const widget = new ListWidget(); widget.setPadding(10, 12, 10, 12); widget.backgroundColor = colors.background;
    widget.url = link(kind === "dashboard" ? "dashboard" : kind);
    widget.refreshAfterDate = new Date(Date.now() + 30 * 60000);
    const now = new Date(), header = widget.addStack(); header.layoutHorizontally(); header.size = new Size(0, 20);
    addText(header, `${now.getMonth() + 1}月${now.getDate()}日 周${"日一二三四五六"[now.getDay()]}`, Font.semiboldSystemFont(13), colors.text);
    widget.addSpacer(6);
    if (!supported) { addText(widget, "请选择桌面小号、中号或大号组件", Font.systemFont(12), colors.secondary); return widget; }
    if (settingsState.warning) { addText(widget, "配置损坏，使用默认或有效快照", Font.systemFont(10), colors.secondary); widget.addSpacer(3); }
    const sections = [section(kind, settings, now)];
    if (!sections.length || (sections.length === 1 && !sections[0].rows.length)) {
      addText(widget, "暂无信息，点击组件管理数据", Font.systemFont(12), colors.secondary); widget.addSpacer(); return widget;
    }
    for (const s of sections) if (!s.rows.length) s.rows = [{ main: "暂无记录", detail: "" }];
    const layout = L.planLayout(sections, family);
    // 顶部的配置错误提示占用一行，进一步缩减内容预算。
    if (settingsState.warning) {
      for (let i = layout.plans.length - 1; i >= 0; i--) {
        if (layout.plans[i].rows.length) { layout.plans[i].rows.pop(); layout.plans[i].hidden++; break; }
      }
    }
    let container = widget;
    if (layout.metrics.columns === 2 && layout.plans.length > 1) { container = widget.addStack(); container.layoutHorizontally(); }
    layout.plans.forEach((plan, i) => { if (i) container.addSpacer(layout.metrics.columns === 2 ? 8 : layout.metrics.gap); renderSection(container, plan, layout.metrics, colors, family); });
    if (layout.omittedModules) { widget.addSpacer(3); addText(widget, `另有 ${layout.omittedModules} 个模块 · 大号显示更多`, Font.systemFont(9), colors.secondary); }
    widget.addSpacer(); return widget;
  }
  async function preview(kind) {
    const size = await choose("预览尺寸", ["大号", "中号", "小号"]); if (size < 0) return;
    const family = ["large", "medium", "small"][size], widget = render(kind, family);
    await widget[{ large: "presentLarge", medium: "presentMedium", small: "presentSmall" }[family]]();
  }
  async function dashboardMenu() {
    while (true) {
      const action = await choose("信息聚合面板", ["预览聚合组件", "管理快递", "管理火车票", "管理倒计时", "选择显示模块 / 条数", "调整显示顺序", "修改组件主题", "数据备份与恢复", "日历授权与缓存", "切换预览配置（默认/紧凑）"], `当前预览配置：${activeProfile === "default" ? "默认" : "紧凑"}`);
      if (action < 0) return;
      await guarded(async () => {
        if (action === 0) await preview("dashboard");
        if (action >= 1 && action <= 3) await manage(["parcels", "trains", "countdowns"][action - 1]);
        if (action === 4) await configureModules(false);
        if (action === 5) await configureModules(true);
        if (action === 6) await themeMenu();
        if (action === 7) await backupMenu();
        if (action === 8) await calendarMenu();
        if (action === 9) { const profile = await selectProfile(); if (profile) activeProfile = profile; }
      });
    }
  }
  async function receiveParcel() {
    const query = args.queryParameters || {}, shortcut = args.shortcutParameter;
    const hasShortcut = shortcut !== undefined && shortcut !== null && shortcut !== "";
    if (query.action !== "add" && !hasShortcut && !query.payload) return false;
    let raw;
    if (query.payload) { try { raw = JSON.parse(query.payload); } catch (_) { throw new Error("URL payload 不是有效 JSON"); } }
    else if (hasShortcut) {
      try { raw = typeof shortcut === "string" ? JSON.parse(shortcut) : shortcut; } catch (_) { throw new Error("快捷指令输入不是有效 JSON"); }
    } else raw = { company: query.company, code: query.code, station: query.station, note: query.note };
    const items = L.importItems("parcels", Array.isArray(raw) ? raw : [raw], uuid, nowISO());
    if (!items.length) return true;
    const data = editable("parcels"); data.items = L.mergeItems(data.items, items);
    if (await confirm(`添加 ${items.length} 条快递？`, "信息来自快捷指令/URL。确认后仅保存到当前设备，不会发送到 GitHub。")) {
      write("parcels", data); await notify("快递已保存", `已添加 ${items.length} 条待取快递。`);
    }
    return true;
  }
  async function run(kind) {
    runningKind = kind;
    const parameter = String(args.widgetParameter || "").trim();
    let parameterError = "";
    if (kind === "dashboard") {
      if (["", "default", "compact"].includes(parameter)) activeProfile = parameter || "default";
      else parameterError = "面板参数只能为 default 或 compact";
    }
    if (config.runsInWidget) {
      if (parameterError) {
        const widget = new ListWidget(); widget.addText(parameterError); Script.setWidget(widget);
      } else Script.setWidget(render(kind));
    } else if (config.runsInApp) {
      if (parameterError) await notify("参数提示", parameterError);
      const action = args.queryParameters?.infoAction;
      const target = L.moduleIds.includes(action) ? action : kind;
      let received = false;
      if (target === "parcels") await guarded(async () => { received = await receiveParcel(); });
      if (!received) {
        if (target === "calendar") await guarded(calendarMenu);
        else if (target === "dashboard") { await refreshCalendar(); await dashboardMenu(); }
        else await manage(target);
      }
      Script.setWidget(render(kind));
    } else Script.setWidget(render(kind));
    Script.complete();
  }
  // 扩展点：新增模块时在逻辑模块清单、section 数据提供器、renderSection 渲染层注册。
  return { run, read, write, editable, render, section, backupObject, restoreBackup, receiveParcel, refreshCalendar };
}

await createInfoSuite().run("trains");
