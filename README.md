# scriptable_ios

存放 iOS [Scriptable](https://scriptable.app/) 脚本，通过 GitHub Raw 远程加载。

## 目录

- `scripts/`：远程脚本，每个脚本一个 `.js` 文件。
- `RemoteLauncher.js`：复制到 Scriptable 的本地入口，每次运行同步全部远程脚本，下载失败时使用缓存。
- `scripts/hello.js`：用于检查远程加载的小组件示例。
- `scripts/countdown.js`：通过菜单管理多个倒计时，事件保存在设备本地。

## 发布到 GitHub

本地仓库已初始化，默认分支为 `main`，预设远程地址为 `git@github.com:kazeyo666/scriptable_ios.git`。GitHub 上的仓库需要另行创建；为方便无登录远程加载，建议设为公开。

如果 GitHub 上尚未创建仓库，登录 GitHub CLI 后，在本目录执行：

```bash
gh auth login
gh repo create kazeyo666/scriptable_ios --public --source=. --push
```

如果已经在网页创建了空仓库，直接执行：

```bash
git push -u origin main
```

若使用其他 GitHub 账号，请同时修改 `origin` 地址及 `RemoteLauncher.js` 的 `OWNER`。

## 在 Scriptable 中使用

1. 在 Scriptable 中新建脚本，把 `RemoteLauncher.js` 的内容粘贴进去并保存。
2. 运行入口脚本，会同步 `scripts/` 下全部 `.js`，然后弹出脚本选择菜单。选 `countdown` 打开倒计时管理菜单，选 `hello` 预览示例。
3. 添加桌面 Scriptable 小组件，选择此入口脚本，在参数里填写脚本名，例如 `hello`，不需要 `.js` 后缀。
4. 把自己的脚本放入 `scripts/`，提交并推送到 GitHub 后，下次入口运行会下载新版本。桌面小组件的实际刷新时间由 iOS 调度。

示例 Raw 地址（发布后才可用）：

```text
https://raw.githubusercontent.com/kazeyo666/scriptable_ios/main/scripts/hello.js
```

入口通过 GitHub 目录 API 发现 `scripts/` 下的脚本，使用 Scriptable 的 [Request](https://docs.scriptable.app/request/) 分批下载全部脚本，并通过 [FileManager](https://docs.scriptable.app/filemanager/) 保存本地缓存。App 和桌面组件每次运行都会同步全部脚本，再执行选中的脚本。只有首次下载成功后，才能离线使用缓存。目录读取失败时按已有缓存和默认/指定脚本尝试下载；个别脚本下载或语法检查失败时保留旧缓存，其他脚本仍可更新。

同步范围为 `scripts/` 目录直接包含的 `.js` 文件，文件名只支持字母、数字、下划线和连字符。以后新增脚本并推送到 GitHub 后，入口下次成功读取目录即可自动发现。脚本缓存不自动删除。手机中的入口本身仍需手动替换；远程脚本不需要逐个复制到 App。

远程脚本按独立脚本执行，支持顶层 `await`；需要复用本地模块时，可使用绝对路径。只加载你信任的脚本，公开仓库不要提交 Token、密码或私人配置，敏感值可放在设备的 Keychain 中。

## 多事件倒计时

### 直接安装（最简单）

1. 打开 [`scripts/countdown.js`](scripts/countdown.js)，复制全部代码到 Scriptable 的新脚本，命名为「倒计时」。
2. 在 App 内运行「倒计时」，选择「添加事件」，填写名称、日期和可选文案。日期格式为 `YYYY-MM-DD`，例如 `2027-01-01`。
3. 添加桌面 Scriptable 小组件，编辑小组件，将 Script 选择为「倒计时」。
4. Parameter 填事件名称，例如 `生日`。添加多个组件，分别填不同名称即可共用这一个脚本。
5. 参数留空显示默认事件。再次运行脚本，或点击组件打开菜单，可修改、删除、设置默认事件和预览。

### 使用远程入口

1. 将最新的 `RemoteLauncher.js` 复制到 Scriptable，保存为「倒计时入口」。旧版入口需要重新复制一次代码，才能使用同步全部脚本和选择菜单。
2. 运行一次入口，在脚本选择菜单选 `countdown`，添加事件。点击桌面组件后同样可以选择 `countdown` 进入管理菜单。
3. 桌面小组件选择「倒计时入口」，Parameter 填 `countdown|生日`、`countdown|纪念日` 等；填 `countdown` 或留空显示默认事件。

远程入口参数格式为 `脚本名|脚本参数`，入口把竖线之后的完整内容传给远程脚本的 `args.widgetParameter`。原来的 `hello` 参数仍然可用。

事件数据位于 Scriptable 本地 Documents 下的 `scriptable-countdown-events.json`，直接安装和远程加载共用这些事件。事件日期不写入代码，也不会上传到 GitHub；修改或更新脚本不会清除事件。数据不跨设备同步；删除 App 前请备份该文件。配置读取失败时保留原文件并提示错误。

倒计时按设备本地日历日期计算：明天显示 1，今天显示 0，过期显示已过去的天数。事件是一次性公历日期，不自动按年或农历重复。组件使用纯色背景，支持桌面小号、中号、大号，暂不提供图片或透明背景。脚本请求午夜后刷新，实际刷新仍由 iOS 决定。

## 更新脚本

```bash
git add .
git commit -m "Update scripts"
git push
```
