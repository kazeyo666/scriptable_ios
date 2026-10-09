// Variables used by Scriptable.
// icon-color: blue; icon-glyph: download;

// 桌面组件参数填写脚本名，例如 hello；留空默认运行 hello。
const OWNER = "kazeyo666";
const REPO = "scriptable_ios";
const BRANCH = "main";
const name = String(args.widgetParameter || "hello").trim().replace(/\.js$/, "");
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
  run = new AsyncFunction(source);
  fm.writeString(cachePath, source);
} catch (error) {
  console.warn(`远程更新失败：${error.message}`);
  if (!fm.fileExists(cachePath)) throw error;
  run = new AsyncFunction(fm.readString(cachePath));
  console.warn("使用上次下载的脚本缓存。");
}

await run();

