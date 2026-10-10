// Variables used by Scriptable.
// icon-color: blue; icon-glyph: calendar-alt;

// 由 tools/build.mjs 生成；请修改 src/ 后重新生成。
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
  // 1900—2100 农历年表，由 Node/ICU 中国历生成；手机运行不依赖 Intl 或网络。
  const lunarYears = [0x4bd8,0x4ae0,0xa570,0x54d5,0xd260,0xd950,0x16554,0x56a0,0x9ad0,0x55d2,0x4ae0,0xa5b6,0xa4d0,0xd250,0x1d255,0xb540,0xd6a0,0x18da3,0x95b0,0x14977,0x4970,0xa4b0,0x1b0b6,0x6a50,0x6d40,0x1ab54,0x2b60,0x9570,0x52f2,0x4970,0x6566,0xd4a0,0xea50,0x16a95,0x5ad0,0x2b60,0x186e3,0x92e0,0x1c8d7,0xc950,0xd4a0,0x1d8a6,0xb550,0x56a0,0x1a5b4,0x25d0,0x92d0,0xd2b2,0xa950,0xb557,0x6ca0,0xb550,0x15355,0x4db0,0x25b0,0x18573,0x52b0,0xa9a8,0xe950,0x6aa0,0xaea6,0xab50,0x4b60,0xaae4,0xa570,0x5260,0xf263,0xd950,0x5b57,0x56a0,0x96d0,0x4dd5,0x4ad0,0xa4d0,0xd4d4,0xd250,0xd558,0xb540,0xb6a0,0x195a6,0x95b0,0x49b0,0xa974,0xa4b0,0xb27a,0x6a50,0x6d40,0x1ad47,0xab60,0x9570,0x4af5,0x4970,0x64b0,0x74a3,0xea50,0x6b58,0x5ac0,0xab60,0x96e5,0x92e0,0xc960,0xd954,0xd4a0,0xda50,0x7552,0x56a0,0xabb7,0x25d0,0x92d0,0xcab5,0xa950,0xb4a0,0xbca4,0xad50,0x55d9,0x4ba0,0xa5b0,0x15176,0x5270,0xa930,0x7954,0x6aa0,0xad50,0x5b52,0x4b60,0xa6e6,0xa4f0,0x5260,0xea65,0xd520,0xdaa0,0x76a3,0x96d0,0x4afb,0x4ad0,0xa4d0,0x1d0b6,0xd250,0xd520,0xdd45,0xb5a0,0x56d0,0x55b2,0x49b0,0xa577,0xa4b0,0xaa50,0x1b255,0x6d20,0xada0,0x14b63,0x9370,0x49f8,0x4970,0x64b0,0x168a6,0xea50,0x6b20,0x1a6c4,0xaae0,0x92e0,0xd2e3,0xc960,0xd557,0xd4a0,0xda50,0x5d55,0x56a0,0xa6d0,0x55d4,0x92d0,0xa9b8,0xa950,0xb4a0,0xb6a6,0xad50,0x55a0,0xaba4,0xa5b0,0x52b0,0xb273,0x6930,0x7337,0x6aa0,0xad50,0x14b55,0x4b60,0xa570,0x54e4,0xd160,0xe968,0xd520,0xdaa0,0x16aa6,0x56d0,0x4ae0,0xa9d4,0xa2d0,0xd150,0xf252,0xd520];
  const pad = n => String(n).padStart(2, "0");
  const dateString = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  function lunarMonths(year) {
    assert(Number.isInteger(year) && year >= 1900 && year <= 2100, "农历年份须为 1900—2100");
    const bits = lunarYears[year - 1900], leap = bits & 15, months = [];
    for (let month = 1; month <= 12; month++) {
      months.push({ month, leap: false, days: bits & (0x10000 >> month) ? 30 : 29 });
      if (month === leap) months.push({ month, leap: true, days: bits & 0x10000 ? 30 : 29 });
    }
    return months;
  }
  function lunarToSolar(year, month, day, leap = false, clamp = false) {
    const months = lunarMonths(year), index = months.findIndex(m => m.month === month && m.leap === leap);
    assert(index >= 0 && Number.isInteger(day) && day >= 1 && day <= (clamp ? 30 : months[index].days), "农历日期或闰月无效");
    let offset = 0;
    for (let y = 1900; y < year; y++) offset += lunarMonths(y).reduce((n, m) => n + m.days, 0);
    offset += months.slice(0, index).reduce((n, m) => n + m.days, 0) + Math.min(day, months[index].days) - 1;
    const date = new Date(Date.UTC(1900, 0, 31) + offset * 86400000);
    return dateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  function birthdayParts(event) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date);
    assert(match, "出生日期须为 YYYY-MM-DD");
    const [year, month, day] = match.slice(1).map(Number);
    if (event.calendar === "lunar") lunarToSolar(year, month, day, event.leapMonth === true);
    else assert(dateParts(event.date), "出生日期无效");
    return [year, month, day];
  }
  function countdownEvent(event, now = new Date()) {
    if (!event.calendar || event.calendar === "once") return { ...event, nextDate: event.date, days: daysUntil(event.date, now) };
    const [birthYear, month, day] = birthdayParts(event);
    let nextDate;
    // 农历腊月可能落在下一阳历年，必须从上一农历年开始查找。
    for (let year = Math.max(birthYear, now.getFullYear() - (event.calendar === "lunar" ? 1 : 0)); year <= (event.calendar === "lunar" ? 2100 : 9999); year++) {
      if (event.calendar === "lunar") {
        const leap = event.leapMonth === true && lunarMonths(year).some(m => m.month === month && m.leap);
        nextDate = lunarToSolar(year, month, day, leap, true);
      } else {
        const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
        nextDate = dateString(year, month, Math.min(day, last));
      }
      if (daysUntil(nextDate, now) >= 0) break;
      nextDate = null;
    }
    assert(nextDate, "下一次生日超出支持年份");
    return { ...event, nextDate, days: daysUntil(nextDate, now), age: Math.max(0, now.getFullYear() - birthYear) };
  }
  function countdownCaption(event) {
    return event.age === undefined ? event.name : `${event.name} · 今年满 ${event.age} 岁`;
  }
  function countdownInput(value = "普通") {
    const types = { "普通": ["once", false], "其他": ["once", false], "阳历": ["solar", false], "农历": ["lunar", false], "闰月农历": ["lunar", true] };
    assert(own(types, value), "类型请填：其他、阳历、农历或闰月农历");
    const [calendar, leapMonth] = types[value]; return { calendar, leapMonth };
  }
  const isBirthday = event => event.calendar === "solar" || event.calendar === "lunar";
  const countdownType = event => event?.calendar === "solar" ? "阳历" : event?.calendar === "lunar" ? (event.leapMonth ? "闰月农历" : "农历") : "其他";
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
    const modules = moduleIds.map(id => ({ id, enabled: id !== "calendar", maxItems: id === "parcels" || id === "countdowns" ? 3 : 2 }));
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
        if (event.calendar !== undefined) {
          assert(["once", "solar", "lunar"].includes(event.calendar), "生日历法无效");
          assert(event.leapMonth === undefined || typeof event.leapMonth === "boolean", "闰月标记须为布尔值");
          assert(!event.leapMonth || event.calendar === "lunar", "只有农历生日可选择闰月");
          result.calendar = event.calendar;
          result.leapMonth = event.leapMonth === true;
        }
        if (result.calendar && result.calendar !== "once") birthdayParts(result);
        else assert(dateParts(result.date), "倒计时日期无效");
        assert(!names.has(result.name), "事件名称重复");
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
    return data.events.map(event => countdownEvent(event, now))
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.name.localeCompare(b.name));
  }
  function countdownGroups(data, now = new Date()) {
    const items = countdowns(data, now);
    return { birthdays: items.filter(isBirthday),
      other: items.filter(event => !isBirthday(event)).sort((a, b) => {
        // 今天及未来事件优先，过期事件留在末尾，最近过期的排在前面。
        if ((a.days < 0) !== (b.days < 0)) return a.days < 0 ? 1 : -1;
        return Math.abs(a.days) - Math.abs(b.days) || a.name.localeCompare(b.name);
      }) };
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
    validate, empty, defaults, parcels, trains, countdowns, countdownGroups, isBirthday, countdownEvent, countdownCaption, countdownInput, countdownType, lunarToSolar, importItems, mergeItems, validateBackup,
    truncate, metrics, planLayout, planDashboard, moduleIds, backgroundDefaults, validateBackground, cropRect };
})();

// 在 App 内运行管理事件；小组件参数填写事件名称，留空显示默认事件。
// 经 入口 加载时，参数填写 倒计时|事件名称。
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

async function chooseEventType(birthdayOnly = false) {
  const category = birthdayOnly ? 0 : await chooseOption("选择倒计时类型", ["生日", "其他倒计时"], "生日每年循环并显示年龄；其他倒计时按目标日期计算。");
  if (category < 0) return null;
  if (category === 1) return "其他";
  const calendar = await chooseOption("选择生日历法", ["阳历", "农历", "闰月农历"], "阳历生日选阳历；农历生日选农历，出生在农历闰月选闰月农历。");
  return calendar < 0 ? null : ["阳历", "农历", "闰月农历"][calendar];
}
async function editEvent(existing = null, initialType = null) {
  let type = existing ? InfoLogic.countdownType(existing) : initialType === "birthday" ? await chooseEventType(true) : initialType || await chooseEventType();
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
    const options = ["添加事件", "添加生日", ...events.map(event => `${InfoLogic.isBirthday(event) ? "生日" : "其他"} · ${event.name} · ${event.date}${event.id === settings.defaultId ? "（默认）" : ""}`)];
    if ((page + 1) * 15 < settings.events.length) options.push("下一页");
    if (page > 0) options.push("上一页");
    const action = await chooseOption("倒计时管理", options, `共 ${settings.events.length} 条。点选事件可编辑、删除、设默认或预览。参数填事件名称，留空显示默认事件。`);
    if (action < 0) return;
    if (action === 0) { await editEvent(null, "其他"); continue; }
    if (action === 1) { await editEvent(null, "birthday"); continue; }
    if (options[action] === "下一页") { page++; continue; }
    if (options[action] === "上一页") { page--; continue; }
    const event = events[action - 2]; if (!event) continue;
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
