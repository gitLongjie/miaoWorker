/**
 * Launch-behavior spec for the built browser bundle.
 *
 * Drives `lib/client.js` against a fake module table and slot registry: form
 * submit composes a prompt, opens a Workspace Session with `panel: 'preserve'`,
 * and never reveals Conversation until Open session is clicked.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { normalizeSource, valuesFromSources } from '../src/data-sources.js'
import { BUSINESS_ENTRIES } from '../src/entries.js'
import { composePrompt, ENTRY_FIELDS, FIELD_DEFS, formComplete, PLATFORM_OPTIONS, TIME_RANGE_OPTIONS } from '../src/forms.js'
import { zh } from '../src/locales.js'

const here = dirname(fileURLToPath(import.meta.url))

const react = {
  createElement: (type, props, ...children) => ({
    type,
    props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
  }),
  Fragment: Symbol('Fragment'),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
}

function fakeDefineStore(spec) {
  return {
    spec,
    create() {
      const state = spec.init()
      const actions = {}
      for (const [name, action] of Object.entries(spec.actions)) {
        actions[name] = (...args) => { action(state, ...args) }
      }
      return { actions, getSnapshot: () => state, subscribe: () => () => {}, clearPersisted: () => {} }
    },
  }
}

function fakeSnapshotStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    getSnapshot: () => state,
    set: (next) => { state = next; for (const listener of [...listeners]) listener() },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}

/** Persist option is ignored in the fake — production writes localStorage. */
function createSnapshotStore(initial) {
  return fakeSnapshotStore(initial)
}

function moduleTable(specifier) {
  return specifier === '@deepseek-ai/dsh-client-store'
    ? { defineStore: fakeDefineStore, createSnapshotStore }
    : react
}

function loadBundle() {
  const source = readFileSync(resolve(here, '..', 'lib', 'client.js'), 'utf8')
  const listeners = new Map()
  const window = {
    addEventListener: (type, listener) => { listeners.set(type, listener) },
    removeEventListener: (type) => { listeners.delete(type) },
  }
  let moduleExports
  window.__ModuleLoader__ = {
    load: ({ factory }) => { moduleExports = factory(moduleTable) },
  }
  const run = new Function('window', 'document', source)
  run(window, undefined)
  assert.ok(moduleExports?.apply, 'the bundle must export apply')
  return { exports: moduleExports, listeners }
}

function withPlugin(options = {}) {
  const calls = []
  const session = {
    prompt: async (content, mode) => {
      calls.push(['prompt', content, mode])
      return options.promptResult ?? { ok: true, value: { accepted: true } }
    },
    rename: async (title) => {
      calls.push(['rename', title])
      return { ok: true, value: { title, seq: 1 } }
    },
  }
  const workspaceSnapshot = {
    phase: 'ready',
    items: options.workspaces ?? [{ workspaceId: 'ws-1', sessionIds: ['sess-old'], createdAt: '2026-01-01T00:00:00Z' }],
    archivedSessionIds: options.archived ?? [],
  }
  const workspaceListeners = new Set()
  const workspaces = {
    list: {
      getSnapshot: () => workspaceSnapshot,
      subscribe: (listener) => { workspaceListeners.add(listener); return () => { workspaceListeners.delete(listener) } },
    },
  }
  const defaultSessions = options.sessions ?? {
    'sess-old': { updatedAt: 1, blank: true, retainedBy: {} },
  }
  const sessionList = {
    phase: options.sessionsPhase ?? 'ready',
    ids: Object.keys(defaultSessions),
    byId: { ...defaultSessions },
  }
  const sessionListeners = new Set()
  const panelListeners = new Set()
  let created = 0
  const sessions = {
    list: {
      getSnapshot: () => sessionList,
      subscribe: (listener) => { sessionListeners.add(listener); return () => { sessionListeners.delete(listener) } },
    },
    binding: () => ({ session }),
    scope: () => undefined,
    sessionOf: () => undefined,
    create: async () => {
      created += 1
      const sessionId = `sess-${String(created)}`
      calls.push(['create', sessionId])
      return sessionId
    },
  }
  let panelId = null
  const selectPanel = (id) => {
    panelId = id
    calls.push(['selectPanel', id])
    for (const listener of [...panelListeners]) listener(id)
  }
  const uiWorkspace = {
    setStartupBind: (mode) => { calls.push(['setStartupBind', mode]) },
    openWorkspace: async (workspaceId, beforeOpen, opts) => {
      calls.push(['openWorkspace', workspaceId, opts?.panel])
      const sessionId = `sess-${String(created + 1)}`
      sessionList.ids = [...sessionList.ids, sessionId]
      sessionList.byId = {
        ...sessionList.byId,
        [sessionId]: {
          id: sessionId,
          updatedAt: Date.now(),
          blank: false,
          running: true,
          retainedBy: { mainView: 1 },
          title: 'pending',
        },
      }
      if (beforeOpen !== undefined) beforeOpen(sessionId)
      // preserve keeps the workbench; reveal would clear the panel.
      if (opts?.panel !== 'preserve') selectPanel(null)
    },
    openSession: (id) => {
      calls.push(['openSession', id])
      const row = sessionList.byId[id]
      if (row !== undefined) {
        sessionList.byId = {
          ...sessionList.byId,
          [id]: { ...row, retainedBy: { ...(row.retainedBy ?? {}), mainView: 1 } },
        }
      }
      // Match production: reveal Conversation after Open session.
      selectPanel(null)
      for (const listener of [...sessionListeners]) listener()
    },
    startSession: () => { calls.push(['startSession']) },
  }
  const layout = {
    panelInfo: {
      getSnapshot: () => ({ activePanelId: panelId }),
      subscribe: () => () => {},
    },
    selectPanel,
    onPanelSelection: (listener) => {
      panelListeners.add(listener)
      return () => { panelListeners.delete(listener) }
    },
  }
  const registrations = {}
  const ctx = {
    effect: (factory) => factory(),
    locale: {
      register: () => () => {},
      bind: () => (key) => zh[key],
      getSnapshot: () => ({ active: 'zh' }),
    },
    slots: {
      inject: (_name, callback) => callback(),
      register: (spec, component) => {
        const key = spec.name === 'main' ? 'main' : spec.name === 'sidebar.panellist' ? 'panellist' : 'sidebar'
        registrations[key] = { spec, component }
        return () => {}
      },
    },
    workspaces,
    sessions,
    uiWorkspace,
    layout,
  }
  const { exports } = loadBundle()
  exports.apply(ctx)
  assert.ok(registrations.main, 'apply must register the business-workbench main panel')
  assert.ok(registrations.panellist, 'apply must register the sidebar panellist row')
  assert.ok(registrations.sidebar, 'apply must register the slim sidebar.business control')
  const instance = registrations.main.spec.store.create()
  const injected = registrations.main.spec.inject(instance.actions)
  const seedSession = (sessionId, title, updatedAt = 2, running = false) => {
    sessionList.ids = [...sessionList.ids, sessionId]
    sessionList.byId = {
      ...sessionList.byId,
      [sessionId]: {
        id: sessionId, updatedAt, title, running, blank: false, retainedBy: {},
      },
    }
  }
  const publish = () => {
    for (const listener of [...sessionListeners]) listener()
    for (const listener of [...workspaceListeners]) listener()
  }
  return { calls, instance, seedSession, publish, sessionList, injected, registrations }
}

const settle = () => new Promise((resolve) => { setTimeout(resolve, 0) })

const dailyValues = {
  period: '2026-11-15',
  platforms: '微信',
  dataSource: '粘贴',
  pastedData: 'PV 100',
}

test('apply sets startupBind none and selects the workbench home', () => {
  const plugin = withPlugin()
  assert.ok(plugin.calls.some(call => call[0] === 'setStartupBind' && call[1] === 'none'))
  assert.ok(plugin.calls.some(call => call[0] === 'selectPanel' && call[1] === 'business-workbench'))
})

test('form submit opens a Workspace Session without revealing Conversation', async () => {
  const plugin = withPlugin()
  plugin.calls.length = 0
  plugin.injected.launchForm('dailyReport', dailyValues, {})
  assert.equal(plugin.instance.getSnapshot().pending, 'dailyReport')
  await settle()
  assert.deepEqual(plugin.calls.map(call => call[0]), ['openWorkspace', 'prompt', 'rename'])
  assert.equal(plugin.calls[0][1], 'ws-1')
  assert.equal(plugin.calls[0][2], 'preserve')
  const expected = composePrompt(zh['prompt.dailyReport'], dailyValues, zh['field.empty'])
  assert.deepEqual(plugin.calls[1][1], [{ type: 'text', text: expected }])
  assert.equal(plugin.calls[2][1], zh['item.dailyReport'])
  assert.equal(plugin.instance.getSnapshot().pending, undefined)
  assert.ok(!plugin.calls.some(call => call[0] === 'openSession'))
})

test('a refused prompt reports its own reason without openSession', async () => {
  const plugin = withPlugin({ promptResult: { ok: false, error: { code: 'session/busy', message: 'session is running' } } })
  plugin.calls.length = 0
  plugin.injected.launchForm('topics', { platform: [zh['option.platform.wechat']] }, {})
  await settle()
  assert.equal(plugin.instance.getSnapshot().error, 'session/busy: session is running')
  assert.deepEqual(plugin.calls.map(call => call[0]), ['openWorkspace', 'prompt'])
})

test('Open session reveals Conversation for a past run', async () => {
  const plugin = withPlugin()
  plugin.seedSession('sess-1', zh['item.dailyReport'], 5)
  plugin.publish()
  plugin.calls.length = 0
  plugin.injected.openSession('sess-1')
  assert.deepEqual(plugin.calls, [['openSession', 'sess-1'], ['selectPanel', null]])
})

test('Open session after a topics run does not bounce back to the workbench', () => {
  // Keep catalogs not-ready so cold-start home has not finished (done === false),
  // matching the production race where Open session used to re-select the workbench.
  const plugin = withPlugin({ sessionsPhase: 'loading' })
  assert.ok(!plugin.calls.some(call => call[0] === 'selectPanel' && call[1] === 'business-workbench'))
  plugin.seedSession('sess-topics', zh['item.topics'], 99, true)
  plugin.sessionList.byId['sess-topics'] = {
    ...plugin.sessionList.byId['sess-topics'],
    retainedBy: { mainView: 1 },
  }
  plugin.calls.length = 0
  plugin.injected.openSession('sess-topics')
  assert.ok(plugin.calls.some(call => call[0] === 'openSession' && call[1] === 'sess-topics'))
  assert.ok(plugin.calls.some(call => call[0] === 'selectPanel' && call[1] === null))
  assert.ok(!plugin.calls.some(call => call[0] === 'selectPanel' && call[1] === 'business-workbench'))
  // Catalogs become ready / list churn must still not steal Conversation.
  plugin.sessionList.phase = 'ready'
  plugin.publish()
  assert.ok(!plugin.calls.some(call => call[0] === 'selectPanel' && call[1] === 'business-workbench'))
})

test('past runs publish newest first, with the running one flagged', async () => {
  const plugin = withPlugin()
  plugin.seedSession('sess-older', zh['item.dailyReport'], 10)
  plugin.seedSession('sess-newer', zh['item.dailyReport'], 99, true)
  plugin.seedSession('unrelated', '随便一个会话', 50)
  plugin.publish()
  const history = plugin.injected.hooks.history.getSnapshot()
  assert.deepEqual(history.entries.dailyReport.map(row => row.sessionId), ['sess-newer', 'sess-older'])
  assert.equal(history.entries.dailyReport[0].running, true)
  assert.deepEqual(history.entries.topics, [])
})

test('a deployment with no Workspace still runs the task without revealing chat', async () => {
  const plugin = withPlugin({ workspaces: [] })
  plugin.calls.length = 0
  plugin.injected.launchForm('rumor', { claim: '某传言' }, {})
  await settle()
  assert.deepEqual(plugin.calls.map(call => call[0]), ['create', 'prompt', 'rename'])
  const expected = composePrompt(zh['prompt.rumor'], { claim: '某传言' }, zh['field.empty'])
  assert.deepEqual(plugin.calls[1][1], [{ type: 'text', text: expected }])
  assert.ok(!plugin.calls.some(call => call[0] === 'openSession'))
})

test('the failure notice clears on the next launch', async () => {
  const plugin = withPlugin({ promptResult: { ok: false, error: { code: 'session/busy', message: 'busy' } } })
  plugin.injected.launchForm('report', {
    kind: '周报', audience: '老板', material: '数据', length: '一页',
  }, {})
  await settle()
  assert.equal(plugin.instance.getSnapshot().error, 'session/busy: busy')
  plugin.instance.actions.beginLaunch('report')
  assert.equal(plugin.instance.getSnapshot().error, undefined)
  plugin.instance.actions.failLaunch('kept')
  plugin.instance.actions.clearError()
  assert.equal(plugin.instance.getSnapshot().error, undefined)
})

test('every catalog entry carries a label and instruction in both dictionaries', async () => {
  const { en } = await import('../src/locales.js')
  for (const entry of BUSINESS_ENTRIES) {
    const keys = [entry.label, entry.blurb]
    if (entry.kind !== 'direct') keys.push(entry.prompt)
    for (const key of keys) {
      assert.equal(typeof zh[key], 'string', `zh is missing ${key}`)
      assert.equal(typeof en[key], 'string', `en is missing ${key}`)
    }
  }
})

test('composePrompt fills required fields and empty optional placeholders', () => {
  const filled = composePrompt(zh['prompt.dailyReport'], {
    period: '今天', platforms: '抖音', dataSource: '上传', pastedData: '',
  }, zh['field.empty'])
  assert.match(filled, /今天/)
  assert.match(filled, /抖音/)
  assert.match(filled, /上传/)
  assert.match(filled, /（未提供）/)
})

test('target platform is a curated multi-select, not free text', async () => {
  const { en } = await import('../src/locales.js')
  assert.deepEqual(FIELD_DEFS.platform.options, PLATFORM_OPTIONS)
  assert.equal(FIELD_DEFS.platform.multiple, true)
  assert.ok(PLATFORM_OPTIONS.length > 0)
  assert.equal(typeof zh['field.platform.placeholder'], 'string')
  assert.equal(typeof en['field.platform.placeholder'], 'string')
  for (const id of PLATFORM_OPTIONS) {
    const key = `option.platform.${id}`
    assert.equal(typeof zh[key], 'string', `zh is missing ${key}`)
    assert.equal(typeof en[key], 'string', `en is missing ${key}`)
  }
})

test('sentiment time range is a curated single-select', async () => {
  const { en } = await import('../src/locales.js')
  assert.deepEqual(ENTRY_FIELDS.sentiment, ['subject', 'timeRange'])
  assert.deepEqual(FIELD_DEFS.timeRange.options, TIME_RANGE_OPTIONS)
  assert.notEqual(FIELD_DEFS.timeRange.multiple, true)
  assert.equal(typeof zh['field.subject.placeholder'], 'string')
  assert.equal(typeof en['field.subject.placeholder'], 'string')
  assert.equal(typeof zh['sentiment.subtitle'], 'string')
  assert.equal(typeof en['sentiment.subtitle'], 'string')
  for (const id of TIME_RANGE_OPTIONS) {
    const key = `option.timeRange.${id}`
    assert.equal(typeof zh[key], 'string', `zh is missing ${key}`)
    assert.equal(typeof en[key], 'string', `en is missing ${key}`)
  }
})

test('topics collects only platform and instructs the agent to fetch hotspots', () => {
  assert.deepEqual(ENTRY_FIELDS.topics, ['platform'])
  assert.doesNotMatch(zh['prompt.topics'], /\{domain\}|\{positioning\}/)
  assert.match(zh['prompt.topics'], /自行联网检索/)
  const filled = composePrompt(zh['prompt.topics'], {
    platform: [zh['option.platform.douyin'], zh['option.platform.weibo']],
  }, zh['field.empty'])
  assert.match(filled, /抖音/)
  assert.match(filled, /微博/)
  assert.match(filled, /抖音、微博/)
  assert.doesNotMatch(filled, /\{platform\}/)
})

test('multiFormat picks curated platforms, not free-typed targets', () => {
  assert.deepEqual(ENTRY_FIELDS.multiFormat, ['sourceText', 'platform'])
  assert.equal(FIELD_DEFS.targetPlatforms, undefined)
  assert.match(zh['prompt.multiFormat'], /\{platform\}/)
  assert.doesNotMatch(zh['prompt.multiFormat'], /\{targetPlatforms\}/)
  assert.match(zh['prompt.multiFormat'], /不要产出未勾选平台/)
  const filled = composePrompt(zh['prompt.multiFormat'], {
    sourceText: '原稿内容',
    platform: [zh['option.platform.wechat'], zh['option.platform.xiaohongshu']],
  }, zh['field.empty'])
  assert.match(filled, /原稿内容/)
  assert.match(filled, /微信公众号、小红书/)
  assert.doesNotMatch(filled, /\{platform\}|\{sourceText\}/)
  assert.equal(formComplete('multiFormat', { sourceText: '原稿', platform: [] }), false)
  assert.equal(formComplete('multiFormat', {
    sourceText: '原稿',
    platform: [zh['option.platform.weibo']],
  }), true)
})

test('normalizeSource rejects an empty name and keeps paste content', () => {
  assert.equal(normalizeSource({ name: '  ', method: 'paste' }), undefined)
  const saved = normalizeSource({
    name: ' 微信后台 ',
    method: 'paste',
    note: '日活表',
    content: 'PV 100',
  })
  assert.equal(saved.name, '微信后台')
  assert.equal(saved.method, 'paste')
  assert.equal(saved.content, 'PV 100')
})

test('valuesFromSources builds prompt fields from selected catalog rows', () => {
  const catalog = [
    normalizeSource({ name: '抖音', method: 'system', note: '开放平台', content: '' }),
    normalizeSource({ name: '粘贴表', method: 'paste', note: '', content: 'UV 20' }),
  ]
  const values = valuesFromSources(
    catalog,
    [catalog[0].id, catalog[1].id],
    zh['field.empty'],
    (method) => zh[`daily.method.${method}`],
  )
  assert.match(values.dataSource, /抖音/)
  assert.match(values.dataSource, /已接入系统查询/)
  assert.match(values.dataSource, /粘贴表/)
  assert.equal(values.pastedData, 'UV 20')
})

test('daily report launch uses selected source values without free-text dataSource field', async () => {
  const plugin = withPlugin()
  plugin.calls.length = 0
  const source = normalizeSource({
    name: '运营后台',
    method: 'paste',
    note: '导出 CSV',
    content: 'DAU 900',
  })
  plugin.injected.dataSourceActions.add(source)
  const fromSources = valuesFromSources(
    [source],
    [source.id],
    zh['field.empty'],
    (method) => zh[`daily.method.${method}`],
  )
  plugin.injected.launchForm('dailyReport', {
    period: '2026-11-15',
    platforms: '全站',
    ...fromSources,
  }, {})
  await settle()
  assert.equal(plugin.calls[0][2], 'preserve')
  const promptText = plugin.calls[1][1][0].text
  assert.match(promptText, /运营后台/)
  assert.match(promptText, /DAU 900/)
  assert.match(promptText, /2026-11-15/)
})

test('slim sidebar opens the workbench panel', () => {
  const plugin = withPlugin()
  plugin.calls.length = 0
  const nav = plugin.registrations.sidebar
  const injected = nav.spec.inject()
  injected.openWorkbench()
  assert.deepEqual(plugin.calls, [['selectPanel', 'business-workbench']])
})

test('videoDownload launchForm is a no-op (direct Host path)', async () => {
  const plugin = withPlugin()
  plugin.calls.length = 0
  plugin.injected.launchForm('videoDownload', { url: 'https://cdn.example.com/a.mp4' }, {})
  await settle()
  assert.deepEqual(plugin.calls, [])
  assert.equal(plugin.instance.getSnapshot().pending, undefined)
})
