// Variables used by Scriptable.
// icon-color: blue; icon-glyph: download;

// 参数格式：脚本名|脚本参数，例如 countdown|生日；留空运行默认脚本。
const OWNER = "kazeyo666";
const REPO = "scriptable_ios";
const BRANCH = "main";
const DEFAULT_SCRIPT = "countdown";
const parameter = String(args.widgetParameter || "").trim();
const separator = parameter.indexOf("|");
const name = (separator < 0 ? parameter : parameter.slice(0, separator)).trim()
  .replace(/\.js$/, "") || DEFAULT_SCRIPT;
const scriptParameter = separator < 0 ? "" : parameter.slice(separator + 1).trim();
if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
  throw new Error("脚本名只能包含字母、数字、下划线和连字符。");
}

const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.documentsDirectory(), "scriptable-remote-cache");
fm.createDirectory(cacheDir, true);
const cachePath = fm.joinPath(cacheDir, `${OWNER}-${REPO}-${BRANCH}-${name}.js`);
const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/scripts/${name}.js`;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
let run;

try {
  const request = new Request(`${url}?t=${Date.now()}`);
  request.timeoutInterval = 15;
  const source = await request.loadString();
  const status = request.response.statusCode;
  if (status !== 200 || !source.trim()) {
    throw new Error(`下载失败：HTTP ${status}`);
  }
  run = new AsyncFunction("args", source);
  fm.writeString(cachePath, source);
} catch (error) {
  console.warn(`远程更新失败：${error.message}`);
  if (!fm.fileExists(cachePath)) throw error;
  run = new AsyncFunction("args", fm.readString(cachePath));
  console.warn("使用上次下载的脚本缓存。");
}

// 代理其余原生参数，单独传递脚本参数，不修改 Scriptable 的全局 args。
const scriptArgs = new Proxy(args, {
  get(target, key) {
    return key === "widgetParameter" ? scriptParameter : target[key];
  },
});
await run(scriptArgs);

