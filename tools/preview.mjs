// 从实际 Scriptable 渲染树生成浏览器预览；只使用虚构示例，非 iPhone 截图。
import { writeFileSync } from "node:fs";
import { harness } from "../tests/helpers.mjs";

const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function color(value, dark) {
  if (!value) return "inherit";
  if (value.light) return color(dark ? value.dark : value.light, dark);
  if (value.alpha < 1) return `color-mix(in srgb, ${value.value} ${value.alpha * 100}%, transparent)`;
  return value.value;
}
function render(node, dark, parentHorizontal = false) {
  if (node.kind === "spacer") return node.value === undefined ? '<i style="flex:1"></i>'
    : `<i style="flex-shrink:0;${parentHorizontal ? "width" : "height"}:${node.value}px"></i>`;
  if (node.kind === "text") return `<span style="font-size:${node.font.size}px;font-weight:${node.font.weight};color:${color(node.textColor, dark)};${node.font.rounded ? "font-variant-numeric:tabular-nums;letter-spacing:.3px;" : ""}">${escape(node.value)}</span>`;
  if (node.kind === "image") {
    const paths = { shippingbox: "M2 4 8 1l6 3v9l-6 3-6-3z M2 4l6 3 6-3 M8 7v9 M5 2.5l6 3", tram: "M4 2h8v10H4z M4 7h8 M5 14l-1 2 M11 14l1 2 M6 10h0 M10 10h0", calendar: "M2 4h12v11H2z M2 7h12 M5 2v4 M11 2v4", flag: "M3 16V2h10l-2 4 2 4H3" };
    return `<svg width="${node.imageSize.width}" height="${node.imageSize.height}" viewBox="0 0 16 18" fill="none" stroke="${color(node.tintColor, dark)}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[node.image.symbol] || paths.calendar}"/></svg>`;
  }
  const style = ["display:flex", `flex-direction:${node.horizontal ? "row" : "column"}`, "min-width:0", "flex-shrink:0"];
  if (node.horizontal) style.push("align-items:center");
  if (node.padding) style.push(`padding:${node.padding.map(n => n + "px").join(" ")}`);
  if (node.backgroundColor) style.push(`background:${color(node.backgroundColor, dark)}`);
  if (node.cornerRadius) style.push(`border-radius:${node.cornerRadius}px`);
  if (node.size?.height) style.push(`height:${node.size.height}px`);
  if (node.size?.width) style.push(`width:${node.size.width}px`);
  return `<div style="${style.join(";")}">${(node.children || []).map(child => render(child, dark, Boolean(node.horizontal))).join("")}</div>`;
}
const h = harness({ screenWidth: 390 });
const sections = [
  { id: "parcels", title: "待取快递", count: 3, maxItems: 3, rows: [
    { kind: "parcel", code: "3821", company: "拼多多", station: "南门驿站" },
    { kind: "parcel", code: "7164", company: "京东快递", station: "丰巢自提柜" },
    { kind: "parcel", code: "0956", company: "圆通", station: "西门驿站" },
  ] },
  { id: "trains", title: "近期出行", count: 1, maxItems: 2, rows: [{ main: "10/12 成都东 → 重庆北", detail: "G8603 · 08:35 · 二等座", lines: 2 }] },
  { id: "calendar", title: "日程", count: 1, maxItems: 2, rows: [{ main: "10/15 项目交付", detail: "14:00" }] },
  { id: "countdowns", title: "重要倒计时", count: 2, maxItems: 2, rows: [
    { kind: "countdown", name: "会员到期", days: 15 }, { kind: "countdown", name: "生日", days: 32 },
  ] },
];
function widget(family, mode) {
  const settings = h.logic.defaults(); settings.theme.mode = mode;
  const tree = h.renderDashboard({ sections, settings, family, urlFor: () => "#", warning: "", now: new Date(2026, 9, 9, 12) });
  const dimensions = family === "large" ? [338, 354] : family === "medium" ? [338, 158] : [158, 158];
  return `<div class="widget ${mode}" style="width:${dimensions[0]}px;height:${dimensions[1]}px">${render(tree, mode === "dark")}</div>`;
}
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard 设计预览</title><style>
*{box-sizing:border-box}body{margin:0;background:#E7E8E5;font-family:"Noto Sans CJK SC",sans-serif;color:#25313A}main{max-width:1100px;margin:auto;padding:50px 50px 40px}header{display:flex;align-items:end;justify-content:space-between;margin-bottom:34px}h1{font-size:32px;font-weight:600;letter-spacing:-1px;margin:0 0 9px}p{font-size:12px;color:#69757C;margin:0;line-height:1.7}.tag{font-size:11px;letter-spacing:1px;color:#63727A}.grid{display:flex;gap:44px}.column{display:flex;flex-direction:column;gap:18px}h2{font-size:11px;font-weight:500;margin:0;color:#647078;letter-spacing:2px}.widget{overflow:hidden;border-radius:25px;box-shadow:0 12px 28px #14202B13}.widget>div{height:100%}.widget span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;line-height:1.18}.widget svg{flex-shrink:0}.caption{margin-top:34px;max-width:780px}.smalls{display:flex;gap:22px}
</style><main><header><div><h1>把日常，整理得刚刚好。</h1><p>Dashboard · 日期、取件、行程与重要时刻</p></div><div class="tag">设计预览 / 示意数据</div></header><div class="grid"><div class="column"><h2>浅色 · 大号</h2>${widget("large", "light")}<h2>浅色 · 中号</h2>${widget("medium", "light")}</div><div class="column"><h2>深色 · 大号</h2>${widget("large", "dark")}<h2>小号 · 聚焦首个模块</h2><div class="smalls">${widget("small", "light")}${widget("small", "dark")}</div></div></div><p class="caption">预览来自实际组件渲染树，使用演示数据。浏览器字体与图标用于近似展示；iPhone 上由 Scriptable 原生绘制，具体尺寸与排版以真机为准。</p></main></html>`;
writeFileSync(new URL("../docs/dashboard-preview.html", import.meta.url), html);
console.log("已生成 docs/dashboard-preview.html（真实渲染树的浏览器近似预览）");
