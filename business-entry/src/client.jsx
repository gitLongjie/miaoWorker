/**
 * Business-entry plugin, browser half: the `business-workbench` main panel is
 * the product home (forms → Agent Sessions), with a slim `sidebar.business`
 * control that only opens that panel. Task history and launch status live in
 * the declared store. Form submit composes a prompt and starts a Session
 * without revealing Conversation; "查看会话" / Open session is the escape hatch.
 *
 * Hot-toggle: the Settings page carries a resident enable/disable switch for
 * the sidebar control (shell-owned). The workbench panellist home stays mounted.
 */
import React from 'react'
import { BUSINESS_ENTRIES } from './entries.js'
import { composePrompt } from './forms.js'
import { en, zh } from './locales.js'
import { createBusinessEntryStore } from './stores.js'
import { css, stylesheet } from './styles.js'
import { WorkbenchPage } from './WorkbenchPage.jsx'

/** Sidebar panellist id and keyed main-panel key. */
export const PANEL_ID = 'business-workbench'
const PANEL_ORDER = 10

/* ------------------------------------------------------------------ */
/*  Icons (inlined SVG to avoid depending on ui-primitives)           */
/* ------------------------------------------------------------------ */

function IconListPen({ size = 16, className }) {
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg', className,
  }, React.createElement('path', {
    d: 'M2.5 4h7M2.5 8h5M2.5 12h3M10 9.5l3-3 1.5 1.5-3 3H10V9.5z',
    stroke: 'currentColor', strokeWidth: '1.2', strokeLinecap: 'round', strokeLinejoin: 'round',
  }))
}

/* ------------------------------------------------------------------ */
/*  Slim sidebar control → open workbench                             */
/* ------------------------------------------------------------------ */

function BusinessNav({ wide, expandSidebar, openWorkbench, t }) {
  if (!wide) {
    return React.createElement('div', { className: css.rail },
      React.createElement('button', {
        type: 'button',
        className: css.railButton,
        'aria-label': t('nav.open'),
        onClick: () => { expandSidebar(); openWorkbench() },
      }, React.createElement(IconListPen, { size: 18 })),
    )
  }

  return React.createElement('div', { className: css.root },
    React.createElement('button', {
      type: 'button',
      className: css.header,
      onClick: () => { openWorkbench() },
      title: t('item.hint'),
    },
      React.createElement(IconListPen, { size: 14, className: css.headerIcon }),
      React.createElement('span', { className: css.headerLabel }, t('nav.label')),
    ),
  )
}

/* ------------------------------------------------------------------ */
/*  Hot-toggle event name                                             */
/* ------------------------------------------------------------------ */

/** CustomEvent detail: `{ enabled: boolean }`. */
const TOGGLE_EVENT = 'dsh-business-entry:toggle'

const PLUGIN_ID = 'xmanrui-dsh-business-entry'

/* ------------------------------------------------------------------ */
/*  Task launch                                                       */
/* ------------------------------------------------------------------ */

/**
 * Resolve the workspace a business task opens in: the workspace of the open
 * session, else the most recently active one — the same target policy the
 * sidebar's New Session control applies.
 * @param ctx - the plugin context (workspaces and sessions services).
 * @returns the target WorkspaceId, or undefined while the lists are not ready
 * or no workspace is registered.
 */
function targetWorkspaceId(ctx) {
  const workspaces = ctx.workspaces.list.getSnapshot()
  const sessions = ctx.sessions.list.getSnapshot()
  if (workspaces.phase !== 'ready' || sessions.phase !== 'ready') return undefined
  if (sessions.current !== undefined) {
    const owner = workspaces.items.find(item => item.sessionIds.includes(sessions.current))
    if (owner !== undefined) return owner.workspaceId
  }
  let best
  let bestTime = Number.NEGATIVE_INFINITY
  for (const item of workspaces.items) {
    let latest = Number.NEGATIVE_INFINITY
    for (const sessionId of item.sessionIds) {
      const session = sessions.byId[sessionId]
      if (session !== undefined) latest = Math.max(latest, session.updatedAt)
    }
    if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(item.createdAt)
    if (best === undefined || latest > bestTime) { best = item; bestTime = latest }
  }
  return best === undefined ? undefined : best.workspaceId
}

/**
 * Resolve the business Session behind one id — the binding first, then the
 * scoped context, because a Session the controller has only just created is
 * addressable through whichever of the two it has materialized so far.
 * @param ctx - the plugin context.
 * @param sessionId - the target Session.
 * @returns the Session face, or undefined while neither path resolves it.
 */
function sessionFaceOf(ctx, sessionId) {
  const bound = ctx.sessions.binding(sessionId)
  if (bound !== undefined) return bound.session
  const actx = ctx.sessions.scope(sessionId)
  return actx === undefined ? undefined : ctx.sessions.sessionOf(actx)
}

/**
 * Every label an entry can be titled with, in either dictionary. A task
 * Session keeps whatever label was current when it started, so matching the
 * other dictionary too keeps a task reachable after the UI language changes.
 */
const ENTRY_TITLES = new Map(BUSINESS_ENTRIES.flatMap(entry => [
  [zh[entry.label], entry.id],
  [en[entry.label], entry.id],
]))

/**
 * List the task Sessions one entry owns, newest first: the non-archived
 * Sessions titled with the entry's label.
 *
 * The title IS the entry's durable mark — {@link deliverPrompt} writes it when
 * it starts the task — so the association survives a reload, a restart, and a
 * window that never saw the launch. It is also what makes every earlier run
 * listable, and why a plain click resumes rather than starting a parallel task.
 * @param ctx - the plugin context (workspace archive set and session list).
 * @param entryId - the catalog entry whose Sessions to collect.
 * @returns the entry's Sessions, newest first.
 */
function taskSessionsOf(ctx, entryId) {
  const sessions = ctx.sessions.list.getSnapshot()
  const archived = ctx.workspaces.list.getSnapshot().archivedSessionIds
  const found = []
  for (const sessionId of sessions.ids) {
    if (archived.includes(sessionId)) continue
    const summary = sessions.byId[sessionId]
    if (summary === undefined) continue
    const title = summary.title?.trim()
    if (title === undefined || ENTRY_TITLES.get(title) !== entryId) continue
    found.push({ sessionId, updatedAt: summary.updatedAt, running: summary.running === true })
  }
  found.sort((left, right) => right.updatedAt - left.updatedAt)
  return found
}

/**
 * Derive the published task history: which Session is open, and each entry's
 * own runs newest first.
 * @param ctx - the plugin context.
 * @returns the history snapshot.
 */
function deriveTaskHistory(ctx) {
  const entries = {}
  for (const entry of BUSINESS_ENTRIES) entries[entry.id] = taskSessionsOf(ctx, entry.id)
  return { current: ctx.sessions.list.getSnapshot().current, entries }
}

/**
 * Send one entry's instruction as the first prompt of a Session, then name
 * that Session after the entry so the list says which task produced it — and
 * so {@link taskSessionsOf} finds it again.
 *
 * The title rename is best-effort: an explicit title pins the Session against
 * automatic regeneration, but a refused rename must not turn a delivered
 * prompt into a reported failure.
 * @param ctx - the plugin context.
 * @param sessionId - the Session receiving the prompt.
 * @param promptText - the localized instruction, sent verbatim as one text block.
 * @param title - the entry label to title the Session with.
 */
async function deliverPrompt(ctx, sessionId, promptText, title) {
  const session = sessionFaceOf(ctx, sessionId)
  if (session === undefined) throw new Error(`session ${sessionId} is not addressable`)
  const result = await session.prompt([{ type: 'text', text: promptText }], 'queue')
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  await session.rename(title).then(() => undefined, () => undefined)
}

/**
 * Run one business task: open the target Workspace's New Session (created or
 * reused) and deliver the entry's instruction into it. The beforeOpen hook
 * runs once the Session is synchronously addressable, which is when its
 * prompt can be accepted; the delivery promise is awaited afterwards so a
 * failed prompt reaches the row instead of scrolling by unnoticed.
 * @param ctx - the plugin context (workspace navigation and session services).
 * @param promptText - the localized instruction to send.
 * @param title - the entry label to title the Session with.
 * @returns the Session the task runs in.
 */
async function startEntryTask(ctx, promptText, title) {
  const workspaceId = targetWorkspaceId(ctx)
  if (workspaceId !== undefined) {
    let started
    let sessionId
    // Preserve the workbench panel: bind the Session without revealing chat.
    await ctx.uiWorkspace.openWorkspace(workspaceId, (adopted) => {
      sessionId = adopted
      started = deliverPrompt(ctx, adopted, promptText, title)
    }, { panel: 'preserve' })
    // Absent only when a later navigation superseded this one before it opened.
    if (started !== undefined) await started
    return sessionId
  }
  // No Workspace to attach to: create the Session, retain briefly for prompt,
  // and leave Conversation unrevealed.
  const sessionId = await ctx.sessions.create({})
  if (typeof ctx.sessions.using === 'function') {
    await ctx.sessions.using(sessionId, { source: 'workspaceOperation' }, async () => {
      await deliverPrompt(ctx, sessionId, promptText, title)
    })
  } else {
    await deliverPrompt(ctx, sessionId, promptText, title)
  }
  return sessionId
}

/**
 * Turn a rejected launch into the one line the group shows. Wire and business
 * failures already carry their own words; anything else is stringified rather
 * than swallowed.
 * @param reason - the rejection value.
 * @returns the message text.
 */
function describeReason(reason) {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Start one entry from the workbench form: compose the instruction from field
 * values and open a Session without revealing Conversation. `fresh` always
 * starts a new run; otherwise the first submit for an entry that already owns
 * a Session still starts a new run from the form (resume is "Open session").
 * @param ctx - the plugin context.
 * @param id - the entry id.
 * @param actions - the declared store's baked write set.
 * @param values - form field map.
 * @param options - `fresh` is accepted for symmetry with older callers.
 */
async function launchFormEntry(ctx, id, actions, values, options) {
  const entry = BUSINESS_ENTRIES.find(candidate => candidate.id === id)
  if (entry === undefined || entry.kind === 'direct') return
  const t = ctx.locale.bind('business')
  actions.beginLaunch(id)
  try {
    const promptText = composePrompt(t(entry.prompt), values ?? {}, t('field.empty'))
    // Form submit always creates a run; opening an existing run is a separate control.
    void options
    await startEntryTask(ctx, promptText, t(entry.label))
    actions.endLaunch()
  } catch (reason) {
    actions.failLaunch(describeReason(reason))
  }
}

/* ------------------------------------------------------------------ */
/*  Plugin contract                                                   */
/* ------------------------------------------------------------------ */

const NS = 'business'

export const inject = ['slots', 'locale', 'workspaces', 'sessions', 'uiWorkspace', 'layout']

export function apply(ctx) {
  // Inject stylesheets once.
  if (typeof document !== 'undefined') {
    if (!document.querySelector('style[data-plugin="dsh-business-entry"]')) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-business-entry'
      tag.textContent = stylesheet
      document.head.appendChild(tag)
    }
  }

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-business-entry: dictionaries')

  // Cold start: do not bind a blank Conversation; this panel owns the home.
  ctx.uiWorkspace.setStartupBind('none')

  // Resolve defineStore from the client-store module through the module table.
  const clientStore = require('@deepseek-ai/dsh-client-store')
  const defineStore = clientStore.defineStore

  // One viewing-store instance shared by the workbench page and slim sidebar.
  const viewHandle = createBusinessEntryStore(defineStore)
  const viewInstance = viewHandle.create()
  const viewStore = { ...viewHandle, create: () => viewInstance }

  // --- Published task history ---
  const taskHistory = clientStore.createSnapshotStore(deriveTaskHistory(ctx))
  ctx.effect(() => {
    const publish = () => { taskHistory.set(deriveTaskHistory(ctx)) }
    const offSessions = ctx.sessions.list.subscribe(publish)
    const offWorkspaces = ctx.workspaces.list.subscribe(publish)
    publish()
    return () => {
      offSessions()
      offWorkspaces()
    }
  }, 'dsh-business-entry: task history')

  // Daily-report data sources (browser-local, reused across report runs).
  const dataSources = clientStore.createSnapshotStore(
    { sources: [] },
    { persist: { name: 'dsh.business.data-sources.v1' } },
  )
  const dataSourceActions = {
    add: (source) => {
      const snap = dataSources.getSnapshot()
      dataSources.set({ sources: [...snap.sources, source] })
    },
    update: (source) => {
      const snap = dataSources.getSnapshot()
      dataSources.set({
        sources: snap.sources.map(row => (row.id === source.id ? source : row)),
      })
    },
    remove: (id) => {
      const snap = dataSources.getSnapshot()
      dataSources.set({ sources: snap.sources.filter(row => row.id !== id) })
    },
  }

  const openWorkbench = () => {
    try { ctx.layout.selectPanel(PANEL_ID) }
    catch (_error) { /* panel not registered yet */ }
  }

  const navLabel = () => {
    const dictionary = ctx.locale.getSnapshot().active === 'en' ? en : zh
    return dictionary['nav.label']
  }

  // Main panel + panellist (product home).
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    {
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: PANEL_ORDER,
      label: navLabel,
      locale: NS,
    },
    ({ size }) => React.createElement(IconListPen, { size }),
  ))

  ctx.slots.inject('main', () => ctx.slots.register(
    {
      name: 'main',
      key: PANEL_ID,
      locale: NS,
      store: viewStore,
      inject: (actions) => ({
        setActiveEntryId: (id) => { actions.select(id) },
        clearError: () => { actions.clearError() },
        launchForm: (id, values, options) => {
          void launchFormEntry(ctx, id, actions, values, options)
        },
        openSession: (sessionId) => { ctx.uiWorkspace.openSession(sessionId) },
        dataSourceActions,
        hooks: { history: taskHistory, dataSources },
      }),
    },
    WorkbenchPage,
  ))

  // Cold-start home only: select the workbench once catalogs are ready while
  // Conversation is empty (no mainView Session). Never re-home after Open
  // session reveals Conversation — that path calls selectPanel(null) and used
  // to bounce back when maybeHome still thought "no current Session".
  ctx.effect(() => {
    let done = false
    let offSessions = () => {}
    let offWorkspaces = () => {}
    let offPanel = () => {}
    const finish = () => {
      if (done) return
      done = true
      offSessions()
      offWorkspaces()
      offPanel()
    }
    /** @param sessions - live Session list snapshot. */
    const mainViewRow = (sessions) => {
      for (const id of sessions.ids) {
        const row = sessions.byId[id]
        if (row !== undefined && (row.retainedBy?.mainView ?? 0) > 0) return row
      }
      return undefined
    }
    const maybeHome = () => {
      if (done) return
      const sessions = ctx.sessions.list.getSnapshot()
      const workspaces = ctx.workspaces.list.getSnapshot()
      if (sessions.phase !== 'ready' || workspaces.phase !== 'ready') return
      // Another global panel already owns the center (including this workbench).
      if (ctx.layout.panelInfo.getSnapshot().activePanelId !== null) {
        finish()
        return
      }
      // A main Session is bound (task launch with preserve, Open session, or
      // restore). Do not steal Conversation — production has no sessions.current.
      if (mainViewRow(sessions) !== undefined) {
        finish()
        return
      }
      try {
        ctx.layout.selectPanel(PANEL_ID)
        finish()
      } catch (_error) {
        // Main registration may still be pending; retry on the next catalog tick.
      }
    }
    offSessions = ctx.sessions.list.subscribe(maybeHome)
    offWorkspaces = ctx.workspaces.list.subscribe(maybeHome)
    // Open session reveals with null; ignore that so cold-start home cannot snap back.
    offPanel = ctx.layout.onPanelSelection((panelId) => {
      if (panelId === null) return
      maybeHome()
    })
    maybeHome()
    return () => {
      offSessions()
      offWorkspaces()
      offPanel()
    }
  }, 'dsh-business-entry: home panel')

  // --- Hot-toggleable slim sidebar.business control ---
  let sidebarDisposer = null

  function registerSidebar() {
    if (sidebarDisposer) return
    sidebarDisposer = ctx.slots.inject('sidebar.business', () => ctx.slots.register(
      {
        name: 'sidebar.business',
        store: viewStore,
        locale: NS,
        inject: () => ({
          openWorkbench,
        }),
      },
      BusinessNav,
    ))
  }

  function unregisterSidebar() {
    if (sidebarDisposer) {
      sidebarDisposer()
      sidebarDisposer = null
    }
  }

  const ipc = typeof window !== 'undefined' ? window.__DSH_IPC__ : undefined
  if (ipc) {
    ipc.invoke('dsh:plugin:isEnabled', PLUGIN_ID).then(enabled => {
      if (enabled) registerSidebar()
    }).catch(() => {
      registerSidebar()
    })
  } else {
    registerSidebar()
  }

  function onToggle(event) {
    if (event.detail?.enabled) {
      registerSidebar()
    } else {
      unregisterSidebar()
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener(TOGGLE_EVENT, onToggle)
  }

  ctx.effect(() => {
    return () => {
      unregisterSidebar()
      if (typeof window !== 'undefined') {
        window.removeEventListener(TOGGLE_EVENT, onToggle)
      }
    }
  }, 'dsh-business-entry: hot-toggle lifecycle')
}
