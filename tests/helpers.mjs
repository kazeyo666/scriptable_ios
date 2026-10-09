import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

export const logicSource = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8");
export const runtimeSource = readFileSync(new URL("../src/runtime.js", import.meta.url), "utf8");
export const dashboardSource = readFileSync(new URL("../src/dashboard.js", import.meta.url), "utf8");
export const plain = value => JSON.parse(JSON.stringify(value));
export function harness(options = {}) {
  const files = new Map(Object.entries(options.files || {}));
  const nodes = [], dialogs = [], queue = [...(options.responses || [])];
  const requests = [], calendars = [], exported = [];
  let rendered, complete = false, calendarReads = 0, writes = 0;
  class Stack {
    constructor() { this.children = []; nodes.push(this); }
    addStack() { const node = new Stack(); this.children.push(node); return node; }
    addText(value) { const node = { value, kind: "text", centerAlignText() {} }; this.children.push(node); return node; }
    addImage(image) { const node = { kind: "image", image }; this.children.push(node); return node; }
    addSpacer(value) { this.children.push({ kind: "spacer", value }); }
    setPadding(...padding) { this.padding = padding; }
    layoutHorizontally() { this.horizontal = true; }
    layoutVertically() { this.vertical = true; }
    centerAlignContent() {}
    async presentSmall() {} async presentMedium() {} async presentLarge() {}
  }
  const manager = cloud => ({
    documentsDirectory: () => cloud ? "/icloud" : "/docs",
    joinPath: (a, b) => a + "/" + b, createDirectory() {},
    fileExists: path => files.has(path), readString(path) { if (!files.has(path)) throw Error("missing file"); return files.get(path); },
    writeString(path, value) { writes++; if (options.failWrite?.(path, writes)) throw Error("disk failure"); files.set(path, value); },
    remove: path => files.delete(path), listContents: path => [...files.keys()].filter(p => p.startsWith(path + "/")).map(p => p.slice(path.length + 1)),
    isFileStoredIniCloud: path => path.startsWith("/icloud/"), async downloadFileFromiCloud() {},
  });
  class Alert {
    constructor() { this.fields = []; this.actions = []; }
    addAction(value) { this.actions.push(value); } addDestructiveAction(value) { this.actions.push(value); } addCancelAction() {}
    addTextField(label, value) { this.fields.push(value); }
    textFieldValue(index) { return this.fields[index]; }
    next() {
      assert.equal(context.config.runsInApp, true, "Widget 不得弹出对话框");
      dialogs.push(this);
      assert.ok(queue.length, `未预期的对话框：${this.title}`);
      const answer = queue.shift(); if (typeof answer === "number") return answer;
      if (answer.fields) this.fields = answer.fields; return answer.action;
    }
    async presentSheet() { return this.next(); } async presentAlert() { return this.next(); }
  }
  class Color { constructor(value, alpha = 1) { this.value = value; this.alpha = alpha; } static dynamic(light, dark) { return { light, dark }; } static white() { return new Color("white"); } }
  class CalendarEvent {
    async save() { calendars.push(this); }
    static async between() { calendarReads++; if (options.calendarError) throw Error("permission denied"); return options.calendarEvents || []; }
  }
  const context = vm.createContext({
    console: { warn() {}, log() {}, error() {} }, Date, JSON, Map, Set,
    config: { runsInApp: options.app || false, runsInWidget: !options.app, widgetFamily: options.family || "large" },
    args: { widgetParameter: options.parameter || "", shortcutParameter: options.shortcut ?? null, queryParameters: options.query || {} },
    module: { filename: options.launcherPath || "/docs/RemoteLauncher.js" },
    FileManager: { local: () => manager(false), iCloud: () => manager(true) },
    Alert, Color, ListWidget: Stack, Size: class { constructor(width, height) { this.width = width; this.height = height; } },
    Font: { semiboldSystemFont: size => ({ size, weight: 600 }), systemFont: size => ({ size, weight: 400 }), boldRoundedSystemFont: size => ({ size, weight: 700, rounded: true }) },
    SFSymbol: { named: name => ({ image: { symbol: name } }) },
    Device: { screenSize: () => ({ width: options.screenWidth || 375, height: 812 }) },
    UUID: { string: () => `generated-${writes}-${nodes.length}-${Math.random()}` },
    Script: { name: () => options.scriptName || "RemoteLauncher", setWidget(value) { rendered = value; }, complete() { complete = true; } },
    CalendarEvent, Calendar: { forEvents: async () => [{ title: "个人日历", allowsContentModifications: true }] },
    DocumentPicker: { open: async () => [options.importPath || "/docs/import.json"], exportString: async (...value) => { exported.push(value); } },
    Request: class {
      constructor(url) { this.url = url; requests.push(url); this.response = { statusCode: options.status || 200 }; }
      async loadJSON() {
        if (options.offline) throw Error("offline");
        if (this.url.includes("/manifest.json")) {
          if (options.manifestError) throw Error("manifest unavailable");
          return options.manifest ?? JSON.parse(readFileSync(new URL("../scripts/manifest.json", import.meta.url), "utf8"));
        }
        if (options.apiError) throw Error("directory unavailable");
        return options.entries || ["countdown", "parcel-list", "train-tickets", "countdown-list", "dashboard"].map(name => ({ type: "file", name: name + ".js" }));
      }
      async loadString() {
        if (options.offline) throw Error("offline");
        const name = this.url.split("/").at(-1).split(".js")[0];
        return options.sources?.[name] ?? readFileSync(new URL(`../scripts/${name}.js`, import.meta.url), "utf8");
      }
    },
  });
  const api = vm.runInContext(logicSource + "\n" + dashboardSource + "\n" + runtimeSource + "\n({logic:InfoLogic,suite:createInfoSuite(),renderDashboard:renderInfoDashboard})", context);
  return { ...api, files, nodes, dialogs, requests, exported, calendars, queue, context,
    evaluate: source => vm.runInContext(`(async()=>{${source}\n})()`, context),
    get rendered() { return rendered; }, get complete() { return complete; }, get calendarReads() { return calendarReads; },
    text() { const values = []; const visit = node => { if (node.kind === "text") values.push(node.value); for (const child of node.children || []) visit(child); }; visit(rendered); return values.join("\n"); },
  };
}
export const dataPath = key => key === "countdowns" ? "/docs/scriptable-countdown-events.json" : `/docs/scriptable-info-data/${{ parcels: "parcels", trains: "trains", settings: "dashboard", calendar: "calendar-cache" }[key]}.json`;
export const cachePath = name => `/docs/scriptable-remote-cache/kazeyo666-scriptable_ios-main-${name}.js`;
export const parcel = (id = "p1", extra = {}) => ({ id, company: "拼多多", code: "0956", station: "小区驿站", note: "", status: "pending", createdAt: "2026-10-09T00:00:00Z", ...extra });
export const train = (id = "t1", extra = {}) => ({ id, number: "G8603", from: "成都东", to: "重庆北", date: "2099-10-12", time: "08:35", endDate: "2099-10-12", endTime: "10:30", offset: "+08:00", seat: "二等座 03车05A", note: "", createdAt: "2026-10-09T00:00:00Z", ...extra });
// 模拟布局高度：固定 Stack 尺寸优先，文字按 1.2 倍字号估算，弹性 Spacer 不计。
export function estimatedHeight(node) {
  if (node.kind === "text") return (node.font?.size || 12) * 1.2;
  if (node.kind === "spacer") return node.value || 0;
  if (node.size?.height) return node.size.height;
  const heights = (node.children || []).filter(child => !node.horizontal || child.kind !== "spacer").map(estimatedHeight);
  const content = node.horizontal ? Math.max(0, ...heights) : heights.reduce((a, b) => a + b, 0);
  return content + (node.padding?.[0] || 0) + (node.padding?.[2] || 0);
}
