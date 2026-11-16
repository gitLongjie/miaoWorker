/**
 * Business workbench main panel: task cards, per-task forms, and run cards.
 * Launch goes through the injected face; this file only owns presentation.
 */
import React from 'react'
import { DailyReportPage } from './DailyReportPage.jsx'
import { BUSINESS_ENTRIES } from './entries.js'
import { ENTRY_FIELDS, FIELD_DEFS, formComplete, selectedLabels } from './forms.js'
import { css } from './styles.js'
import { ENTRY_ICONS, PageChrome, SearchIcon, SendIcon, TASK_SUBTITLE } from './TaskChrome.jsx'
import { VideoDownloadPage } from './VideoDownloadPage.jsx'

function clsx(...args) {
  let result = ''
  for (const arg of args) {
    if (!arg) continue
    if (typeof arg === 'string') { result += (result ? ' ' : '') + arg; continue }
    if (Array.isArray(arg)) { const inner = clsx(...arg); if (inner) result += (result ? ' ' : '') + inner; continue }
    if (typeof arg === 'object') {
      for (const key in arg) {
        if (Object.prototype.hasOwnProperty.call(arg, key) && arg[key]) {
          result += (result ? ' ' : '') + key
        }
      }
    }
  }
  return result
}

function formatSessionTime(updatedAt) {
  const at = new Date(updatedAt)
  const pad = value => String(value).padStart(2, '0')
  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

function greetingKey(now = new Date()) {
  const hour = now.getHours()
  if (hour < 12) return 'workbench.greeting.morning'
  if (hour < 18) return 'workbench.greeting.afternoon'
  return 'workbench.greeting.evening'
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function flattenRuns(history) {
  const rows = []
  for (const entry of BUSINESS_ENTRIES) {
    const list = history.entries[entry.id] ?? []
    for (const row of list) {
      rows.push({ ...row, entryId: entry.id, entry })
    }
  }
  rows.sort((a, b) => b.updatedAt - a.updatedAt)
  return rows
}

function BrandMark({ size = 64 }) {
  return React.createElement('span', {
    className: css.wbBrandMark,
    style: { width: size, height: size, fontSize: Math.round(size * 0.42) },
    'aria-hidden': 'true',
  }, '喵')
}

function RingMeter({ value, label }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const target = Math.max(8, value)
  const ratio = Math.min(1, value / target)
  const offset = circumference * (1 - ratio)
  return React.createElement('div', { className: css.wbRing },
    React.createElement('svg', {
      className: css.wbRingSvg,
      viewBox: '0 0 128 128',
      'aria-hidden': 'true',
    },
      React.createElement('circle', {
        className: css.wbRingTrack,
        cx: '64', cy: '64', r: radius,
      }),
      React.createElement('circle', {
        className: css.wbRingValue,
        cx: '64', cy: '64', r: radius,
        strokeDasharray: `${circumference}`,
        strokeDashoffset: `${offset}`,
      }),
    ),
    React.createElement('div', { className: css.wbRingCenter },
      React.createElement('span', { className: css.wbRingNumber }, String(value)),
      React.createElement('span', { className: css.wbRingLabel }, label),
    ),
  )
}

function HomePage({
  t, pending, error, clearError, history, setActiveEntryId, openSession,
}) {
  const [query, setQuery] = React.useState('')
  const [scope, setScope] = React.useState('today')
  const allRuns = flattenRuns(history)
  const now = new Date()

  const filtered = BUSINESS_ENTRIES.filter(entry => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = `${t(entry.label)} ${t(entry.blurb)} ${(entry.tags ?? []).map(tag => t(tag)).join(' ')}`.toLowerCase()
    return hay.includes(q)
  })

  const scopedRuns = allRuns.filter(row => {
    const at = new Date(row.updatedAt)
    return scope === 'today' ? sameDay(at, now) : sameMonth(at, now)
  })
  const totalRuns = allRuns.length
  const runningCount = allRuns.filter(row => row.running).length
  const doneCount = totalRuns - runningCount
  const typeCount = BUSINESS_ENTRIES.filter(entry => (history.entries[entry.id] ?? []).length > 0).length
  const doneShare = totalRuns === 0 ? 0 : Math.round((doneCount / totalRuns) * 100)
  const recent = allRuns.slice(0, 5)

  const openFirstMatch = () => {
    if (filtered.length === 1) setActiveEntryId(filtered[0].id)
  }

  return React.createElement('div', { className: css.wbRoot },
    React.createElement('div', { className: css.wbHome },
      error !== undefined && React.createElement('div', {
        className: css.note,
        role: 'alert',
        title: t('launch.dismiss'),
        onClick: () => { clearError() },
      },
        React.createElement('span', { className: css.noteText }, t('launch.failed')),
        React.createElement('span', { className: css.noteDetail }, error),
      ),

      React.createElement('div', { className: css.wbLayout },
        React.createElement('div', { className: css.wbMain },
          React.createElement('section', { className: css.wbHero },
            React.createElement(BrandMark, { size: 72 }),
            React.createElement('h1', { className: css.wbHeroTitle }, t(greetingKey())),
            React.createElement('p', { className: css.wbHeroSub }, t('workbench.subtitle')),
            React.createElement('div', { className: css.wbSearch },
              React.createElement('span', { className: css.wbSearchIcon }, React.createElement(SearchIcon)),
              React.createElement('input', {
                className: css.wbSearchInput,
                type: 'search',
                value: query,
                placeholder: t('workbench.searchPlaceholder'),
                onChange: (event) => { setQuery(event.target.value) },
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    openFirstMatch()
                  }
                },
              }),
              React.createElement('button', {
                type: 'button',
                className: css.wbSearchSend,
                'aria-label': t('workbench.openTask'),
                onClick: openFirstMatch,
              }, React.createElement(SendIcon)),
            ),
            React.createElement('div', { className: css.wbPills },
              BUSINESS_ENTRIES.slice(0, 4).map(entry => React.createElement('button', {
                key: entry.id,
                type: 'button',
                className: css.wbPill,
                disabled: pending !== undefined,
                onClick: () => { setActiveEntryId(entry.id) },
              }, t(entry.label))),
            ),
          ),

          React.createElement('section', { className: css.wbSection },
            React.createElement('div', { className: css.wbSectionHead },
              React.createElement('h2', { className: css.wbSectionTitle }, t('workbench.tasksTitle')),
              React.createElement('p', { className: css.wbSectionHint }, t('workbench.tasksHint')),
            ),
            filtered.length === 0
              ? React.createElement('p', { className: css.wbEmpty }, t('workbench.searchEmpty'))
              : React.createElement('div', { className: css.wbGrid },
                filtered.map((entry, index) => {
                  const runs = history.entries[entry.id] ?? []
                  const busy = pending === entry.id
                  return React.createElement('button', {
                    key: entry.id,
                    type: 'button',
                    className: css.wbCard,
                    style: {
                      '--be-accent': entry.accent,
                      '--be-stagger': `${index * 35}ms`,
                    },
                    disabled: pending !== undefined,
                    onClick: () => { setActiveEntryId(entry.id) },
                  },
                    React.createElement('div', { className: css.wbCardCopy },
                      React.createElement('span', { className: css.wbCardTitle }, t(entry.label)),
                      React.createElement('div', { className: css.wbCardTags },
                        (entry.tags ?? []).map(tag => React.createElement('span', {
                          key: tag,
                          className: css.wbTag,
                        }, t(tag))),
                      ),
                      React.createElement('span', { className: css.wbCardBlurb }, t(entry.blurb)),
                      React.createElement('span', { className: css.wbCardMeta },
                        busy ? t('workbench.running') : t('item.history', { count: runs.length }),
                      ),
                    ),
                    React.createElement('div', { className: css.wbCardArt, 'aria-hidden': 'true' },
                      React.createElement('span', { className: css.wbCardArtOrb }),
                      React.createElement('span', { className: css.wbCardArtOrbAlt }),
                      React.createElement('span', { className: css.wbCardIcon }, ENTRY_ICONS[entry.id]),
                    ),
                  )
                }),
              ),
          ),

          React.createElement('section', { className: clsx(css.wbSection, css.wbRecent) },
            React.createElement('div', { className: css.wbSectionHead },
              React.createElement('h2', { className: css.wbSectionTitle }, t('workbench.recentTitle')),
            ),
            recent.length === 0
              ? React.createElement('p', { className: css.wbEmpty }, t('workbench.recentEmpty'))
              : React.createElement('ul', { className: css.wbRecentList },
                recent.map(row => React.createElement('li', {
                  key: row.sessionId,
                  className: clsx(css.wbRecentRow, row.sessionId === history.current && css.wbRunCurrent),
                },
                  React.createElement('span', {
                    className: css.wbRecentAvatar,
                    style: { background: row.entry.accent },
                    'aria-hidden': 'true',
                  }, ENTRY_ICONS[row.entryId]),
                  React.createElement('div', { className: css.wbRecentBody },
                    React.createElement('span', { className: css.wbRecentTitle }, t(row.entry.label)),
                    React.createElement('span', { className: css.wbRecentMeta },
                      row.running ? t('workbench.running') : t('item.history', { count: (history.entries[row.entryId] ?? []).length }),
                    ),
                  ),
                  React.createElement('span', { className: css.historyTime }, formatSessionTime(row.updatedAt)),
                  React.createElement('button', {
                    type: 'button',
                    className: css.wbSecondary,
                    onClick: () => { openSession(row.sessionId) },
                  }, t('workbench.openSession')),
                )),
              ),
          ),
        ),

        React.createElement('aside', { className: css.wbAside },
          React.createElement('div', { className: css.wbAsideCard },
            React.createElement('h2', { className: css.wbAsideTitle }, t('workbench.overviewTitle')),
            React.createElement(RingMeter, {
              value: scopedRuns.length,
              label: scope === 'today' ? t('workbench.overviewToday') : t('workbench.overviewMonth'),
            }),
            React.createElement('div', { className: css.wbScopeToggle },
              React.createElement('button', {
                type: 'button',
                className: clsx(css.wbScopeBtn, scope === 'today' && css.wbScopeBtnOn),
                onClick: () => { setScope('today') },
              }, t('workbench.overviewToday')),
              React.createElement('button', {
                type: 'button',
                className: clsx(css.wbScopeBtn, scope === 'month' && css.wbScopeBtnOn),
                onClick: () => { setScope('month') },
              }, t('workbench.overviewMonth')),
            ),
            React.createElement('div', { className: css.wbStatList },
              React.createElement('div', { className: css.wbStat },
                React.createElement('span', { className: css.wbStatIcon, 'aria-hidden': 'true' }, '∑'),
                React.createElement('div', { className: css.wbStatBody },
                  React.createElement('span', { className: css.wbStatLabel }, t('workbench.statTotal')),
                  React.createElement('span', { className: css.wbStatValue }, String(totalRuns)),
                ),
              ),
              React.createElement('div', { className: css.wbStat },
                React.createElement('span', { className: css.wbStatIcon, 'aria-hidden': 'true' }, '◎'),
                React.createElement('div', { className: css.wbStatBody },
                  React.createElement('span', { className: css.wbStatLabel }, t('workbench.statRunning')),
                  React.createElement('span', { className: css.wbStatValue }, String(runningCount)),
                ),
              ),
              React.createElement('div', { className: css.wbStat },
                React.createElement('span', { className: css.wbStatIcon, 'aria-hidden': 'true' }, '▦'),
                React.createElement('div', { className: css.wbStatBody },
                  React.createElement('span', { className: css.wbStatLabel }, t('workbench.statTypes')),
                  React.createElement('span', { className: css.wbStatValue }, `${typeCount}/${BUSINESS_ENTRIES.length}`),
                ),
              ),
              React.createElement('div', { className: css.wbStat },
                React.createElement('span', { className: css.wbStatIcon, 'aria-hidden': 'true' }, '✓'),
                React.createElement('div', { className: css.wbStatBody },
                  React.createElement('span', { className: css.wbStatLabel }, t('workbench.statDone')),
                  React.createElement('span', { className: css.wbStatValue }, `${doneShare}%`),
                  React.createElement('span', {
                    className: css.wbStatBar,
                    'aria-hidden': 'true',
                  }, React.createElement('span', {
                    className: css.wbStatBarFill,
                    style: { width: `${doneShare}%` },
                  })),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  )
}

/**
 * @param props - main-slot props plus workbench inject face.
 */
export function WorkbenchPage({
  t, useStore, useHistory, launchForm, openSession, setActiveEntryId, clearError,
  useDataSources, dataSourceActions,
}) {
  const pending = useStore(s => s.pending)
  const error = useStore(s => s.error)
  const activeEntryId = useStore(s => s.selected)
  const history = useHistory(s => s)
  const [values, setValues] = React.useState({})
  const [formError, setFormError] = React.useState(undefined)
  const active = BUSINESS_ENTRIES.find(entry => entry.id === activeEntryId)

  React.useEffect(() => {
    setValues({})
    setFormError(undefined)
  }, [activeEntryId])

  const setField = (id, value) => {
    setValues(prev => ({ ...prev, [id]: value }))
  }

  const onSubmit = (fresh) => {
    if (active === undefined) return
    if (!formComplete(active.id, values)) {
      setFormError(t('workbench.required'))
      return
    }
    setFormError(undefined)
    launchForm(active.id, values, { fresh })
  }

  if (active?.id === 'dailyReport') {
    return React.createElement(DailyReportPage, {
      t,
      pending,
      error,
      clearError,
      launchForm,
      openSession,
      setActiveEntryId,
      useHistory,
      useDataSources,
      dataSourceActions,
    })
  }

  if (active?.id === 'videoDownload') {
    return React.createElement(VideoDownloadPage, {
      t,
      setActiveEntryId,
    })
  }

  if (active === undefined) {
    return React.createElement(HomePage, {
      t,
      pending,
      error,
      clearError,
      history,
      setActiveEntryId,
      openSession,
    })
  }

  const fields = ENTRY_FIELDS[active.id] ?? []
  const runs = history.entries[active.id] ?? []
  const busy = pending === active.id
  const subtitleKey = TASK_SUBTITLE[active.id]
  const taskSubtitle = subtitleKey !== undefined ? t(subtitleKey) : t(active.blurb)
  const useFieldGrid = fields.length >= 2
    && fields.every(id => FIELD_DEFS[id]?.multiline !== true)
    && fields.every(id => !Array.isArray(FIELD_DEFS[id]?.options))

  return React.createElement(PageChrome, {
    t,
    entry: active,
    title: t(active.label),
    subtitle: taskSubtitle,
    onBack: () => { setActiveEntryId(undefined) },
  },
    (error !== undefined || formError !== undefined) && React.createElement('div', {
      className: css.note,
      role: 'alert',
      title: t('launch.dismiss'),
      onClick: () => { clearError(); setFormError(undefined) },
    },
      React.createElement('span', { className: css.noteText }, formError ?? t('launch.failed')),
      error !== undefined && formError === undefined
        ? React.createElement('span', { className: css.noteDetail }, error)
        : null,
    ),
    React.createElement('div', { className: css.wbPanel },
      React.createElement('div', { className: css.wbFormHead },
        React.createElement('h2', { className: css.wbFormTitle }, t('workbench.paramsTitle')),
        React.createElement('p', { className: css.wbFormHint }, t('workbench.paramsHint')),
      ),
      React.createElement('form', {
        className: css.wbForm,
        onSubmit: (event) => { event.preventDefault(); onSubmit(false) },
      },
        React.createElement('div', { className: useFieldGrid ? css.wbFieldGrid : undefined },
          fields.map(fieldId => {
            const def = FIELD_DEFS[fieldId]
            const label = t(`field.${fieldId}`)
            const current = values[fieldId] ?? (def?.multiple === true ? [] : '')
            const placeholderKey = `field.${fieldId}.placeholder`
            const placeholderRaw = t(placeholderKey)
            const placeholderText = placeholderRaw === placeholderKey ? undefined : placeholderRaw
            const wide = def?.multiline === true
              || (Array.isArray(def?.options) && def.options.length > 0)
              || fields.length === 1
            const inputProps = {
              id: `be-field-${fieldId}`,
              className: css.wbInput,
              value: typeof current === 'string' ? current : '',
              disabled: busy,
              placeholder: placeholderText,
              onChange: (event) => { setField(fieldId, event.target.value) },
            }
            let control
            if (Array.isArray(def?.options) && def.options.length > 0) {
              // Curated choices only — never a free-text box for these fields.
              const multi = def.multiple === true
              const picked = selectedLabels(current)
              control = React.createElement('div', {
                className: css.wbOptionRow,
                role: multi ? 'group' : 'radiogroup',
                'aria-label': label,
              },
                ...def.options.map(optionId => {
                  const optionLabel = t(`option.${fieldId}.${optionId}`)
                  const selected = picked.includes(optionLabel)
                  return React.createElement('button', {
                    key: optionId,
                    type: 'button',
                    className: clsx(css.wbOption, selected && css.wbOptionOn),
                    disabled: busy,
                    'aria-pressed': selected,
                    onClick: () => {
                      if (!multi) {
                        setField(fieldId, optionLabel)
                        return
                      }
                      setField(
                        fieldId,
                        selected
                          ? picked.filter(item => item !== optionLabel)
                          : [...picked, optionLabel],
                      )
                    },
                  }, optionLabel)
                }),
              )
            } else if (def?.multiline === true) {
              control = React.createElement('textarea', { ...inputProps, rows: 5 })
            } else {
              control = React.createElement('input', { ...inputProps, type: 'text' })
            }
            return React.createElement('label', {
              key: fieldId,
              className: clsx(css.wbField, wide && useFieldGrid && css.wbFieldWide),
              htmlFor: Array.isArray(def?.options) ? undefined : `be-field-${fieldId}`,
            },
              React.createElement('span', { className: css.wbFieldLabel }, label),
              control,
            )
          }),
        ),
        React.createElement('div', { className: css.wbActionsBar },
          React.createElement('button', {
            type: 'submit',
            className: css.wbPrimary,
            disabled: busy || pending !== undefined,
          }, busy ? t('workbench.running') : t('workbench.submit')),
          runs.length > 0 && React.createElement('button', {
            type: 'button',
            className: css.wbSecondary,
            disabled: busy || pending !== undefined,
            onClick: () => { onSubmit(true) },
          }, t('workbench.submitFresh')),
        ),
      ),
    ),
    React.createElement('section', { className: clsx(css.wbRuns, css.wbPanel) },
      React.createElement('h2', { className: css.wbRunsTitle }, t('workbench.runs')),
      runs.length === 0
        ? React.createElement('p', { className: css.wbEmpty }, t('workbench.emptyRuns'))
        : React.createElement('ul', { className: css.wbRunList },
          runs.map(row => React.createElement('li', {
            key: row.sessionId,
            className: clsx(css.wbRunRow, row.sessionId === history.current && css.wbRunCurrent),
          },
            React.createElement('span', {
              className: css.wbRecentAvatar,
              style: { background: active.accent },
              'aria-hidden': 'true',
            }, ENTRY_ICONS[active.id]),
            React.createElement('div', { className: css.wbRecentBody },
              React.createElement('span', { className: css.wbRecentTitle }, t(active.label)),
              React.createElement('span', { className: css.wbRecentMeta },
                row.running ? t('workbench.running') : formatSessionTime(row.updatedAt),
              ),
            ),
            React.createElement('button', {
              type: 'button',
              className: css.wbSecondary,
              onClick: () => { openSession(row.sessionId) },
            }, t('workbench.openSession')),
          )),
        ),
    ),
  )
}
