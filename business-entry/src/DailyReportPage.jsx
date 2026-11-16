/**
 * Daily-report task page: manage reusable data sources first, then generate a
 * report by picking period, platforms, and existing sources.
 */
import React from 'react'
import { normalizeSource, SOURCE_METHODS, valuesFromSources } from './data-sources.js'
import { BUSINESS_ENTRIES } from './entries.js'
import { css } from './styles.js'
import { PageChrome } from './TaskChrome.jsx'

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

function emptyDraft() {
  return { name: '', method: 'paste', note: '', content: '' }
}

/**
 * @param props - workbench inject face scoped to the daily-report entry.
 */
export function DailyReportPage({
  t, pending, error, clearError, launchForm, openSession, setActiveEntryId,
  useHistory, useDataSources, dataSourceActions,
}) {
  const history = useHistory(s => s)
  const sources = useDataSources(s => s.sources)
  const [period, setPeriod] = React.useState('')
  const [platforms, setPlatforms] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState([])
  const [editor, setEditor] = React.useState(null)
  const [draft, setDraft] = React.useState(emptyDraft)
  const [formError, setFormError] = React.useState(undefined)
  const busy = pending === 'dailyReport'
  const runs = history.entries.dailyReport ?? []

  const methodLabel = (method) => t(`daily.method.${method}`)

  const openAdd = () => {
    setEditor({ mode: 'create' })
    setDraft(emptyDraft())
    setFormError(undefined)
  }

  const openEdit = (source) => {
    setEditor({ mode: 'edit', id: source.id })
    setDraft({
      name: source.name,
      method: source.method,
      note: source.note,
      content: source.content,
    })
    setFormError(undefined)
  }

  const cancelEditor = () => {
    setEditor(null)
    setDraft(emptyDraft())
  }

  const saveSource = () => {
    const existing = editor?.mode === 'edit'
      ? sources.find(row => row.id === editor.id)
      : undefined
    const next = normalizeSource(draft, existing)
    if (next === undefined) {
      setFormError(t('workbench.required'))
      return
    }
    if (editor?.mode === 'edit') dataSourceActions.update(next)
    else dataSourceActions.add(next)
    setEditor(null)
    setDraft(emptyDraft())
    setFormError(undefined)
    setSelectedIds(prev => (prev.includes(next.id) ? prev : [...prev, next.id]))
  }

  const toggleSource = (id) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
  }

  const onSubmit = (fresh) => {
    if (period.trim() === '' || platforms.trim() === '') {
      setFormError(t('workbench.required'))
      return
    }
    if (selectedIds.length === 0) {
      setFormError(t('daily.needSource'))
      return
    }
    setFormError(undefined)
    const fromSources = valuesFromSources(sources, selectedIds, t('field.empty'), methodLabel)
    launchForm('dailyReport', {
      period: period.trim(),
      platforms: platforms.trim(),
      ...fromSources,
    }, { fresh })
  }

  const entry = BUSINESS_ENTRIES.find(row => row.id === 'dailyReport')

  return React.createElement(PageChrome, {
    t,
    entry,
    title: t('item.dailyReport'),
    subtitle: t('daily.subtitle'),
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

      React.createElement('div', { className: css.dsSplit },
        React.createElement('section', { className: clsx(css.dsSection, css.wbPanel) },
          React.createElement('div', { className: css.wbActions },
            React.createElement('h2', { className: css.dsSectionTitle }, t('daily.sourcesTitle')),
            editor === null && React.createElement('button', {
              type: 'button',
              className: css.wbSecondary,
              onClick: openAdd,
              disabled: busy,
            }, t('daily.addSource')),
          ),
          React.createElement('p', { className: css.dsHint }, t('daily.sourcesHint')),
          sources.length === 0 && editor === null
            ? React.createElement('p', { className: css.wbEmpty }, t('daily.sourcesEmpty'))
            : React.createElement('ul', { className: css.dsList },
              sources.map(source => React.createElement('li', { key: source.id, className: css.dsItem },
                React.createElement('div', { className: css.dsItemBody },
                  React.createElement('span', { className: css.dsItemName }, source.name),
                  React.createElement('span', { className: css.dsItemMeta },
                    methodLabel(source.method)
                    + (source.note.trim() === '' ? '' : ` · ${source.note.trim()}`),
                  ),
                ),
                React.createElement('div', { className: css.dsItemActions },
                  React.createElement('button', {
                    type: 'button',
                    className: css.wbGhost,
                    disabled: busy,
                    onClick: () => { openEdit(source) },
                  }, t('daily.editSource')),
                  React.createElement('button', {
                    type: 'button',
                    className: css.wbGhost,
                    disabled: busy,
                    onClick: () => {
                      dataSourceActions.remove(source.id)
                      setSelectedIds(prev => prev.filter(id => id !== source.id))
                    },
                  }, t('daily.deleteSource')),
                ),
              )),
            ),
          editor !== null && React.createElement('div', { className: css.dsEditor },
            React.createElement('label', { className: css.wbField },
              React.createElement('span', { className: css.wbFieldLabel }, t('daily.sourceName')),
              React.createElement('input', {
                className: css.wbInput,
                value: draft.name,
                disabled: busy,
                onChange: (event) => { setDraft(prev => ({ ...prev, name: event.target.value })) },
              }),
            ),
            React.createElement('div', { className: css.wbField },
              React.createElement('span', { className: css.wbFieldLabel }, t('daily.sourceMethod')),
              React.createElement('div', { className: css.dsMethods },
                SOURCE_METHODS.map(method => React.createElement('label', {
                  key: method,
                  className: clsx(css.dsMethod, draft.method === method && css.dsMethodOn),
                },
                  React.createElement('input', {
                    type: 'radio',
                    name: 'be-source-method',
                    checked: draft.method === method,
                    disabled: busy,
                    onChange: () => { setDraft(prev => ({ ...prev, method })) },
                  }),
                  methodLabel(method),
                )),
              ),
            ),
            React.createElement('label', { className: css.wbField },
              React.createElement('span', { className: css.wbFieldLabel }, t('daily.sourceNote')),
              React.createElement('input', {
                className: css.wbInput,
                value: draft.note,
                disabled: busy,
                onChange: (event) => { setDraft(prev => ({ ...prev, note: event.target.value })) },
              }),
            ),
            React.createElement('label', { className: css.wbField },
              React.createElement('span', { className: css.wbFieldLabel }, t('daily.sourceContent')),
              React.createElement('textarea', {
                className: css.wbInput,
                rows: 5,
                value: draft.content,
                disabled: busy,
                onChange: (event) => { setDraft(prev => ({ ...prev, content: event.target.value })) },
              }),
            ),
            React.createElement('div', { className: css.wbActions },
              React.createElement('button', {
                type: 'button',
                className: css.wbPrimary,
                disabled: busy,
                onClick: saveSource,
              }, t('daily.saveSource')),
              React.createElement('button', {
                type: 'button',
                className: css.wbSecondary,
                disabled: busy,
                onClick: cancelEditor,
              }, t('daily.cancelEdit')),
            ),
          ),
        ),

        React.createElement('section', { className: clsx(css.dsSection, css.wbPanel) },
          React.createElement('h2', { className: css.dsSectionTitle }, t('daily.generateTitle')),
          React.createElement('form', {
            className: css.wbForm,
            onSubmit: (event) => { event.preventDefault(); onSubmit(false) },
          },
            React.createElement('label', { className: css.wbField },
              React.createElement('span', { className: css.wbFieldLabel }, t('field.period')),
              React.createElement('input', {
                className: css.wbInput,
                value: period,
                disabled: busy,
                onChange: (event) => { setPeriod(event.target.value) },
              }),
            ),
            React.createElement('label', { className: css.wbField },
              React.createElement('span', { className: css.wbFieldLabel }, t('field.platforms')),
              React.createElement('input', {
                className: css.wbInput,
                value: platforms,
                disabled: busy,
                onChange: (event) => { setPlatforms(event.target.value) },
              }),
            ),
            React.createElement('div', { className: css.wbField },
              React.createElement('span', { className: css.wbFieldLabel }, t('daily.pickSources')),
              sources.length === 0
                ? React.createElement('p', { className: css.wbEmpty }, t('daily.pickSourcesEmpty'))
                : React.createElement('ul', { className: css.dsPickList },
                  sources.map(source => {
                    const on = selectedIds.includes(source.id)
                    return React.createElement('li', { key: source.id },
                      React.createElement('label', {
                        className: clsx(css.dsPickRow, on && css.dsPickRowOn),
                      },
                        React.createElement('input', {
                          type: 'checkbox',
                          checked: on,
                          disabled: busy,
                          onChange: () => { toggleSource(source.id) },
                        }),
                        React.createElement('span', null, `${source.name} · ${methodLabel(source.method)}`),
                      ),
                    )
                  }),
                ),
            ),
            React.createElement('div', { className: css.wbActions },
              React.createElement('button', {
                type: 'submit',
                className: css.wbPrimary,
                disabled: busy || pending !== undefined || sources.length === 0,
              }, busy ? t('workbench.running') : t('workbench.submit')),
              runs.length > 0 && React.createElement('button', {
                type: 'button',
                className: css.wbSecondary,
                disabled: busy || pending !== undefined || sources.length === 0,
                onClick: () => { onSubmit(true) },
              }, t('workbench.submitFresh')),
            ),
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
              React.createElement('span', { className: css.historyTime }, formatSessionTime(row.updatedAt)),
              row.running
                ? React.createElement('span', { className: css.historyRunning }, t('workbench.running'))
                : null,
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
