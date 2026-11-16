# @xmanrui/dsh-business-entry

[English](README.md) | 中文

DeepSeek Harness 的业务工作台插件：以无聊天主面板（`business-workbench`）为首页，部署自有任务（日报、选题、速览等）通过表单启动。提交后合成指令并在 Agent 会话中运行，但**不**切入 Conversation；运行卡片留在工作台，**查看会话**才进入聊天。

## 冷启动

插件在 apply 时调用 `uiWorkspace.setStartupBind('none')`，避免冷启动绑定空白会话，并在 Workspace / Session 目录就绪且当前没有非空白会话时选中 `business-workbench`。若已保存非空白会话，仍恢复 Conversation。

## 任务启动

1. 点选任务卡片并填写必填项（文案与 `prompt.*` 模板同在 `src/locales.js`）。
2. **开始任务** 打开目标工作区的 New Session（新建或复用），以 `panel: 'preserve'` 绑定会话，把合成后的指令作为首条用户消息，并用条目标签命名会话以便列出历次运行。
3. 工作台保持可见。该入口的历次运行以卡片展示；**查看会话** 调用 `openSession` 并切入 Conversation。
4. **新开一次** 总会再开一个同标签会话；此前运行仍留在列表中。

### 今日选题 / 视频脚本 / 一稿多形态

「目标平台」由插件提供固定选项（微信公众号、微博、小红书、抖音、视频号、B站），表单为多选芯片，不接受自由填写。今日选题只选平台；关注领域与账号定位不再收集，指令要求 Agent 自行联网抓取所选平台过去 24 小时热点后再出选题。一稿多形态收集原始稿件与目标平台，仅为已勾选平台各产出一份适配形态。

### 今日数据日报

日报页维护浏览器本地的**数据源**目录（`dsh.business.data-sources.v1`）：先添加命名数据源（粘贴 / 文件说明 / 已接入系统），生成日报时再选日期区间、平台，并勾选已有数据源。不再每次手填「数据来源」。

### 视频下载

「视频下载」卡片走 **Host 直连**（`kind: 'direct'`），**不**启动 Agent 会话。界面请求 `/api/business/video/analyze` 与 `/api/business/video/download`（由本插件 Host 入口注册）。文件写入 `$DSH_HOME/business-downloads`。请粘贴 **直链** 媒体地址（mp4 / m3u8 / m4s 等）；v1 不解析分享页。需要同级的 `dsh-video-downloader` Host bundle 已挂载（Desktop 会 stage 并可自动注入）。

侧栏 `sidebar.business` 仅保留「打开工作台」控件。设置里的开关仍控制该控件显隐；panellist 首页始终可用。

## 安装

插件已部署到 `~/.dsh/profiles/web/node_modules/@xmanrui/dsh-business-entry/`，并在 profile 的 `package.json` bundles 列表中注册。

## 构建

```bash
cd business-entry
node build.mjs
```

修改 `src/` 下的源文件后重新构建，重启 desktop 即可生效。

## 测试

```bash
cd business-entry
node build.mjs && node --test tests/*.test.mjs
```

`tests/launch.test.mjs` 通过假模块表与 slot 注册驱动构建产物：提交表单并断言合成指令、`panel: 'preserve'`、提交不揭示聊天，以及查看会话才揭示。`tests/video-routes.test.mjs` 覆盖 Host 下载路径沙箱与 analyze/download 处理（无真实网络）。

## 开关

设置页导航中有常驻的「业务入口」分区（仅 desktop）：写入 `~/.dsh/plugin-settings.json` 并热重载侧栏控件，无需重启。该分区由壳层持有，控件隐藏时仍可见。

状态文件只门控侧栏注册——工作台主面板始终挂载。

## 文件布局

```
business-entry/
├── package.json
├── cordis.patch.yml
├── build.mjs
├── src/
│   ├── client.jsx          # 面板 + 精简侧栏 + 启动
│   ├── WorkbenchPage.jsx   # 表单首页与运行卡片
│   ├── DailyReportPage.jsx # 日报：先数据源再生成
│   ├── VideoDownloadPage.jsx # 直连媒体下载（无聊天）
│   ├── data-sources.js     # 数据源目录辅助
│   ├── video-routes.js     # Host Fetch 辅助
│   ├── video-history.js    # 本机下载记录
│   ├── entries.js          # 任务目录
│   ├── forms.js            # 字段表 + composePrompt
│   ├── locales.js          # 文案与 prompt 模板
│   ├── stores.js           # 视图状态
│   ├── styles.js           # CSS
│   └── index.js            # 视频下载 Host Fetch 路由
├── tests/
│   ├── launch.test.mjs
│   └── video-routes.test.mjs
└── lib/
    ├── client.js
    └── index.js
```
