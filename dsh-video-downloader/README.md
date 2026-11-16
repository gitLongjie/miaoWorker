# dsh-video-downloader

DeepSeek Harness（DSH）生态的媒体下载插件。检测并下载 Bilibili / YouTube / 抖音（Douyin）/ 小红书（Xiaohongshu）等站点的视频与音频。

Media downloader for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) ecosystem. Detects and downloads video/audio from Bilibili, YouTube, Douyin and Xiaohongshu — directly from your agent conversation.

## 为什么 / Why

DSH 插件生态里有**浏览器自动化插件**，但**没有媒体下载器工具**。本插件填补了这个缺口：把 Chrome MV3 扩展（`video-downloader-extension`）里的媒体识别逻辑从浏览器沙箱中剥离出来，变成纯 Node 函数，并以三个 agent 可调用的工具暴露给模型。

The DSH plugin ecosystem has browser-automation plugins but **no media-downloader tool**. This plugin fills that gap: it lifts the media-detection logic out of the Chrome MV3 extension's browser sandbox into pure Node functions, exposed as three agent-callable tools.

## 特性 / Features

- **`video_analyze`** — 只做分析、不下载。返回 JSON：`{ isMedia, site, quality, ext, mimeHint }`。按 hostname 识别站点（bilibili / youtube / douyin / xiaohongshu / other）。
  Pure analysis, no download — classify a URL's media-ness, site, quality, container and mime hint.
- **`video_download`** — 用浏览器风格 User-Agent + Referer 请求媒体 URL，`fs.createWriteStream` 流式写入磁盘（默认 `./downloads/<sanitized-filename>`），跟随重定向（最多 5 次），60 秒超时（并响应执行取消）。返回 `{ savedTo, bytes, quality, ext, elapsedMs }`。
  Stream a media URL to disk with redirect handling and a 60s timeout.
- **`video_quality_parse`** — 纯正则质量/扩展名分析：`{ quality, ext }`。无网络请求。
  Pure regex quality + extension extraction, zero network access.

- 零构建步骤——纯 ESM，发布包即运行时代码。
  Zero build step — pure ESM, the published package is the runtime code.
- 纯函数全部导出，可直接用于测试与二次开发。
  The pure core (`isMedia`, `getQuality`, `getExt`, `detectSite`) is exported for testing.

## 安装 / Install

```bash
# 从 npm 安装 / from npm
dsh plugin --profile myprofile add dsh-video-downloader

# 从 GitHub 安装（锁定 commit 以保证供应链安全） / from GitHub (lock the commit)
dsh plugin --profile myprofile add github:yourname/dsh-video-downloader#<sha>
```

## 用法 / Usage

用自然语言让 agent 执行：

> "分析这个页面里的媒体：https://www.bilibili.com/video/BV1xx411c7mD"
> "把这几个链接的 1080P 视频下载到 ./downloads 目录"

The agent calls the tools with:

```json
{ "url": "https://bilivideo.com/xxx.m4s" }                              // video_analyze
{ "url": "https://bilivideo.com/xxx.m4s", "outPath": "./downloads/clip.mp4" }  // video_download
{ "url": "https://example.com/video.mp4?height=720" }                   // video_quality_parse
```

`video_download` 也接受可选的 `headers` 对象合并到默认的浏览器请求头中。

`video_download` also accepts an optional `headers` object merged over the browser-like defaults.

## 工具参考 / Tool Reference

| 工具 / Tool | 参数 / Parameters | 返回 / Returns |
|---|---|---|
| `video_analyze` | `url` (string, 必填) | `{ isMedia, site, quality, ext, mimeHint }` |
| `video_download` | `url` (string, 必填), `outPath` (string, 可选), `headers` (object, 可选) | `{ savedTo, bytes, quality, ext, elapsedMs }` |
| `video_quality_parse` | `url` (string, 必填) | `{ quality, ext }` |

## 开发 / Development

```bash
npm install
npm test          # node:test，只测纯函数，不发网络请求 / pure functions only, no network
```

## 安全提示 / Safety Note

**只下载你有权获取的内容。** 本插件只负责媒体识别与文件流式保存，不绕过任何 DRM、登录墙或平台付费内容。请遵守各平台的服务条款与著作权法。

**Only download content you have rights to.** This plugin performs media detection and file streaming only — it does not bypass DRM, login walls or paid content. Respect each platform's terms of service and copyright law.

## 许可 / License

MIT
