/**
 * Workbench page for direct media download (no Agent Session).
 * Calls Host `/api/business/video/*` Fetch routes.
 */
import React from 'react'
import { BUSINESS_ENTRIES } from './entries.js'
import { css } from './styles.js'
import { PageChrome } from './TaskChrome.jsx'
import { loadVideoHistory, prependVideoHistory, saveVideoHistory } from './video-history.js'

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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatAt(at) {
  const d = new Date(at)
  const pad = value => String(value).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function postJson(path, body, signal) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  let data
  try {
    data = await response.json()
  } catch {
    data = { error: `HTTP ${response.status}` }
  }
  return { ok: response.ok, status: response.status, data }
}

/**
 * @param props - workbench inject face scoped to video download.
 */
export function VideoDownloadPage({ t, setActiveEntryId }) {
  const [url, setUrl] = React.useState('')
  const [fileName, setFileName] = React.useState('')
  const [analysis, setAnalysis] = React.useState(null)
  const [result, setResult] = React.useState(null)
  const [error, setError] = React.useState(undefined)
  const [busy, setBusy] = React.useState(undefined)
  const [history, setHistory] = React.useState(() => loadVideoHistory())
  const abortRef = React.useRef(null)

  React.useEffect(() => () => {
    abortRef.current?.abort()
  }, [])

  const clearNotice = () => {
    setError(undefined)
  }

  const runAnalyze = async () => {
    const trimmed = url.trim()
    if (trimmed === '') {
      setError(t('video.needUrl'))
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy('analyze')
    setError(undefined)
    setResult(null)
    try {
      const { ok, data } = await postJson('/api/business/video/analyze', { url: trimmed }, controller.signal)
      if (!ok) {
        setAnalysis(null)
        setError(typeof data.error === 'string' ? data.error : t('video.analyzeFailed'))
        return
      }
      setAnalysis(data)
      if (data.isMedia !== true) setError(t('video.needDirect'))
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(undefined)
    }
  }

  const runDownload = async () => {
    const trimmed = url.trim()
    if (trimmed === '') {
      setError(t('video.needUrl'))
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy('download')
    setError(undefined)
    setResult(null)
    try {
      const body = { url: trimmed }
      if (fileName.trim() !== '') body.fileName = fileName.trim()
      const { ok, data } = await postJson('/api/business/video/download', body, controller.signal)
      if (!ok) {
        if (data.analysis !== undefined) setAnalysis(data.analysis)
        setError(typeof data.error === 'string' ? data.error : t('video.downloadFailed'))
        return
      }
      setResult(data)
      if (data.site !== undefined || data.quality !== undefined) {
        setAnalysis(prev => prev ?? {
          isMedia: true,
          site: data.site,
          quality: data.quality,
          ext: data.ext,
        })
      }
      const next = prependVideoHistory(history, {
        url: trimmed,
        savedTo: data.savedTo,
        bytes: data.bytes,
        quality: data.quality ?? '',
        ext: data.ext ?? '',
        site: data.site ?? '',
      })
      setHistory(next)
      saveVideoHistory(next)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(undefined)
    }
  }

  const entry = BUSINESS_ENTRIES.find(row => row.id === 'videoDownload')

  return React.createElement(PageChrome, {
    t,
    entry,
    title: t('item.videoDownload'),
    subtitle: t('video.subtitle'),
    onBack: () => { setActiveEntryId(undefined) },
  },
      error !== undefined && React.createElement('div', {
        className: css.note,
        role: 'alert',
        title: t('launch.dismiss'),
        onClick: clearNotice,
      },
        React.createElement('span', { className: css.noteText }, error),
      ),

      React.createElement('section', { className: clsx(css.dsSection, css.wbPanel) },
        React.createElement('h2', { className: css.dsSectionTitle }, t('video.formTitle')),
        React.createElement('p', { className: css.dsHint }, t('video.formHint')),
        React.createElement('label', { className: css.wbField },
          React.createElement('span', { className: css.wbFieldLabel }, t('video.url')),
          React.createElement('input', {
            className: css.wbInput,
            value: url,
            disabled: busy !== undefined,
            placeholder: t('video.urlPlaceholder'),
            onChange: (event) => { setUrl(event.target.value) },
          }),
        ),
        React.createElement('label', { className: css.wbField },
          React.createElement('span', { className: css.wbFieldLabel }, t('video.fileName')),
          React.createElement('input', {
            className: css.wbInput,
            value: fileName,
            disabled: busy !== undefined,
            placeholder: t('video.fileNamePlaceholder'),
            onChange: (event) => { setFileName(event.target.value) },
          }),
        ),
        React.createElement('div', { className: css.wbActions },
          React.createElement('button', {
            type: 'button',
            className: css.wbSecondary,
            disabled: busy !== undefined,
            onClick: () => { void runAnalyze() },
          }, busy === 'analyze' ? t('video.analyzing') : t('video.analyze')),
          React.createElement('button', {
            type: 'button',
            className: css.wbPrimary,
            disabled: busy !== undefined,
            onClick: () => { void runDownload() },
          }, busy === 'download' ? t('video.downloading') : t('video.download')),
        ),
      ),

      analysis !== null && React.createElement('section', { className: clsx(css.dsSection, css.wbPanel) },
        React.createElement('h2', { className: css.dsSectionTitle }, t('video.analysisTitle')),
        React.createElement('ul', { className: css.dsPickList },
          React.createElement('li', { className: css.dsPickRow },
            `${t('video.site')}: ${analysis.site ?? '—'}`,
          ),
          React.createElement('li', { className: css.dsPickRow },
            `${t('video.isMedia')}: ${analysis.isMedia === true ? t('video.yes') : t('video.no')}`,
          ),
          React.createElement('li', { className: css.dsPickRow },
            `${t('video.quality')}: ${analysis.quality || '—'}`,
          ),
          React.createElement('li', { className: css.dsPickRow },
            `${t('video.ext')}: ${analysis.ext || '—'}`,
          ),
        ),
      ),

      result !== null && React.createElement('section', { className: clsx(css.dsSection, css.wbPanel) },
        React.createElement('h2', { className: css.dsSectionTitle }, t('video.resultTitle')),
        React.createElement('p', { className: css.wbEmpty },
          `${t('video.savedTo')}: ${result.savedTo}`,
        ),
        React.createElement('p', { className: css.wbEmpty },
          `${t('video.bytes')}: ${formatBytes(result.bytes)} · ${result.elapsedMs ?? '—'} ms`,
        ),
      ),

      React.createElement('section', { className: clsx(css.wbRuns, css.wbPanel) },
        React.createElement('h2', { className: css.wbRunsTitle }, t('video.historyTitle')),
        history.length === 0
          ? React.createElement('p', { className: css.wbEmpty }, t('video.historyEmpty'))
          : React.createElement('ul', { className: css.wbRunList },
            history.map(row => React.createElement('li', {
              key: `${row.at}-${row.savedTo}`,
              className: css.wbRunRow,
            },
              React.createElement('span', { className: css.historyTime }, formatAt(row.at)),
              React.createElement('span', { className: css.dsItemMeta },
                `${row.site || '—'} · ${formatBytes(row.bytes)} · ${row.savedTo}`,
              ),
            )),
          ),
      ),
  )
}
