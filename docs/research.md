# 参考项目与接口研究

研究日期：2026-10-09。新组件自主编写，没有复制以下项目的源码，仅参考组织方式与交互思路。未引入第三方运行依赖。以后直接复用时应检查具体文件许可并保留版权声明；仓库公开不等于允许复制。

| 项目 | 已检查内容 | 本项目取舍 |
| --- | --- | --- |
| [Weather-Cal](https://github.com/mzeryck/Weather-Cal) | README 的容器/模块架构和布局；[weather-cal-code.js](https://github.com/mzeryck/Weather-Cal/blob/main/weather-cal-code.js) 的创建、配置与下载逻辑。仓库标示 MIT。 | 数据模块提供内容，Stack 组织布局，Alert 管理；未引入动态公共模块，生成独立脚本兼容现有入口。 |
| [yaylinda/scriptable](https://github.com/yaylinda/scriptable) | README 和 [Cache.js](https://github.com/yaylinda/scriptable/blob/main/Cache.js) 的文件缓存、到期处理；该文件还注明原作者来源。 | 记录与缓存分离，但私人数据只用本地目录，未采用其 iCloud 缓存代码。 |
| [rushhiii/Scriptable-iOSWidgets](https://github.com/rushhiii/Scriptable-iOSWidgets) | README、文件清单和 [MyCountdowns.js](https://github.com/rushhiii/Scriptable-iOSWidgets/blob/main/Widgets/Countdown%20Widget/MyCountdowns.js) 的尺寸、布局与缓存实现。仓库标示 MIT。 | 独立的尺寸/配置模式；不使用 Google Sheets 或 Notion，保持记录本地存储。 |
| [dompling/Scriptable](https://github.com/dompling/Scriptable) | README 的安装、参数、BoxJS 说明和 [JDWuLiu.js](https://github.com/dompling/Scriptable/blob/master/Scripts/JDWuLiu.js) 的账户请求方式。未在仓库首页确认明确许可证。 | 保留安装入口体验，未使用抓 Cookie、BoxJS、代理脚本或其接口代码。 |

## 快递接口边界

[京东物流开放平台](https://open.jdl.com/) 的公开介绍面向企业物流集成；[京东开放平台](https://jos.jd.com/) 介绍用户授权与调用凭证机制。不能据此推断有无需授权、供个人小组件读取全部订单取件码的接口。

[菜鸟速递接口平台](https://openapi.express.cainiao.com/) 的搜索索引说明面向商家集成与运单查询，此次未直接读到页面正文；[菜鸟运单查询](https://express.cainiao.com/query-mail.html) 是查询入口，不等于个人待取件和取件码聚合 API。

[拼多多开放平台](https://open.pinduoduo.com/) 此次未能读取完整文档，未核实到适合本项目个人场景的稳定取件码 API。

dompling 的物流示例依赖账户 Cookie/BoxJS，不能当作官方稳定接口支持的证据。本次**未确认可合法稳定接入三个平台个人取件信息的接口**，不代表断言所有商业授权场景均不存在接口。

第一版使用手动、JSON 和快捷指令接收，不读取其他 App 内部数据、不抓 Cookie、不虚构 API。未来有具体官方文档、权限与授权协议时再新增适配器。

## Scriptable API 依据

- [Alert](https://docs.scriptable.app/alert/)：文本字段用 `presentAlert`，列表用 `presentSheet`，取消返回 -1。
- [URLScheme](https://docs.scriptable.app/urlscheme/) / [args](https://docs.scriptable.app/args/)：脚本运行 URL、查询参数和快捷指令参数有公开 API；输入链路 Mock 已覆盖，尚未在 iPhone 执行。
- [FileManager](https://docs.scriptable.app/filemanager/)：脚本写入文档目录，私人记录仅本地；iCloud 文件导入先下载。
- [DocumentPicker](https://docs.scriptable.app/documentpicker/)：导入 JSON 文件，`exportString` 导出备份。
- [CalendarEvent](https://docs.scriptable.app/calendarevent/) / [Calendar](https://docs.scriptable.app/calendar/)：读取范围、创建日程及选择可写日历；只在 App 主动授权后操作。
- [WidgetStack.url](https://docs.scriptable.app/widgetstack/#url)：中/大号区域点击，小号仅单一组件点击。
- [ListWidget](https://docs.scriptable.app/listwidget/)：刷新由系统调度，不能承诺实时。

## 兼容与扩展

`src/` 是开发源码，四个新组件由构建工具生成完整 `.js` 并提交到 `scripts/`。手机不依赖公共目录、Node 或 DOM。原入口的发现、全量下载、缓存、安装功能保留；补充异常响应检查和管理跳转参数转发。原倒计时代码、数据库路径、字段不变。

新组件的数据源和渲染逻辑分离，单源错误不会破坏其他模块。用户数据和代码缓存分离，更新只写 `.js`，不清理 JSON。直接组件无需联网，入口仍按原授权行为每次同步全部脚本。
