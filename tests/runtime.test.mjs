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
  h = harness({ files, app: true, responses: [1, 0, 2, -1] }); await h.suite.run("parcels");
  assert.equal(h.suite.read("parcels").data.items[0].status, "collected"); assert.match(h.text(), /暂无信息/);
  h = harness({ files: Object.fromEntries(h.files), app: true, responses: [1, 0, 2, -1] }); await h.suite.run("parcels");
  assert.equal(h.suite.read("parcels").data.items[0].status, "pending");
  h = harness({ files: Object.fromEntries(h.files), app: true, responses: [1, 0, 0, { action: 0, fields: ["圆通", "0956", "西门", ""] }, -1] }); await h.suite.run("parcels");
  assert.equal(h.suite.read("parcels").data.items[0].company, "圆通");
  h = harness({ files: Object.fromEntries(h.files), app: true, responses: [1, 0, 1, 0, -1] }); await h.suite.run("parcels");
  assert.equal(h.suite.read("parcels").data.items.length, 0);
});
test("快递批量 JSON 导入与取消操作", async () => {
  const input = JSON.stringify([{ company: "京东", code: "07164" }, { company: "圆通", code: "0956" }]);
  const h = harness({ app: true, responses: [3, 0, { action: 0, fields: [input] }, 0, 0, -1] });
  await h.suite.run("parcels"); assert.equal(h.suite.read("parcels").data.items.length, 2);
  assert.equal(h.queue.length, 0);
  const cancelled = harness({ app: true, responses: [0, -1, -1] }); await cancelled.suite.run("parcels");
  assert.equal(cancelled.files.has(dataPath("parcels")), false);
});
test("火车票管理、校验重试、日历添加及隐藏配置", async () => {
  const values = ["G8603", "2099-10-12", "08:35", "成都东", "重庆北", "二等座", "2099-10-12", "10:30", "+08:00", ""];
  const h = harness({ app: true, responses: [0, { action: 0, fields: values.map((v, i) => i === 2 ? "24:00" : v) }, 0, { action: 0, fields: values }, 1, 0, 2, 0, 0, 0, 4, 0, -1] });
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
  await old.evaluate(readFileSync(new URL("../scripts/countdown.js", import.meta.url), "utf8"));
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
  const h = harness({ app: true, query: { action: "add", company: "圆通", code: "0956", station: "东门" }, responses: [0, 0] });
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
  assert.ok(h.text().indexOf("重要倒计时") < h.text().indexOf("近期出行"));
});
test("中文 Dashboard 配置菜单可保存模块条数、顺序和主题", async () => {
  const h = harness({ app: true, responses: [
    4, 0, 0, 1, { action: 0, fields: ["5"] }, -1,
    5, 0, 0, 3, -1,
    6, 2, { action: 0, fields: ["#FF9500"] }, -1,
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
