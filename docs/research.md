# 参考项目与接口研究

研究日期：2026-10-09。数据管理、布局和运行逻辑自主编写，仅参考以下项目的组织方式与交互思路。后续自动透明背景功能复用了有 MIT 授权的 Widget-Blur 像素测量表，具体声明见下方。未引入第三方运行依赖。以后直接复用时应检查具体文件许可并保留版权声明；仓库公开不等于允许复制。

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

`src/` 是开发源码，四个组件由构建工具生成完整 `.js` 并提交到 `scripts/`。手机不依赖公共目录、Node 或 DOM。原入口的发现、全量下载、缓存、安装功能保留；补充异常响应检查和管理跳转参数转发。原倒计时管理功能、数据库路径和基础字段保留，交互菜单精简；新增可选生日历法与闰月字段，并共用生日计算逻辑。

新组件的数据源和渲染逻辑分离，单源错误不会破坏其他模块。用户数据和代码缓存分离，更新只写 `.js`，不清理 JSON。直接组件无需联网，入口仍按原授权行为每次同步全部脚本。

## 自动透明背景测量表

`src/widget-geometry.js` 的桌面像素测量表改编自 [mzeryck/Widget-Blur/widget-blur.js](https://github.com/mzeryck/Widget-Blur/blob/main/widget-blur.js)，依据其 [MIT 许可证](https://github.com/mzeryck/Widget-Blur/blob/main/LICENSE.md) 允许复用，保留 Copyright (c) 2022 Maxwell Zeryck 与完整 MIT 声明；构建后的四个独立脚本也包含声明。只复用测量值，未复用 StackBlur 算法。上游明确部分测量在 iOS 18 确认，其他为旧系统测量；本项目不宣称新系统所有布局已真机验证。

裁剪算法按截图宽高匹配测量表，选择有名称/无名称布局或 mini/X 区分，然后按组件尺寸和位置取得矩形。大号底部使用 middle 起点；无法匹配的分辨率不猜测。通过原生 DrawContext 保存 PNG，读回校验后直接同尺寸预览，移除 WebView 手动裁剪流程。

## 新系统本机校准

[Apple iPhone 17 技术规格](https://www.apple.com.cn/iphone-17/specs/) 确认屏幕为 1206×2622，恰与旧尺寸表的部分设备共用分辨率；该规格不提供桌面组件边界，不能推导 iOS 27 下的精确裁剪坐标。用户反馈实际壁纸已显示但边缘错位，未找到足以验证这套新系统布局的官方桌面测量数据。

新增自主编写的 `src/calibration.js`：通过 `calibrate` 参数呈现紫色组件，在本地 WebView/Canvas 内解码用户本机校准截图，使用颜色连通区域、矩形大小/长宽比/覆盖率限制取得唯一对应矩形，再从同尺寸空白壁纸截图裁剪。没有向服务器发送截图，不能读取其他 App 或系统桌面内部布局。旧表继续用于明确选用的旧系统路径；新系统优先本机校准。iPhone 最终合成的边框及着色效果需真机验证。

## 用户提供的两张对照截图

用户要求代为处理，不再自行校准。本次以其提供的同壁纸组件截图与空白页截图作差定位黑色大号组件，得到 588×1280 附件上的可见区域（38,132,512,534），新增显式“使用已测量布局”入口，而非覆盖上游旧机型表。相同壁纸边缘采样对比无平移。1206×2622 原图按两个轴分别缩放边界并取整，保留附件压缩带来的误差说明。仅公开几何数值和自主实现，私人图片未提交或上传到其他服务。
