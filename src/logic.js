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
    return { version: 1, theme: { mode: "system", accent: "#007AFF" }, background: backgroundDefaults(),
      profiles: { default: { modules, hideEmpty: true }, compact: { modules: modules.map(m => ({ ...m, maxItems: 1 })), hideEmpty: true } },
      calendar: { enabled: false, days: 7 } };
  }
  function backgroundDefaults() {
    return { mode: "theme", text: "light", dim: 0.25, photo: null, transparent: { small: null, medium: null, large: null }, calibration: { small: null, medium: null, large: null } };
  }
  function validateBackground(value) {
    if (value === undefined) return backgroundDefaults(); // 兼容此前保存的配置和备份。
    assert(value && ["theme", "photo", "transparent"].includes(value.mode), "背景模式无效");
    assert(["light", "dark"].includes(value.text) && Number.isFinite(value.dim) && value.dim >= 0 && value.dim <= 0.8, "背景文字或遮罩无效");
    const file = name => { assert(name === null || (typeof name === "string" && /^[a-zA-Z0-9_-]+\.png$/.test(name)), "背景文件名无效"); return name; };
    assert(value.transparent && typeof value.transparent === "object", "透明背景配置无效");
    const transparent = {};
    for (const family of ["small", "medium", "large"]) transparent[family] = file(value.transparent[family]);
    const calibration = {};
    for (const family of ["small", "medium", "large"]) {
      const entry = value.calibration?.[family];
      if (entry === undefined || entry === null) { calibration[family] = null; continue; }
      assert(entry && Number.isInteger(entry.width) && Number.isInteger(entry.height) && entry.width >= 100 && entry.height >= 100
        && entry.width * entry.height <= 24000000 && Number.isInteger(entry.position) && entry.position >= 0
        && entry.position < (family === "small" ? 6 : family === "medium" ? 3 : 2), "背景校准配置无效");
      calibration[family] = { width: entry.width, height: entry.height, position: entry.position, rect: cropRect(entry.rect, entry) };
    }
    return { mode: value.mode, text: value.text, dim: value.dim, photo: file(value.photo), transparent, calibration };
  }
  function cropRect(rect, size) {
    assert(size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0, "图片尺寸无效");
    assert(rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isInteger), "裁剪坐标必须是整数像素");
    assert(rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0 && rect.x + rect.width <= size.width && rect.y + rect.height <= size.height, "裁剪范围超出图片");
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
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
        calendar: { enabled: input.calendar.enabled, days: input.calendar.days }, background: validateBackground(input.background) };
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
    truncate, metrics, planLayout, planDashboard, moduleIds, backgroundDefaults, validateBackground, cropRect };
})();
