# Scriptable 中文信息小组件

在 iPhone 桌面或负一屏（今天视图）集中查看待取快递、火车票、倒计时和日历日程。支持小号、中号、大号，优先设计大号聚合面板。每个脚本可单独运行，手机不需要 npm、公共模块或浏览器 DOM。

原 `countdown.js` 保留原功能和数据格式。GitHub 只保存代码，私人记录使用 Scriptable 本地文件，不因更新脚本丢失。

新版 Dashboard 采用暖白/炭灰整张面板、日期标题、细分隔线和醒目的取件码、天数标签。可查看[浅色与深色预览](docs/dashboard-preview.png)；预览来自实际渲染树，字体与图标为浏览器近似效果，不是 iPhone 真机截图。

## 安装与首次使用

1. 安装 iOS [Scriptable](https://scriptable.app/)。
2. 复制 [RemoteLauncher.js](RemoteLauncher.js) 完整代码到 Scriptable 新脚本，命名为 `RemoteLauncher`。
3. 运行入口，它会发现 `scripts/` 下全部 `.js`，下载、校验并安装到脚本列表。
4. 同步完成选「返回列表」，点击 `dashboard` 打开管理菜单；也可在入口选择脚本运行。
5. 在「管理快递」「管理火车票」「管理倒计时」中添加记录，再选择「预览聚合组件 → 大号」。

已安装旧版入口的用户，这次请替换入口代码，以支持卡片点击后的管理跳转。原记录无需迁移。也可直接复制 `scripts/` 中任意完整脚本到 Scriptable；`dashboard.js` 可独立管理全部数据，不要求其他脚本已安装。

## 添加桌面与负一屏组件

1. 长按桌面空白处进入编辑模式，添加 **Scriptable** 小组件。
2. 聚合面板推荐大号；中号最多展示两个并列模块，小号一个模块，各尺寸按空间限制条数。
3. 编辑小组件，将 **Script** 选择为 `dashboard`，**Parameter** 填 `default`、`compact`，或留空使用默认面板。
4. 独立列表可选择 `parcel-list`、`train-tickets`、`countdown-list`。
5. 负一屏进入编辑模式，添加同样的 Scriptable 小组件，并选择脚本。

本版适配桌面/今天视图的小、中、大号，不适配锁屏圆形、行内、矩形组件，也没有 iPad 超大号专用布局。实际负一屏排版和点击行为需真机确认。

## 参数填写

| 功能 | 直接选择脚本 | 直接脚本 Parameter | RemoteLauncher Parameter |
| --- | --- | --- | --- |
| 默认聚合面板 | `dashboard` | `default` 或留空 | `dashboard\|default` |
| 紧凑聚合面板 | `dashboard` | `compact` | `dashboard\|compact` |
| 待取快递 | `parcel-list` | 留空 | `parcel-list` |
| 火车票 | `train-tickets` | 留空 | `train-tickets` |
| 多事件倒计时 | `countdown-list` | 留空 | `countdown-list` |
| 原单事件倒计时 | `countdown` | 事件名称，例如 `生日` | `countdown\|生日` |

入口保留 `脚本名|脚本参数`，竖线后的完整内容传入远程脚本。入口参数留空时，默认仍为原来的 `countdown`，App 内可选其他脚本。默认/紧凑面板的模块配置独立保存，主题共用。

直接使用已安装脚本的组件不访问 GitHub，适合离线使用并减少请求。使用入口的组件保留每次执行尝试同步全部脚本的行为。

## 快递：录入、批量展示与取件

运行 `parcel-list`，或在面板选择「管理快递」：

- 「新增记录」填写快递公司/来源、取件码、驿站和备注。取件码按文字保存，保留 `0956` 等前导零。
- 「选择记录」可编辑、删除、标记已取件、恢复待取件；记录选择按 15 条分页。
- 组件只显示待取记录，最新录入优先，标题显示待取总数，超出空间显示「另 N 条」。已取件仍保留在数据库。
- 「批量导入 JSON」可粘贴数组或选择 JSON 文件。校验并确认后追加；某条无效或 ID 冲突时整批拒绝。

演示信息示例：

```json
[
  { "company": "拼多多", "code": "3821", "station": "南门驿站", "note": "" },
  { "company": "京东快递", "code": "7164", "station": "南门驿站" },
  { "company": "圆通", "code": "0956", "station": "西门驿站" }
]
```

可选 `id`、`status`（`pending`/`collected`）、`createdAt`（带时区的 ISO 时间），省略时自动生成。没有人为保存条数上限，实际容量受设备存储和内存限制；组件只显示可容纳的前 N 条。

### 快捷指令与 URL Scheme

官方 [URLScheme](https://docs.scriptable.app/urlscheme/) 和 [args](https://docs.scriptable.app/args/) 提供运行脚本、查询参数、快捷指令参数能力。本项目实现了接收和确认路径，Mock 测试通过，仍需真实 iPhone 验证。

快捷指令使用「URL → 打开 URL」，示例：

```text
scriptable:///run?scriptName=parcel-list&action=add&company=%E5%9C%86%E9%80%9A&code=0956
```

每个中文字段分别 URL 编码。也支持 `payload` 参数，其值为 URL 编码的单条 JSON 对象或数组，不要编码整个 URL。自定义脚本名时修改 `scriptName`。

也可通过 Scriptable 运行脚本动作选择 `parcel-list`，把 JSON 文本/字典传给 `args.shortcutParameter`。为使用确认弹窗，请让动作在 Scriptable App 内运行；不是 App 环境时不导入。

外部输入先校验，弹窗确认后才保存。本机 URL 不发送给 GitHub，但内容可能留在快捷指令或系统记录中，不要写密码/Token。推荐通过快捷指令参数传递数据，不把私人内容固定在 URL 里。

本版**不自动读取拼多多、菜鸟、京东或短信**。没有确认到适用于个人取件码聚合的稳定授权接口，不使用抓 Cookie、逆向私有接口或虚构 API。见 [研究说明](docs/research.md)。

## 火车票：多行程管理

运行 `train-tickets`，或在面板选择「管理火车票」：

- 新增、编辑、删除多张车票，包含车次、日期、时间、站点、席别/座位、到达时间和备注。
- 按出发时间升序显示，每张车票用两行展示路线和车次/时间/席别，小尺寸减少条数。
- 默认隐藏已结束行程。填写到达日期/时间时以到达时刻判断；二者都留空时，以出发时刻作为隐藏阈值。菜单可切换显示全部行程。
- 默认时区 `+08:00`，不因设备切换地区改变出发时刻。可用其他固定 UTC 偏移或 `local`；后者跟随设备时区。本版没有 IANA 时区及跨季节夏令时规则编辑。
- 支持批量 JSON 导入，日期 `YYYY-MM-DD`、时间 `HH:mm`。

输入格式示例（不代表真实列车时刻）：

```json
[
  {
    "number": "G8603", "date": "2027-10-12", "time": "08:35",
    "from": "成都东", "to": "重庆北", "seat": "二等座 03车05A",
    "endDate": "2027-10-12", "endTime": "10:30", "offset": "+08:00"
  },
  {
    "number": "G8612", "date": "2027-10-15", "time": "18:20",
    "from": "重庆北", "to": "成都东", "seat": "二等座", "offset": "+08:00"
  }
]
```

「添加到 iOS 日历」会确认、请求权限、选择可写日历，创建独立日程。重复添加会产生重复日程，后续修改/删除车票不自动同步日历。无到达时间时暂按一小时创建日历日程。日历可能按用户选择账户的系统设置同步，该操作由用户主动选择。

不读取铁路 12306 App 内部数据，不自动获取订单。

## 多事件倒计时与原功能兼容

`countdown-list` 与面板直接读写原 `scriptable-countdown-events.json`，不建立第二份事件数据库：

- 原 `countdown` 管理菜单、默认事件和事件名称参数保留。
- 新列表和面板可新增、编辑、删除，也可设原单事件组件的默认事件。
- 按日期升序，今天显示「就是今天」，未来「还有 N 天」，过去「已过 N 天」。过期事件不自动删除。
- 按设备本地日历日期计数，避免当天剩余小时造成少一天；不自动按年或农历重复。

## 配置聚合面板

运行 `dashboard` 的中文菜单：

1. 预览聚合组件：大、中、小号。
2. 管理快递。
3. 管理火车票。
4. 管理倒计时。
5. 选择显示模块 / 条数：选择默认/紧凑配置，启用/禁用、设置条数（1—20）、切换空模块隐藏。
6. 调整显示顺序：选择模块和目标位置。
7. 修改组件主题：跟随系统、浅色、深色，以及六位 HEX 强调色，如 `#007AFF`。
8. 数据备份与恢复。
9. 日历授权与缓存。
10. 切换预览配置（默认/紧凑）。
11. 设置组件背景（透明/图片）：桌面截图裁剪、相册图片、文字颜色和暗色遮罩。

大号最多四个纵向分区，用细线分隔；中号两个并列分区，小号聚焦第一个有内容的启用模块。日期作为主标题，取件码使用醒目的数字字体，倒计时右侧显示剩余天数标签；今天和过期事件有明确文字。设置条数是上限，实际还要满足高度预算；超长文字单行缩放/截断。后续模块被省略时显示提示，数据全部保留在管理菜单。

日历默认关闭。启用后通过 [CalendarEvent.between](https://docs.scriptable.app/calendarevent/#-between) 读取指定天数的日程，存本地缓存。App 内打开面板时，缓存超过 15 分钟会尝试更新，也可手动刷新。Widget 仅读缓存，不弹权限；缓存超过一天提示刷新。

中、大号支持卡片区域点击，打开对应管理菜单；小号只有一个点击目标，打开当前组件管理入口后选择模块。依据 [WidgetStack.url](https://docs.scriptable.app/widgetstack/#url)，区域点击只支持中、大号。直接脚本、改名脚本和远程入口均使用当前脚本链接，实际系统跳转待真机确认。

## 设置透明背景和图片背景

先运行 `RemoteLauncher` 更新，再在 Scriptable 中打开 `dashboard` → **设置组件背景（透明/图片）**。背景由默认和紧凑面板共用，只影响 Dashboard。首次没有选图时继续使用主题背景。

**透明效果（桌面截图）**：

1. 在 iPhone 桌面长按进入编辑模式，滑到空白页并截图。保持同一张桌面壁纸、显示缩放和图标大小。
2. 选择“制作透明背景（桌面截图）”，选择大、中、小号和桌面位置，从相册选刚才的截图。
3. 在本地裁剪页面拖动白框，拖动右下角蓝点调整宽高；也可填写 X、Y、宽、高像素值。初始选框只是参考，需要按桌面实际组件边界校准，可先截一张带组件的桌面图作为位置参考。
4. 点“确认裁剪范围”，再点页面顶部的完成按钮返回，裁剪图片才会保存；直接关闭或确认后再次调整而未重新确认则取消。
5. 把 Dashboard 放到所选位置并检查效果。换壁纸、位置、显示缩放或图标大小后重新制作。不同组件尺寸需分别设置，同一尺寸目前保存一个位置。

透明效果通过壁纸裁剪模拟，不会透视桌面；截图需与实际组件宽高一致，裁剪页面不根据机型表宣称自动精确定位。透明背景不加遮罩，深浅壁纸可分别选白色或深色文字。动态壁纸、系统壁纸变化和负一屏无法保证对齐，负一屏建议使用图片背景。

**相册图片**：选择“选择相册图片背景”，授权后选图，自动生成三个尺寸的居中裁剪图片。可设置白色/深色文字和 0—80% 暗色遮罩（默认 25%）；遮罩只用于相册图片。支持“恢复主题背景”，也可切回已保存的透明背景或相册图片。

图片通过 [Photos.fromLibrary](https://docs.scriptable.app/photos/#-fromlibrary) 选择，裁剪界面用本地 [WebView](https://docs.scriptable.app/webview/)，实际裁剪用 [DrawContext](https://docs.scriptable.app/drawcontext/)；不上传图片，也不加载远程裁剪服务。设置在 App 内进行，小组件只读本地 PNG，缺少当前尺寸或图片损坏时回退主题并提示。图片不会因为更新 JS 被删除。

## 远程更新与离线

- 入口发现 `scripts/` 直接包含的 `.js`，分批下载全部脚本。目录接口失败时读取 GitHub Raw 的 `scripts/manifest.json`；清单也失败时尝试内置的五个核心脚本及已有缓存，不再只更新旧缓存而漏掉 Dashboard。文件名支持字母、数字、下划线和连字符。
- 成功 HTTP 响应还需排除 HTML、JSON 和语法错误，才覆盖缓存；安装和执行缓存时再次检查。
- 这是格式/语法检查，不是代码签名或沙箱。只从可信仓库更新。
- 个别失败保留有效缓存，不影响其他脚本更新；首次无缓存且离线不能完成下载。
- 安装到入口所在的本地/iCloud 脚本文档目录，出现在脚本列表。目录行为见 [FileManager](https://docs.scriptable.app/filemanager/#-documentsdirectory)。
- 同名 `.js` 更新会覆盖设备代码，**不会覆盖数据 JSON**。代码修改请在 GitHub 完成。
- 不自动删除旧脚本/缓存；脚本与入口同名时跳过安装并提示改名。
- 手机入口自身仍需手动替换。直接运行已安装组件不更新代码，要更新请运行 `RemoteLauncher`。
- GitHub 请求失败或限流时使用缓存。减少请求可让桌面组件直接选择已安装脚本。

新组件请求 30 分钟后允许刷新，原倒计时保留午夜刷新请求。**实际刷新由 iOS 决定，不能保证实时或精确按时刷新。**

## 数据备份与恢复

私人数据只使用 `FileManager.local()`，即使代码装在 iCloud，记录也不写入 iCloud 脚本目录或上传 GitHub：

```text
本地 Documents/
  scriptable-countdown-events.json       原倒计时数据库（共用）
  scriptable-info-data/
    parcels.json                        快递
    trains.json                         车票及隐藏设置
    dashboard.json                      面板与主题配置
    calendar-cache.json                 日历缓存
    backgrounds/                        本地原图、图片背景和透明裁剪图
  scriptable-remote-cache/               代码缓存
```

读写校验格式并保存 `.last-good` 有效快照。损坏原文件保留，新组件显示有效快照并提示；损坏时禁止普通编辑，避免覆盖。配置损坏不令整个组件无法显示。

备份菜单可导出完整 JSON 文件、校验并确认恢复全部数据、恢复单个文件的有效快照。完整恢复替换快递、车票、倒计时和配置；原文件保留 `.before-restore-*` 副本，写入失败尝试回滚。无有效快照时需导入先前备份。

备份格式：`{"format":"scriptable-info-backup","version":1,"exportedAt":"ISO 时间","data":{"parcels":...,"trains":...,"countdowns":...,"settings":...}}`。日历缓存不备份，可重新刷新。背景设置会备份，但 PNG 图片不包含在 JSON 中，换设备或重装 App 后需重新选择图片/截图；同一设备上的现有图片保留。单项 JSON 导入追加记录，完整恢复替换记录。

备份包含私人信息，只保存到你选的位置，不要上传公开仓库。数据不自动跨设备同步，卸载 App 前请导出备份。原 `countdown` 没有新增恢复菜单，文件损坏可用新列表或面板恢复。

## 常见问题与限制

- **新增脚本没出现？** 替换最新入口并运行；同步结果会逐个列出已安装脚本、保存位置及下载/安装错误。确认列表包含 `dashboard`，再返回 Scriptable 列表；若文件已安装但列表未刷新，重新打开 App。
- **组件没有最新记录？** 先 App 预览确认，再等待系统刷新。检查 Script 和参数，直接 `dashboard` 不填 `dashboard|default`。
- **显示不全？** 选择大号、调整顺序和条数；组件尺寸限制不影响保存数量。
- **日历空白？** 启用、允许权限、刷新缓存。关闭日历会清除当前缓存。
- **文件损坏？** 使用快照或完整备份恢复，不要重新录入覆盖原文件。
- **超长文字？** 小组件截断，管理表单保留完整内容。
- **快捷指令未导入？** 检查脚本名称、编码、JSON 和 App 运行环境；需输入确认及真机验证。
- **其他 App 自动读取？** 没有，第一版使用手动、JSON、快捷指令和官方日历 API。
- **透明背景对不上？** 检查选图、裁剪像素、组件尺寸和位置；初始框需校准。负一屏建议使用图片背景。
- 更多外部数据源、锁屏组件不属于本版功能。

## 目录与开发

```text
RemoteLauncher.js
scripts/
  countdown.js            原单事件组件（原代码保留）
  parcel-list.js          快递列表
  train-tickets.js        火车票
  countdown-list.js       多事件倒计时
  dashboard.js            聚合面板
  manifest.json           自动生成的备用发现清单
src/
  logic.js                校验、排序、日期与布局预算
  background.js           本地图片处理与透明背景裁剪界面
  dashboard.js            聚合面板专用呈现层
  runtime.js              本地存储、提供器、渲染、中文交互
tools/
  build.mjs               生成四个完整独立脚本
  check.mjs               语法、一致性、自动化检查
  preview.mjs             从实际渲染树生成浏览器预览
tests/                    纯逻辑和 Scriptable Mock
docs/                     研究记录及真机验收步骤
```

手机不依赖 `shared/`。在开发电脑修改 `src/` 后生成并检查，无需 npm install：

```bash
node tools/build.mjs
node tools/check.mjs
git add README.md RemoteLauncher.js scripts src tools tests docs
git commit -m "更新信息组件"
git push origin main
```

扩展模块时在逻辑模块清单、`section` 数据提供器、`renderSection` 渲染层注册，使用独立缓存和错误隔离，再生成脚本。参考研究见 [research.md](docs/research.md)，测试与真机清单见 [validation.md](docs/validation.md)。自动化通过不等于 iOS 真机验证完成。
