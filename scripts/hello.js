// Variables used by Scriptable.
// icon-color: blue; icon-glyph: magic;

const widget = new ListWidget();
widget.backgroundColor = new Color("#16213e");
const title = widget.addText("Hello, Scriptable!");
title.textColor = Color.white();
title.font = Font.boldSystemFont(18);
widget.addSpacer(8);
const subtitle = widget.addText("脚本已从 GitHub 远程加载");
subtitle.textColor = new Color("#b8c5e0");
subtitle.font = Font.systemFont(12);
widget.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);

Script.setWidget(widget);
if (!config.runsInWidget) await widget.presentSmall();
Script.complete();

