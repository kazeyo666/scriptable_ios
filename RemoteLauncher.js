// Variables used by Scriptable.
// icon-color: blue; icon-glyph: download;

// 每次运行同步 scripts/ 下全部 .js；App 内选择脚本，小组件用参数选择。
// 参数格式：脚本名|脚本参数，例如 countdown|生日。
const OWNER = "kazeyo666";
const REPO = "scriptable_ios";
const BRANCH = "main";
const DEFAULT_SCRIPT = "countdown";
const parameter = String(args.widgetParameter || "").trim();
const separator = parameter.indexOf("|");
let name = (separator < 0 ? parameter : parameter.slice(0, separator)).trim()
  .replace(/\.js$/, "") || DEFAULT_SCRIPT;
const scriptParameter = separator < 0 ? "" : parameter.slice(separator + 1).trim();
if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
  throw new Error("脚本名只能包含字母、数字、下划线和连字符。");
}

const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.documentsDirectory(), "scriptable-remote-cache");
fm.createDirectory(cacheDir, true);
const cachePrefix = `${OWNER}-${REPO}-${BRANCH}-`;
const rawBase = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/scripts/`;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const cachePathFor = script => fm.joinPath(cacheDir, `${cachePrefix}${script}.js`);
let names;

try {
  const request = new Request(`https://api.github.com/repos/${OWNER}/${REPO}/contents/scripts?ref=${encodeURIComponent(BRANCH)}`);
  request.timeoutInterval = 15;
  request.headers = { Accept: "application/vnd.github+json" };
  const entries = await request.loadJSON();
  if (request.response.statusCode !== 200 || !Array.isArray(entries)) {
    throw new Error(`脚本目录读取失败：HTTP ${request.response.statusCode}`);
  }
  names = entries.filter(entry => entry.type === "file" && /^[a-zA-Z0-9_-]+\.js$/.test(entry.name))
    .map(entry => entry.name.slice(0, -3)).sort();
} catch (error) {
  console.warn(`无法读取远程目录：${error.message}；按本地缓存尝试更新。`);
  names = fm.listContents(cacheDir)
    .filter(file => file.startsWith(cachePrefix) && file.endsWith(".js"))
    .map(file => file.slice(cachePrefix.length, -3))
    .filter(script => /^[a-zA-Z0-9_-]+$/.test(script)).sort();
}

// 目录 API 不可用时，首次安装仍可尝试直接下载默认/指定脚本。
const syncNames = [...new Set([...names, name])];
const failures = new Map();
// 分批下载，避免脚本数量增加后产生过多并发请求。
for (let offset = 0; offset < syncNames.length; offset += 3) {
  const batch = syncNames.slice(offset, offset + 3);
  const results = await Promise.allSettled(batch.map(async script => {
    const request = new Request(`${rawBase}${script}.js?t=${Date.now()}`);
    request.timeoutInterval = 15;
    const source = await request.loadString();
    if (request.response.statusCode !== 200 || !source.trim()) {
      throw new Error(`下载失败：HTTP ${request.response.statusCode}`);
    }
    // 语法检查成功后才覆盖该脚本缓存。
    new AsyncFunction("args", source);
    fm.writeString(cachePathFor(script), source);
  }));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failures.set(batch[index], String(result.reason.message || result.reason));
      console.warn(`${batch[index]} 更新失败：${failures.get(batch[index])}`);
    }
  });
}

let cancelled = false;
if (config.runsInApp && !parameter) {
  const available = syncNames.filter(script => fm.fileExists(cachePathFor(script)));
  available.sort((a, b) => a === DEFAULT_SCRIPT ? -1 : b === DEFAULT_SCRIPT ? 1 : a.localeCompare(b));
  if (available.length) {
    const menu = new Alert();
    menu.title = "选择脚本";
    const updated = syncNames.length - failures.size;
    menu.message = `已更新 ${updated} 个脚本。${failures.size ? `\n${failures.size} 个更新失败，有缓存的脚本仍可运行。` : ""}`;
    available.forEach(script => menu.addAction(script + (failures.has(script) ? "（使用缓存）" : "")));
    menu.addCancelAction("取消");
    const choice = await menu.presentSheet();
    if (choice < 0) cancelled = true;
    else name = available[choice];
  }
}

if (cancelled) {
  Script.complete();
} else {
  const cachePath = cachePathFor(name);
  if (!fm.fileExists(cachePath)) {
    throw new Error(`无法加载 ${name}.js：${failures.get(name) || "没有本地缓存"}\n下载地址：${rawBase}${name}.js`);
  }
  if (failures.has(name)) console.warn(`${name} 使用上次下载的脚本缓存。`);
  const run = new AsyncFunction("args", fm.readString(cachePath));
  // 代理其余原生参数，单独传递脚本参数，不修改 Scriptable 的全局 args。
  const scriptArgs = new Proxy(args, {
    get(target, key) {
      return key === "widgetParameter" ? scriptParameter : target[key];
    },
  });
  await run(scriptArgs);
}

