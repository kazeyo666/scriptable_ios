import test from "node:test";
import assert from "node:assert/strict";
import { harness, plain, parcel, train } from "./helpers.mjs";
const L = harness().logic;

test("日期验证、闰年、当天及过期倒计时", () => {
  assert.equal(L.dateParts("2027-02-29"), null); assert.ok(L.dateParts("2028-02-29"));
  for (const value of ["2027-13-01", "2027-04-31", "2027/01/01", "0001-01-01"]) assert.equal(L.dateParts(value), null);
  assert.equal(L.daysUntil("2027-01-01", new Date(2026, 11, 31, 23, 59)), 1);
  assert.equal(L.daysUntil("2027-01-01", new Date(2027, 0, 1, 23, 59)), 0);
  assert.equal(L.daysUntil("2027-01-01", new Date(2027, 0, 2)), -1);
  assert.equal(L.dayText(0), "就是今天"); assert.equal(L.dayText(-3), "已过 3 天");
  assert.equal(L.daysUntil("2027-03-15", new Date(2027, 2, 14)), 1);
});
test("车票按显式时区计算，不依赖设备时区", () => {
  assert.equal(L.instant("2027-01-01", "08:00", "+08:00"), Date.parse("2027-01-01T00:00:00Z"));
  assert.equal(L.instant("2027-01-01", "08:00", "-05:00"), Date.parse("2027-01-01T13:00:00Z"));
  for (const time of ["24:00", "12:60", "8:00"]) assert.throws(() => L.instant("2027-01-01", time));
  assert.throws(() => L.instant("2027-01-01", "08:00", "+14:01"));
});
test("待取优先、隐藏已取件、保留前导零", () => {
  const data = { items: [parcel("old"), parcel("new", { createdAt: "2026-10-10T00:00:00Z" }), parcel("taken", { status: "collected" })] };
  assert.deepEqual(plain(L.parcels(data).map(p => p.id)), ["new", "old"]);
  assert.equal(L.normalizeParcel(parcel(), "unused", "unused").code, "0956");
});
test("多张车票排序、结束隐藏、配置保留及到达日期校验", () => {
  const old = train("old", { date: "2026-01-01", endDate: "2026-01-01" });
  const later = train("later", { date: "2099-12-01", endDate: "2099-12-01" });
  assert.deepEqual(plain(L.trains({ items: [later, old, train()], hideEnded: true }).map(t => t.id)), ["t1", "later"]);
  assert.equal(L.trains({ items: [old], hideEnded: false }).length, 1);
  assert.throws(() => L.normalizeTrain(train("bad", { endDate: "2099-10-11" })));
  assert.throws(() => L.normalizeTrain(train("bad", { endTime: "" })));
});
test("兼容原倒计时格式并按日期排序，不建立第二数据库", () => {
  const data = L.validate("countdowns", { defaultId: "missing", events: [
    { id: "b", name: "会员到期", date: "2027-02-01", text: "" },
    { id: "a", name: "生日", date: "2027-01-01", text: "" },
  ] });
  assert.equal(data.defaultId, "b"); assert.deepEqual(plain(L.countdowns(data).map(e => e.id)), ["a", "b"]);
  assert.throws(() => L.validate("countdowns", { events: [{ id: "a", name: "事件", date: "2027-02-30" }] }));
});
test("导入严格校验、重复 ID 拒绝、未填写可选字段规范化", () => {
  const items = L.importItems("parcels", [{ company: "圆通", code: "0956" }], () => "uuid", "2026-10-09T00:00:00Z");
  assert.equal(items[0].station, ""); assert.equal(items[0].status, "pending");
  assert.throws(() => L.importItems("parcels", [{ company: "圆通", code: 956 }], () => "uuid", "2026-10-09T00:00:00Z"));
  assert.throws(() => L.mergeItems([parcel()], [parcel()]));
  assert.throws(() => L.importItems("trains", [{ date: "bad" }], () => "id", "2026-10-09T00:00:00Z"));
});
test("主题和模块配置校验、原型字段不被当成有效备份", () => {
  const settings = L.defaults(); assert.equal(L.validate("settings", settings).theme.mode, "system");
  settings.theme.accent = "red"; assert.throws(() => L.validate("settings", settings));
  const other = L.defaults(); other.profiles.default.modules[0].maxItems = 0; assert.throws(() => L.validate("settings", other));
  assert.throws(() => L.validateBackup({ version: 1, format: "scriptable-info-backup", data: {} }));
});
test("上千条记录没有人为保存条数限制，中文截断按字符处理", () => {
  const data = L.validate("parcels", { version: 1, items: Array.from({ length: 1500 }, (_, i) => parcel(String(i))) });
  assert.equal(data.items.length, 1500); assert.equal(L.truncate("📦中文长文本", 4), "📦中文…");
});
for (const family of ["small", "medium", "large"]) {
  test(`${family} 布局预算与最大条数限制，车票双行计入高度`, () => {
    const sections = L.moduleIds.map((id, i) => ({ id, maxItems: 3, rows: Array.from({ length: 20 }, () => ({ main: "超长中文".repeat(50), lines: i === 1 ? 2 : 1 })) }));
    const plan = L.planLayout(sections, family), m = plan.metrics;
    assert.ok(plan.used <= m.height); assert.ok(plan.plans.length <= m.maxModules);
    assert.ok(plan.plans.every(p => p.rows.length <= 3));
    const costs = plan.plans.map(p => m.header + 8 + p.rows.reduce((sum, row) => sum + m.row * (row.lines || 1), 0));
    const cost = m.columns === 2 ? Math.max(...costs) : costs.reduce((a, b) => a + b, 0) + (plan.plans.length - 1) * m.gap;
    assert.equal(cost, plan.used);
  });
}
for (const family of ["small", "medium", "large"]) {
  test(`${family} 新面板完整四模块、警告和长列表满足高度预算`, () => {
    const sections = L.moduleIds.map(id => ({ id, maxItems: 20, rows: Array.from({ length: 30 }, () => ({ main: "内容", lines: id === "trains" ? 2 : 1 })) }));
    for (const warning of [false, true]) {
      const plan = L.planDashboard(sections, family, warning);
      assert.ok(plan.used <= plan.metrics.budget);
      assert.ok(plan.plans.every(p => p.rows.length >= 1));
      assert.equal(plan.plans.length, family === "large" ? 4 : family === "medium" ? 2 : 1);
    }
  });
}

const birthday = (date, calendar = "solar", extra = {}) => ({ id: date, name: date, date, text: "", calendar, ...extra });
test("阳历生日每年循环、当天和次日切年，年龄为今年满岁", () => {
  const event = birthday("1996-10-10");
  const today = L.countdownEvent(event, new Date(2026, 9, 10, 23, 59));
  assert.equal(today.days, 0); assert.equal(today.age, 30);
  const next = L.countdownEvent(event, new Date(2026, 9, 11));
  assert.equal(next.nextDate, "2027-10-10"); assert.equal(next.age, 30);
  assert.equal(L.countdownEvent(event, new Date(2027, 0, 1)).age, 31);
  assert.equal(L.countdownEvent(birthday("2000-02-29"), new Date(2027, 0, 1)).nextDate, "2027-02-28");
  assert.equal(L.countdownEvent(birthday("2000-02-29"), new Date(2028, 0, 1)).nextDate, "2028-02-29");
});
test("农历春节、中秋、闰月与腊月跨年转换", () => {
  assert.equal(L.lunarToSolar(2026, 1, 1), "2026-02-17");
  assert.equal(L.lunarToSolar(2026, 8, 15), "2026-09-25");
  assert.equal(L.lunarToSolar(2023, 2, 1, true), "2023-03-22");
  const event = birthday("1996-08-15", "lunar");
  assert.equal(L.countdownEvent(event, new Date(2026, 8, 25)).days, 0);
  assert.equal(L.countdownEvent(event, new Date(2026, 8, 26)).nextDate, "2027-09-15");
  assert.equal(L.countdownEvent(birthday("1996-12-15", "lunar"), new Date(2026, 0, 1)).nextDate, L.lunarToSolar(2025, 12, 15));
  const leap = birthday("2023-02-01", "lunar", { leapMonth: true });
  assert.equal(L.countdownEvent(leap, new Date(2023, 0, 1)).nextDate, "2023-03-22");
  assert.equal(L.countdownEvent(leap, new Date(2024, 0, 1)).nextDate, L.lunarToSolar(2024, 2, 1));
  assert.equal(L.countdownEvent(birthday("2023-02-30", "lunar"), new Date(2025, 0, 1)).nextDate, L.lunarToSolar(2025, 2, 29));
});
test("农历年表首末日期与 ICU 中国历核对，覆盖 1900—2100 和 2033 闰十一月", () => {
  const f = new Intl.DateTimeFormat("en-u-ca-chinese", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
  for (let year = 1900; year <= 2100; year++) {
    for (let month = 1; month <= 12; month++) {
      for (const leap of [false, true]) {
        let first;
        try { first = L.lunarToSolar(year, month, 1, leap); } catch { if (leap) continue; throw Error("缺失普通月"); }
        for (const day of [1, 29, 30]) {
          let solar;
          try { solar = L.lunarToSolar(year, month, day, leap); } catch { if (day === 30) continue; throw Error("缺失农历日"); }
          const p = Object.fromEntries(f.formatToParts(new Date(`${solar}T12:00:00Z`)).map(p => [p.type, p.value]));
          assert.equal(+p.relatedYear, year); assert.equal(parseInt(p.month), month);
          assert.equal(p.month.includes("bis"), leap); assert.equal(+p.day, day);
        }
      }
    }
  }
  assert.equal(L.lunarToSolar(2033, 11, 1, true), "2033-12-22");
});
test("生日字段校验、备份保留、按下次日期而非出生年份排序", () => {
  const events = [birthday("1990-12-01"), birthday("2000-10-12"), birthday("1996-08-15", "lunar")];
  const data = L.validate("countdowns", { events, defaultId: events[0].id });
  assert.equal(data.events[2].calendar, "lunar");
  assert.deepEqual(plain(L.countdowns(data, new Date(2026, 9, 10)).map(e => e.date)), ["2000-10-12", "1990-12-01", "1996-08-15"]);
  for (const event of [birthday("2023-02-01", "lunar", { leapMonth: "true" }), birthday("2023-03-01", "lunar", { leapMonth: true }), birthday("1899-01-01", "lunar"), birthday("2101-01-01", "lunar"), birthday("2023-01-31", "lunar"), birthday("2023-01-01", "bad")]) {
    assert.throws(() => L.validate("countdowns", { events: [event] }));
  }
});

test("生日与其他倒计时独立分组排序，旧普通记录兼容且未来优先", () => {
  const events = [
    { id: "old", name: "去年到期", date: "2025-01-01", text: "" },
    { id: "recent", name: "昨天到期", date: "2026-10-09", text: "", calendar: "once" },
    { id: "later", name: "下月到期", date: "2026-11-01", text: "" },
    { id: "today", name: "今天到期", date: "2026-10-10", text: "" },
    birthday("1996-08-15", "lunar"), birthday("1990-10-12"),
  ];
  const groups = L.countdownGroups({ events }, new Date(2026, 9, 10));
  assert.deepEqual(plain(groups.birthdays.map(e => e.date)), ["1990-10-12", "1996-08-15"]);
  assert.deepEqual(plain(groups.other.map(e => e.id)), ["today", "later", "recent", "old"]);
  assert.ok(groups.other.every(e => e.age === undefined));
  assert.deepEqual(plain(L.countdownInput("其他")), plain(L.countdownInput("普通")));
});
