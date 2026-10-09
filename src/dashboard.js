// Dashboard 专用呈现层：整张面板、留白和分隔线，保留原独立列表样式。
function renderInfoDashboard({ sections, settings, family, urlFor, warning, backgroundImage, now = new Date() }) {
  const L = InfoLogic, large = family === "large", small = family === "small";
  const mode = settings.theme.mode;
  const adaptive = (light, dark) => mode === "system" ? Color.dynamic(new Color(light), new Color(dark)) : new Color(mode === "dark" ? dark : light);
  const colors = { background: adaptive("#F7F6F2", "#15191D"), text: adaptive("#202A33", "#F1F3F5"),
    muted: adaptive("#67727B", "#A1ABB4"), line: adaptive("#E0E2DF", "#30373D"),
    accent: new Color(settings.theme.accent), tint: new Color(settings.theme.accent, 0.10) };
  if (backgroundImage) {
    const light = settings.background.text === "light";
    colors.text = new Color(light ? "#FFFFFF" : "#17212B");
    colors.muted = new Color(light ? "#FFFFFF" : "#17212B", 0.80);
    colors.line = new Color(light ? "#FFFFFF" : "#17212B", 0.20);
    colors.accent = colors.text; colors.tint = colors.line;
  }
  const widget = new ListWidget(); widget.backgroundColor = colors.background;
  if (backgroundImage) widget.backgroundImage = backgroundImage;
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
  if (warning) { text(widget, warning, 9, colors.muted); widget.addSpacer(3); }
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
