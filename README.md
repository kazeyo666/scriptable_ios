# scriptable

存放 iOS [Scriptable](https://scriptable.app/) 脚本，通过 GitHub Raw 远程加载。

## 目录

- `scripts/`：远程脚本，每个脚本一个 `.js` 文件。
- `RemoteLauncher.js`：复制到 Scriptable 的本地入口，每次运行下载指定脚本，下载失败时使用缓存。
- `scripts/hello.js`：用于检查远程加载的小组件示例。

## 发布到 GitHub

本地仓库已初始化，默认分支为 `main`，预设远程地址为 `git@github.com:kazeyo666/scriptable.git`。GitHub 上的仓库需要另行创建；为方便无登录远程加载，建议设为公开。

如果 GitHub 上尚未创建仓库，登录 GitHub CLI 后，在本目录执行：

```bash
gh auth login
gh repo create kazeyo666/scriptable --public --source=. --push
```

如果已经在网页创建了空仓库，直接执行：

```bash
git push -u origin main
```

若使用其他 GitHub 账号，请同时修改 `origin` 地址及 `RemoteLauncher.js` 的 `OWNER`。

## 在 Scriptable 中使用

1. 在 Scriptable 中新建脚本，把 `RemoteLauncher.js` 的内容粘贴进去并保存。
2. 仓库发布后，运行入口脚本，会下载并运行 `scripts/hello.js`。
3. 添加桌面 Scriptable 小组件，选择此入口脚本，在参数里填写脚本名，例如 `hello`，不需要 `.js` 后缀。
4. 把自己的脚本放入 `scripts/`，提交并推送到 GitHub 后，下次入口运行会下载新版本。桌面小组件的实际刷新时间由 iOS 调度。

示例 Raw 地址（发布后才可用）：

```text
https://raw.githubusercontent.com/kazeyo666/scriptable/main/scripts/hello.js
```

入口使用 Scriptable 的 [Request](https://docs.scriptable.app/request/) 下载脚本，并通过 [FileManager](https://docs.scriptable.app/filemanager/) 保存本地缓存。只有首次下载成功后，才能离线使用缓存。

远程脚本按独立脚本执行，支持顶层 `await`；需要复用本地模块时，可使用绝对路径。只加载你信任的脚本，公开仓库不要提交 Token、密码或私人配置，敏感值可放在设备的 Keychain 中。

## 更新脚本

```bash
git add .
git commit -m "Update scripts"
git push
```
