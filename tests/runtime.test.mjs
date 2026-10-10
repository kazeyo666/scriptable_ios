import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { harness, dataPath, parcel, train, plain, estimatedHeight } from "./helpers.mjs";

test("首次运行：所有新组件可离线展示，无对话框、无网络", async () => {
  for (const kind of ["parcels", "trains", "countdowns", "dashboard"]) {
    const h = harness(); await h.suite.run(kind);
    assert.ok(h.rendered); assert.ok(h.complete); assert.equal(h.dialogs.length, 0);
    assert.equal(h.requests.length, 0); assert.match(h.text(), /暂无信息/);
  }
});
test("新增、标记已取件、恢复待取件、编辑和删除快递", async () => {
  let h = harness({ app: true, responses: [0, { action: 0, fields: ["京东", "07164", "南门驿站", "易碎"] }, -1] });
  await h.suite.run("parcels"); assert.equal(h.suite.read("parcels").data.items[0].code, "07164");
  const files = Object.fromEntries(h.files);
  h = harness({ files, app: true, responses: [3, 2, -1] }); await h.suite.run("parcels");
  assert.equal(h.suite.read("parcels").data.items[0].status, "collected"); assert.match(h.text(), /暂无信息/);
  h = harness({ files: Object.fromEntries(h.files), app: true, responses: [3, 2, -1] }); await h.suite.run("parcels");
  assert.equal(h.suite.read("parcels").data.items[0].status, "pending");
  h = harness({ files: Object.fromEntries(h.files), app: true, responses: [3, 0, { action: 0, fields: ["圆通", "0956", "西门", ""] }, -1] }); await h.suite.run("parcels");
  assert.equal(h.suite.read("parcels").data.items[0].company, "圆通");
  h = harness({ files: Object.fromEntries(h.files), app: true, responses: [3, 1, 0, -1] }); await h.suite.run("parcels");
  assert.equal(h.suite.read("parcels").data.items.length, 0);
});
test("快递批量 JSON 导入与取消操作", async () => {
  const input = JSON.stringify([{ company: "京东", code: "07164" }, { company: "圆通", code: "0956" }]);
  const h = harness({ app: true, responses: [2, 0, { action: 0, fields: [input] }, 0, -1] });
  await h.suite.run("parcels"); assert.equal(h.suite.read("parcels").data.items.length, 2);
  assert.equal(h.queue.length, 0);
  const cancelled = harness({ app: true, responses: [0, -1, -1] }); await cancelled.suite.run("parcels");
  assert.equal(cancelled.files.has(dataPath("parcels")), false);
});
test("火车票管理、校验重试、日历添加及隐藏配置", async () => {
  const values = ["G8603", "2099-10-12", "08:35", "成都东", "重庆北", "二等座", "2099-10-12", "10:30", "+08:00", ""];
  const h = harness({ app: true, responses: [0, { action: 0, fields: values.map((v, i) => i === 2 ? "24:00" : v) }, 0, { action: 0, fields: values }, 4, 2, 0, 0, 0, 3, -1] });
  await h.suite.run("trains"); assert.equal(h.suite.read("trains").data.items.length, 1);
  assert.equal(h.suite.read("trains").data.hideEnded, false); assert.equal(h.calendars.length, 1);
  assert.equal(h.calendars[0].startDate.getTime(), Date.parse("2099-10-12T00:35:00Z"));
  assert.equal(h.queue.length, 0);
});
test("新增倒计时与原脚本共享同一路径、原格式可读取", async () => {
  const h = harness({ app: true, responses: [0, { action: 0, fields: ["生日", "2099-01-01", "生日快乐"] }, -1] });
  await h.suite.run("countdowns");
  assert.ok(h.files.has("/docs/scriptable-countdown-events.json"));
  assert.equal(h.files.has("/docs/scriptable-info-data/countdowns.json"), false);
  const old = harness({ files: Object.fromEntries(h.files) });
  await old.evaluate(readFileSync(new URL("../scripts/倒计时.js", import.meta.url), "utf8"));
  assert.match(old.text(), /生日快乐/); assert.ok(old.complete);
});
test("单个 JSON 文件损坏不影响其他模块，原文件保留并禁止写入", async () => {
  const h = harness({ files: { [dataPath("parcels")]: "{broken", [dataPath("trains")]: JSON.stringify({ version: 1, items: [train()], hideEnded: true }) } });
  await h.suite.run("dashboard"); assert.match(h.text(), /损坏/); assert.match(h.text(), /G8603/);
  assert.equal(h.files.get(dataPath("parcels")), "{broken");
  assert.throws(() => h.suite.write("parcels", { version: 1, items: [] }), /损坏/);
});
test("最后有效快照可展示但不静默覆盖损坏主文件", () => {
  const h = harness(); h.suite.write("parcels", { version: 1, items: [parcel()] });
  h.files.set(dataPath("parcels"), "invalid");
  const state = h.suite.read("parcels"); assert.equal(state.data.items.length, 1); assert.equal(state.readOnly, true);
  assert.equal(h.files.get(dataPath("parcels")), "invalid");
});
test("完整备份、严格恢复、无效备份不写入及恢复前副本", () => {
  const h = harness(); h.suite.write("parcels", { version: 1, items: [parcel()] });
  const backup = plain(h.suite.backupObject()); h.suite.write("parcels", { version: 1, items: [] });
  h.suite.restoreBackup(backup); assert.equal(h.suite.read("parcels").data.items.length, 1);
  assert.ok([...h.files.keys()].some(k => k.includes("before-restore")));
  const before = h.files.get(dataPath("parcels")); backup.data.trains.items = [{ invalid: true }];
  assert.throws(() => h.suite.restoreBackup(backup)); assert.equal(h.files.get(dataPath("parcels")), before);
});
test("多文件恢复写入失败时回滚已修改的数据", () => {
  const initial = harness(); initial.suite.write("parcels", { version: 1, items: [parcel()] });
  const backup = plain(initial.suite.backupObject()); backup.data.parcels.items = [];
  let failed = false;
  const h = harness({ files: Object.fromEntries(initial.files), failWrite: path => {
    if (!failed && path === dataPath("trains")) { failed = true; return true; } return false;
  } });
  assert.throws(() => h.suite.restoreBackup(backup), /回滚/);
  assert.equal(h.suite.read("parcels").data.items.length, 1); assert.equal(h.files.has(dataPath("trains")), false);
});
test("URL/快捷指令接收、确认后存本地、拒绝时不保存", async () => {
  const h = harness({ app: true, query: { action: "add", company: "圆通", code: "0956", station: "东门" }, responses: [0] });
  await h.suite.run("parcels"); assert.equal(h.suite.read("parcels").data.items[0].code, "0956"); assert.equal(h.requests.length, 0);
  const cancel = harness({ app: true, shortcut: JSON.stringify([{ company: "京东", code: "007" }]), responses: [-1] });
  await cancel.suite.run("parcels"); assert.equal(cancel.files.has(dataPath("parcels")), false);
});
test("日历仅在 App 授权读取，Widget 仅展示缓存，权限失败保留缓存", async () => {
  const base = harness(), settings = base.logic.defaults(); settings.calendar.enabled = true;
  for (const profile of Object.values(settings.profiles)) profile.modules.find(m => m.id === "calendar").enabled = true;
  const cache = { version: 1, updatedAt: new Date().toISOString(), items: [{ title: "项目会议", start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString(), allDay: false }] };
  const files = { [dataPath("settings")]: JSON.stringify(settings), [dataPath("calendar")]: JSON.stringify(cache) };
  const widget = harness({ files }); await widget.suite.run("dashboard");
  assert.equal(widget.calendarReads, 0); assert.match(widget.text(), /项目会议/);
  const app = harness({ files, app: true, calendarError: true, responses: [0] });
  await app.suite.refreshCalendar(true); assert.equal(app.calendarReads, 1);
  assert.equal(app.suite.read("calendar").data.items[0].title, "项目会议");
});
test("Dashboard 模块禁用、顺序、空模块和紧凑配置", async () => {
  const h = harness({ parameter: "compact" }), settings = h.logic.defaults();
  settings.profiles.compact.modules.reverse(); settings.profiles.compact.modules.find(m => m.id === "parcels").enabled = false;
  settings.profiles.compact.hideEmpty = false; h.suite.write("settings", settings);
  h.suite.write("countdowns", { events: [{ id: "a", name: "生日", date: "2099-01-01", text: "" }], defaultId: "a" });
  h.suite.write("parcels", { version: 1, items: [parcel()] });
  await h.suite.run("dashboard"); assert.match(h.text(), /生日/); assert.doesNotMatch(h.text(), /0956/);
  assert.ok(h.text().indexOf("其他倒计时") < h.text().indexOf("近期出行"));
});
test("中文 Dashboard 配置菜单可保存模块条数、顺序和主题", async () => {
  const h = harness({ app: true, responses: [
    4, 0, { action: 0, fields: ["5", "4"] }, -1,
    6, 2,
    6, 3, { action: 0, fields: ["#FF9500"] }, -1,
  ] });
  await h.suite.run("dashboard"); const settings = h.suite.read("settings").data;
  assert.equal(settings.profiles.default.modules.at(-1).id, "parcels");
  assert.equal(settings.profiles.default.modules.at(-1).maxItems, 5);
  assert.deepEqual(plain(settings.theme), { mode: "dark", accent: "#FF9500" }); assert.equal(h.queue.length, 0);
});
for (const family of ["small", "medium", "large"]) {
  test(`${family} 实际渲染限制每行、长中文和点击目标`, async () => {
    const h = harness({ family, files: { [dataPath("parcels")]: JSON.stringify({ version: 1, items: Array.from({ length: 30 }, (_, i) => parcel(String(i), { company: "超长中文公司名称".repeat(20) })) }),
      [dataPath("trains")]: JSON.stringify({ version: 1, items: [train()], hideEnded: true }) } });
    await h.suite.run("dashboard");
    assert.equal(h.dialogs.length, 0); assert.ok(h.rendered.url.includes("infoAction=dashboard"));
    if (family !== "small") assert.ok(h.nodes.some(n => n.url?.includes("infoAction=parcels")));
    else assert.equal(h.nodes.some(n => n !== h.rendered && n.url), false);
    for (const node of h.nodes) for (const child of node.children || []) if (child.kind === "text") assert.equal(child.lineLimit, 1);
    assert.ok(h.text().length < 1500);
    assert.ok(estimatedHeight(h.rendered) <= (family === "large" ? 311 : 141), `模拟高度 ${estimatedHeight(h.rendered)} 超出保守预算`);
  });
}
test("通过 URL 点击模块能在当前脚本直接打开管理入口", async () => {
  const h = harness({ app: true, query: { infoAction: "trains" }, responses: [-1] });
  await h.suite.run("dashboard"); assert.equal(h.dialogs[0].title, "近期出行管理");
});
test("独立中号快递显示三条记录，单卡片不受双列宽度限制", async () => {
  const h = harness({ family: "medium", files: { [dataPath("parcels")]: JSON.stringify({ version: 1, items: [parcel("a", { code: "3821" }), parcel("b", { code: "7164" }), parcel("c")] }) } });
  await h.suite.run("parcels");
  assert.match(h.text(), /3821/); assert.match(h.text(), /7164/); assert.match(h.text(), /0956/);
  assert.ok(estimatedHeight(h.rendered) <= 141);
  assert.equal(h.nodes.some(node => node.size?.width === 120), false);
});

test("生日管理可保存农历和年龄，原单事件脚本读取相同数据", async () => {
  const h = harness({ app: true, responses: [1, 1, { action: 0, fields: ["中秋生日", "1996-08-15", ""] }, -1] });
  await h.suite.run("countdowns");
  const data = h.suite.read("countdowns").data;
  assert.equal(data.events[0].calendar, "lunar");
  assert.match(h.text(), new RegExp(`今年满 ${new Date().getFullYear() - 1996} 岁`));
  const old = harness({ files: Object.fromEntries(h.files) });
  await old.evaluate(readFileSync(new URL("../scripts/倒计时.js", import.meta.url), "utf8"));
  assert.match(old.text(), /今年满/); assert.match(old.text(), /农历/);
  assert.equal(old.requests.length, 0);
});
test("单事件管理编辑保留农历与闰月字段", async () => {
  const event = { id: "leap", name: "闰月生日", date: "2023-02-01", text: "", calendar: "lunar", leapMonth: true };
  const h = harness({ app: true, files: { [dataPath("countdowns")]: JSON.stringify({ events: [event], defaultId: "leap" }) }, responses: [2, 0, 0, -1] });
  await h.evaluate(readFileSync(new URL("../scripts/倒计时.js", import.meta.url), "utf8"));
  const saved = JSON.parse(h.files.get(dataPath("countdowns"))).events[0];
  assert.equal(saved.calendar, "lunar"); assert.equal(saved.leapMonth, true);
});
for (const family of ["small", "medium", "large"]) {
  test(`${family} 倒计时和面板按下一次生日排序，最多展示三条且保留全部数据`, async () => {
    const now = new Date();
    const events = [40, 20, 10, 30, 50].map((days, i) => {
      const next = new Date(now); next.setDate(next.getDate() + days);
      return { id: String(i), name: `生日${days}`, date: `2000-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`, text: "", calendar: "solar" };
    });
    for (const kind of ["countdowns", "dashboard"]) {
      const h = harness({ family });
      const settings = h.logic.defaults();
      settings.profiles.default.modules.forEach(m => { m.enabled = m.id === "countdowns"; m.maxItems = 20; });
      h.suite.write("settings", settings); h.suite.write("countdowns", { events, defaultId: "0" });
      await h.suite.run(kind);
      const names = h.text().match(/生日\d+/g);
      assert.ok(names.length <= 3 && names.length > 0);
      assert.deepEqual(names, ["生日10", "生日20", "生日30"].slice(0, names.length));
      assert.match(h.text(), /今年满/);
      assert.equal(h.suite.read("countdowns").data.events.length, 5);
      assert.equal(h.requests.length, 0);
    }
  });
}

for (const family of ["small", "medium", "large"]) {
  test(`${family} 生日和其他分组各自限制最近三条，不共用名额`, async () => {
    const now = new Date(), events = [];
    for (const days of [40, 10, 50, 30, 20]) {
      const date = new Date(now); date.setDate(date.getDate() + days);
      const md = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      events.push({ id: `b${days}`, name: `生辰${days}`, date: `2000-${md}`, text: "", calendar: "solar" });
      events.push({ id: `o${days}`, name: `到期${days}`, date: `${date.getFullYear()}-${md}`, text: "" });
    }
    for (const kind of ["countdowns", "dashboard"]) {
      const h = harness({ family }), settings = h.logic.defaults();
      settings.profiles.default.modules.forEach(m => { m.enabled = m.id === "countdowns"; m.maxItems = 20; });
      h.suite.write("settings", settings); h.suite.write("countdowns", { events, defaultId: "b40" });
      await h.suite.run(kind);
      const text = h.text(), birthdays = text.match(/生辰\d+/g) || [], other = text.match(/到期\d+/g) || [];
      assert.ok(birthdays.length > 0 && birthdays.length <= 3);
      assert.deepEqual(birthdays, ["生辰10", "生辰20", "生辰30"].slice(0, birthdays.length));
      assert.deepEqual(other, ["到期10", "到期20", "到期30"].slice(0, other.length));
      assert.match(text, /生日/);
      if (family !== "small") { assert.match(text, /其他倒计时/); assert.ok(other.length > 0 && other.length <= 3); }
      if (family === "large") { assert.equal(birthdays.length, 3); assert.equal(other.length, 3); }
      assert.equal(h.suite.read("countdowns").data.events.length, 10);
    }
  });
}

test("倒计时首页直接添加事件或生日，生日历法菜单提供阳历、农历和闰月农历", async () => {
  for (const original of [false, true]) {
    for (const [category, calendar, date, expected, leap] of [
      [1, null, "2099-08-15", "once", false],
      [0, 0, "1996-08-15", "solar", false],
      [0, 1, "1996-08-15", "lunar", false],
      [0, 2, "2023-02-01", "lunar", true],
    ]) {
      const responses = [category === 0 ? 1 : 0];
      if (calendar !== null) responses.push(calendar);
      responses.push({ action: 0, fields: ["测试事件", date, ""] });
      responses.push(-1);
      const h = harness({ app: true, responses });
      if (original) await h.evaluate(readFileSync(new URL("../scripts/倒计时.js", import.meta.url), "utf8"));
      else await h.suite.run("countdowns");
      const event = JSON.parse(h.files.get(dataPath("countdowns"))).events[0];
      assert.equal(event.calendar, expected); assert.equal(event.leapMonth, leap);
      assert.deepEqual(h.dialogs[0].actions.slice(0, 2), ["添加事件", "添加生日"]);
      assert.equal(h.dialogs.some(d => d.title === "选择倒计时类型"), false);
      const calendarMenu = h.dialogs.find(d => d.title === "选择生日历法");
      if (category === 0) assert.deepEqual(calendarMenu.actions, ["阳历", "农历", "闰月农历"]);
      else assert.equal(calendarMenu, undefined);
      const form = h.dialogs.find(d => d.fields.length);
      assert.equal(form.fields.length, 3); // 不再要求输入历法类型。
    }
  }
});
test("取消生日历法或事件表单均不新增数据", async () => {
  for (const original of [false, true]) {
    for (const responses of [[1, -1, -1], [1, 1, -1, -1], [0, -1, -1]]) {
      const h = harness({ app: true, responses });
      if (original) await h.evaluate(readFileSync(new URL("../scripts/倒计时.js", import.meta.url), "utf8"));
      else await h.suite.run("countdowns");
      assert.equal(h.files.has(dataPath("countdowns")), false);
    }
  }
});
test("农历日期输入失败重试保留所选历法，不重复要求选择", async () => {
  const h = harness({ app: true, responses: [1, 1,
    { action: 0, fields: ["农历生日", "1996-08-31", ""] }, 0,
    { action: 0, fields: ["农历生日", "1996-08-15", ""] }, -1] });
  await h.suite.run("countdowns");
  assert.equal(h.suite.read("countdowns").data.events[0].calendar, "lunar");
  assert.equal(h.dialogs.filter(d => d.title === "选择生日历法").length, 1);
});

const action = name => ({ action: name });
test("记录直接列在管理页，分页选择后可编辑且末页删除后自动退回", async () => {
  const items = Array.from({ length: 16 }, (_, i) => parcel(String(i), { company: `公司${i}` }));
  const files = { [dataPath("parcels")]: JSON.stringify({ version: 1, items }) };
  const h = harness({ app: true, files, responses: [action("下一页"), action("公司15 · 0956"), action("编辑"), { action: 0, fields: ["末页修改", "0007", "", ""] }, -1] });
  await h.suite.run("parcels");
  assert.equal(h.suite.read("parcels").data.items[15].company, "末页修改");
  assert.equal(h.dialogs.some(d => d.title === "选择记录"), false);
  assert.ok(h.dialogs[0].actions.includes("公司0 · 0956"));
  const deleted = harness({ app: true, files, responses: [action("下一页"), action("公司15 · 0956"), action("删除"), 0, -1] });
  await deleted.suite.run("parcels");
  assert.equal(deleted.suite.read("parcels").data.items.length, 15);
  assert.ok(deleted.dialogs.at(-1).actions.includes("公司0 · 0956"));
  assert.equal(deleted.dialogs.at(-1).actions.includes("下一页"), false);
});
test("编辑生日直接打开表单，取消修改类型不写入，明确选择可修改历法", async () => {
  const event = { id: "leap", name: "闰月生日", date: "2023-02-01", text: "", calendar: "lunar", leapMonth: true };
  const originalData = JSON.stringify({ events: [event], defaultId: "leap" });
  for (const original of [false, true]) {
    const prefix = [original ? 2 : 3, action("编辑")];
    const cancelled = harness({ app: true, files: { [dataPath("countdowns")]: originalData }, responses: [...prefix,
      { action: "修改类型／历法", fields: ["未保存", "2023-02-01", ""] }, -1, -1, -1] });
    if (original) await cancelled.evaluate(readFileSync(new URL("../scripts/倒计时.js", import.meta.url), "utf8"));
    else await cancelled.suite.run("countdowns");
    assert.equal(cancelled.files.get(dataPath("countdowns")), originalData);
    assert.ok(cancelled.dialogs[2].fields.length === 3);
    assert.equal(cancelled.dialogs.filter(d => d.title === "选择倒计时类型").length, 1);
    const saved = harness({ app: true, files: { [dataPath("countdowns")]: originalData }, responses: [...prefix,
      action("修改类型／历法"), action("生日"), action("阳历"), action("保存"), -1] });
    if (original) await saved.evaluate(readFileSync(new URL("../scripts/倒计时.js", import.meta.url), "utf8"));
    else await saved.suite.run("countdowns");
    const updated = JSON.parse(saved.files.get(dataPath("countdowns"))).events[0];
    assert.equal(updated.calendar, "solar"); assert.equal(updated.leapMonth, false);
  }
});
test("模块设置直接操作当前紧凑配置，一页保存启用、条数和顺序", async () => {
  const h = harness({ app: true, parameter: "compact", responses: [4, 0, { action: "禁用并保存", fields: ["2", "4"] }, -1, -1] });
  await h.suite.run("dashboard");
  const settings = h.suite.read("settings").data;
  assert.equal(settings.profiles.compact.modules.at(-1).id, "parcels");
  assert.equal(settings.profiles.compact.modules.at(-1).enabled, false);
  assert.equal(settings.profiles.compact.modules.at(-1).maxItems, 2);
  assert.deepEqual(plain(settings.profiles.default), plain(h.logic.defaults().profiles.default));
  assert.equal(h.dialogs.some(d => ["选择面板配置", "移到第几位？", "最大展示条数"].includes(d.title)), false);
});
test("模块设置非法输入可重试，取消不写入，倒计时条数限制每组最多三条", async () => {
  const h = harness({ app: true, responses: [4, 3, { action: 0, fields: ["4", "1"] }, 0, -1, -1, -1] });
  await h.suite.run("dashboard");
  assert.equal(h.files.has(dataPath("settings")), false);
  assert.match(h.dialogs.find(d => d.title === "请检查输入").message, /1—3/);
});
test("预览直接使用当前尺寸，切换尺寸和配置不再重复选择", async () => {
  const h = harness({ app: true, family: "medium", responses: [0, 5, action("小号"), 0, 9, -1] });
  await h.suite.run("dashboard");
  assert.deepEqual(h.previews.map(p => p.family), ["medium", "small", "small"]);
  assert.equal(h.dialogs.some(d => d.title === "预览尺寸" || d.title === "选择面板配置"), false);
  assert.match(h.dialogs.at(-1).message, /紧凑/);
});
test("备份入口统一到面板首页，独立组件仍能导出备份", async () => {
  const h = harness({ app: true, responses: [action("面板设置与备份"), action("数据备份与恢复"), action("导出全部数据为 JSON 文件"), -1, -1] });
  await h.suite.run("parcels");
  assert.equal(h.dialogs[0].actions.includes("数据备份与恢复"), false);
  assert.equal(h.exported.length, 1);
  assert.equal(JSON.parse(h.exported[0][0]).format, "scriptable-info-backup");
});

test("原单事件管理也直接分页列出记录，删除末页默认事件后保留有效默认", async () => {
  const events = Array.from({ length: 16 }, (_, i) => ({ id: String(i), name: `事件${i}`, date: "2099-01-01", text: "" }));
  const h = harness({ app: true, files: { [dataPath("countdowns")]: JSON.stringify({ events, defaultId: "15" }) }, responses: [action("下一页"), action("其他 · 事件15 · 2099-01-01（默认）"), action("删除"), 0, -1] });
  await h.evaluate(readFileSync(new URL("../scripts/倒计时.js", import.meta.url), "utf8"));
  const saved = JSON.parse(h.files.get(dataPath("countdowns")));
  assert.equal(saved.events.length, 15); assert.equal(saved.defaultId, "0");
  assert.equal(h.dialogs.at(-1).actions.includes("下一页"), false);
});
test("统一备份入口恢复仍需确认，取消后不覆盖现有记录", async () => {
  const base = harness(); base.suite.write("parcels", { version: 1, items: [parcel()] });
  const backup = plain(base.suite.backupObject()); backup.data.parcels.items = [];
  const h = harness({ app: true, files: Object.fromEntries(base.files), responses: [7, 1, 0, { action: 0, fields: [JSON.stringify(backup)] }, -1, -1] });
  await h.suite.run("dashboard");
  assert.equal(h.suite.read("parcels").data.items.length, 1);
  assert.ok(h.dialogs.some(d => d.title === "替换全部本地数据？"));
});

test("信息面板的倒计时入口直接添加事件，不再弹出类别菜单，跳转使用中文名称", async () => {
  const h = harness({ app: true, scriptName: "信息面板", responses: [3, action("添加事件"), { action: 0, fields: ["交付", "2099-01-01", ""] }, -1, -1] });
  await h.suite.run("dashboard");
  assert.equal(h.suite.read("countdowns").data.events[0].calendar, "once");
  assert.equal(h.dialogs.some(d => d.title === "选择倒计时类型"), false);
  const link = new URL(h.rendered.url);
  assert.equal(link.searchParams.get("scriptName"), "信息面板");
  assert.equal(link.searchParams.get("remoteScript"), "信息面板|default");
});
