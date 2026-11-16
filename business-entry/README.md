# @xmanrui/dsh-business-entry

English | [中文](README.zh.md)

The business workbench plugin for DeepSeek Harness: a chat-free home panel (`business-workbench`) where each deployment task (daily report, topics, briefings, and more) is started from a form. Submit composes an instruction and runs it in an Agent Session without revealing Conversation; run cards stay on the workbench, and **Open session** is the escape hatch into chat.

## Cold start

On apply the plugin calls `uiWorkspace.setStartupBind('none')` so cold start does not bind a blank Conversation, then selects `business-workbench` once Workspace and Session catalogs are ready and no non-blank Session is already open. Reloading with a saved non-blank Session still restores Conversation.

## Task launch

1. Pick a task card and fill the required fields (locale-owned labels next to the prompt templates in `src/locales.js`).
2. **Start task** opens the target Workspace’s New Session (created or reused) with `panel: 'preserve'`, sends the composed instruction as the first user message, and titles the Session with the entry label so later runs can be listed.
3. The workbench stays visible. Past runs for that entry appear as cards; **Open session** calls `openSession` and reveals Conversation.
4. **Start a new run** always creates another Session under the same entry label; earlier runs stay in the list.

### Today’s Topics / Video script / One Draft, Many Formats

**Target platforms** are curated multi-select chips (WeChat Official Account, Weibo, Xiaohongshu, Douyin, WeChat Channels, Bilibili) — not free text. Today’s Topics collects only platforms; beat and positioning are not asked. The instruction requires the agent to fetch each selected platform’s past-24-hour hotspots itself before proposing topics. One Draft, Many Formats collects a source draft plus platforms and rewrites only for the selected platforms.

### Daily data report

The daily-report page keeps a browser-local **data source** catalog (`dsh.business.data-sources.v1`): add a named source (paste / file notes / connected system) once, then generate a report by picking period, platforms, and one or more existing sources. The form no longer asks for a free-text “数据来源” on every run.

### Video download

The **Video download** card is a direct Host path (`kind: 'direct'`): it does **not** start an Agent Session. The UI posts to `/api/business/video/analyze` and `/api/business/video/download` (registered by this plugin’s Host entry). Files are written under `$DSH_HOME/business-downloads`. Paste a **direct** media URL (mp4 / m3u8 / m4s / …); share-page links are not resolved in v1. Requires the sibling `dsh-video-downloader` Host bundle to be mounted (Desktop stages and optionally injects it).

A slim `sidebar.business` control only opens the workbench panel. The settings toggle still shows or hides that control; the panellist home stays available.

## Install

The plugin is deployed to `~/.dsh/profiles/web/node_modules/@xmanrui/dsh-business-entry/` and registered in the profile's `package.json` bundles list.

## Build

```bash
cd business-entry
node build.mjs
```

After changing sources under `src/`, rebuild and restart the desktop app for the change to take effect.

## Test

```bash
cd business-entry
node build.mjs && node --test tests/*.test.mjs
```

`tests/launch.test.mjs` drives the built bundle through a fake module table and slot registry: it submits a form and asserts the composed instruction, `panel: 'preserve'`, no reveal on submit, and Open session revealing chat. `tests/video-routes.test.mjs` covers the Host download path sandbox and analyze/download handlers without network I/O.

## Toggle

The settings panel carries a resident 业务入口 section in its nav (desktop only): it writes `~/.dsh/plugin-settings.json` and hot-reloads the slim sidebar control without a restart. The section is shell-owned, so it stays visible even while the control is hidden.

The state file only gates the sidebar registration — the workbench panel itself always mounts.

## File layout

```
business-entry/
├── package.json
├── cordis.patch.yml
├── build.mjs
├── src/
│   ├── client.jsx          # panel + slim sidebar + launch
│   ├── WorkbenchPage.jsx   # form home and run cards
│   ├── DailyReportPage.jsx # daily report: sources then generate
│   ├── VideoDownloadPage.jsx # direct media download (no chat)
│   ├── data-sources.js     # source catalog helpers
│   ├── video-routes.js     # Host Fetch helpers
│   ├── video-history.js    # local download history
│   ├── entries.js          # task catalog
│   ├── forms.js            # field map + composePrompt
│   ├── locales.js          # dictionaries and prompt templates
│   ├── stores.js           # viewing store
│   ├── styles.js           # CSS
│   └── index.js            # Host Fetch routes for video download
├── tests/
│   ├── launch.test.mjs
│   └── video-routes.test.mjs
└── lib/
    ├── client.js
    └── index.js
```
