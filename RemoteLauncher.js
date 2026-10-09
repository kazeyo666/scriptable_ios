// Variables used by Scriptable.
// icon-color: blue; icon-glyph: download;

// 每次运行同步 scripts/ 下全部 .js，并安装到 Scriptable 脚本列表。
// App 内选择脚本，小组件用参数选择。
// 参数格式：脚本名|脚本参数，例如 countdown|生日。
const OWNER = "kazeyo666";
const REPO = "scriptable_ios";
const BRANCH = "main";
const DEFAULT_SCRIPT = "countdown";
// 即使目录 API 和远程清单都失败，也能尝试安装当前版本的核心组件。
const BUNDLED_SCRIPTS = ["countdown", "countdown-list", "dashboard", "parcel-list", "train-tickets"];
const parameter = String(args.widgetParameter || args.queryParameters?.remoteScript || "").trim();
const separator = parameter.indexOf("|");
let name = (separator < 0 ? parameter : parameter.slice(0, separator)).trim()
  .replace(/\.js$/, "") || DEFAULT_SCRIPT;
const scriptParameter = separator < 0 ? "" : parameter.slice(separator + 1).trim();
if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
  throw new Error("脚本名只能包含字母、数字、下划线和连字符。");
}

const fm = FileManager.local();
// 跟随入口的存储位置：启用 iCloud 时写入 iCloud，否则写入本地脚本目录。
const usesICloud = fm.isFileStoredIniCloud(module.filename);
const scriptFiles = usesICloud ? FileManager.iCloud() : fm;
const scriptsDir = scriptFiles.documentsDirectory();
const cacheDir = fm.joinPath(fm.documentsDirectory(), "scriptable-remote-cache");
fm.createDirectory(cacheDir, true);
const cachePrefix = `${OWNER}-${REPO}-${BRANCH}-`;
const rawBase = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/scripts/`;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function validateSource(source) {
  if (typeof source !== "string" || !source.trim() || /^\s*</.test(source)) {
    throw new Error("响应不是有效脚本，未覆盖旧缓存。");
  }
  let json = false;
  try { JSON.parse(source); json = true; } catch (_) { /* 脚本不是 JSON */ }
  if (json) throw new Error("响应为 JSON 数据，未覆盖旧缓存。");
  new AsyncFunction("args", source);
  return source;
}
const cachePathFor = script => fm.joinPath(cacheDir, `${cachePrefix}${script}.js`);
let names;
let discoveryNote = "";

try {
  const request = new Request(`https://api.github.com/repos/${OWNER}/${REPO}/contents/scripts?ref=${encodeURIComponent(BRANCH)}&t=${Date.now()}`);
  request.timeoutInterval = 15;
  request.headers = { Accept: "application/vnd.github+json" };
  const entries = await request.loadJSON();
  if (request.response.statusCode !== 200 || !Array.isArray(entries)) {
    throw new Error(`脚本目录读取失败：HTTP ${request.response.statusCode}`);
  }
  names = entries.filter(entry => entry.type === "file" && /^[a-zA-Z0-9_-]+\.js$/.test(entry.name))
    .map(entry => entry.name.slice(0, -3)).sort();
} catch (error) {
  console.warn(`无法读取远程目录：${error.message}；尝试备用脚本清单。`);
  try {
    const request = new Request(`${rawBase}manifest.json?t=${Date.now()}`);
    request.timeoutInterval = 15;
    const manifest = await request.loadJSON();
    if (request.response.statusCode !== 200 || manifest?.version !== 1 || !Array.isArray(manifest.scripts)
      || !manifest.scripts.length || !manifest.scripts.every(script => typeof script === "string" && /^[a-zA-Z0-9_-]+$/.test(script))) {
      throw new Error("备用脚本清单格式无效");
    }
    names = [...new Set(manifest.scripts)].sort();
    discoveryNote = "目录接口不可用，已通过备用清单发现脚本。";
  } catch (manifestError) {
    console.warn(`备用清单不可用：${manifestError.message}；尝试当前版本核心脚本和已有缓存。`);
    const cached = fm.listContents(cacheDir)
      .filter(file => file.startsWith(cachePrefix) && file.endsWith(".js"))
      .map(file => file.slice(cachePrefix.length, -3))
      .filter(script => /^[a-zA-Z0-9_-]+$/.test(script));
    names = [...new Set([...BUNDLED_SCRIPTS, ...cached])].sort();
    discoveryNote = "目录与备用清单不可用，已尝试安装当前版本的核心脚本。";
  }
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
    validateSource(source);
    fm.writeString(cachePathFor(script), source);
  }));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failures.set(batch[index], String(result.reason.message || result.reason));
      console.warn(`${batch[index]} 更新失败：${failures.get(batch[index])}`);
    }
  });
}

// 将缓存中的完整脚本安装到文档目录，作为可以单独运行的 .js 文件。
// 离线或个别下载失败时，仍能安装已存在的缓存。
const installFailures = new Map();
const installedNames = [];
for (const script of syncNames) {
  const cachePath = cachePathFor(script);
  if (!fm.fileExists(cachePath)) continue;
  const scriptPath = scriptFiles.joinPath(scriptsDir, `${script}.js`);
  try {
    if (scriptPath === module.filename) {
      throw new Error("与当前入口文件同名，请先将入口改名为 RemoteLauncher 再同步。");
    }
    const source = fm.readString(cachePath);
    validateSource(source);
    scriptFiles.writeString(scriptPath, source);
    if (!scriptFiles.fileExists(scriptPath)) throw new Error("写入后未找到脚本文件，请检查存储权限。");
    installedNames.push(script);
  } catch (error) {
    installFailures.set(script, String(error.message || error));
    console.warn(`${script} 安装失败：${installFailures.get(script)}`);
  }
}

if (config.runsInApp) {
  const report = new Alert();
  report.title = "脚本同步结果";
  report.message = `已安装 ${installedNames.length} 个脚本：${installedNames.length ? "\n" + installedNames.join("\n") : "无"}`
    + `\n保存位置：${usesICloud ? "iCloud" : "本机"} Scriptable 脚本目录。返回列表后打开。`
    + (discoveryNote ? `\n${discoveryNote}` : "")
    + (failures.size ? "\n下载失败（有缓存则使用旧版）：\n" + [...failures].map(([script, reason]) => `${script}：${reason}`).join("\n") : "")
    + (installFailures.size ? "\n安装失败：\n" + [...installFailures].map(([script, reason]) => `${script}：${reason}`).join("\n") : "");
  report.addAction("选择脚本运行");
  report.addCancelAction("返回列表");
  if (await report.presentAlert() < 0) {
    Script.complete();
  } else {
    await selectAndRun();
  }
} else {
  await selectAndRun();
}

async function selectAndRun() {
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
    const run = new AsyncFunction("args", validateSource(fm.readString(cachePath)));
    // 代理其余原生参数，单独传递脚本参数，不修改 Scriptable 的全局 args。
    const scriptArgs = new Proxy(args, {
      get(target, key) {
        return key === "widgetParameter" ? scriptParameter : target[key];
      },
    });
    await run(scriptArgs);
  }
}

