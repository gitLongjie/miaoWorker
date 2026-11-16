/**
 * Browser-local history of workbench video downloads (not Agent Sessions).
 */
export const VIDEO_HISTORY_KEY = 'dsh.business.video-downloads.v1'
const MAX_ROWS = 30

/**
 * @param raw - unknown localStorage parse result.
 * @returns normalized history rows newest first.
 */
export function normalizeVideoHistory(raw) {
  if (!Array.isArray(raw)) return []
  const rows = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    if (typeof item.url !== 'string' || typeof item.savedTo !== 'string') continue
    if (typeof item.at !== 'number') continue
    rows.push({
      url: item.url,
      savedTo: item.savedTo,
      bytes: typeof item.bytes === 'number' ? item.bytes : 0,
      quality: typeof item.quality === 'string' ? item.quality : '',
      ext: typeof item.ext === 'string' ? item.ext : '',
      site: typeof item.site === 'string' ? item.site : '',
      at: item.at,
    })
  }
  rows.sort((a, b) => b.at - a.at)
  return rows.slice(0, MAX_ROWS)
}

/**
 * Read history from localStorage.
 * @returns history rows.
 */
export function loadVideoHistory() {
  try {
    const raw = localStorage.getItem(VIDEO_HISTORY_KEY)
    if (raw === null) return []
    return normalizeVideoHistory(JSON.parse(raw))
  } catch {
    return []
  }
}

/**
 * Persist history to localStorage.
 * @param rows - history rows.
 */
export function saveVideoHistory(rows) {
  try {
    localStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(normalizeVideoHistory(rows)))
  } catch {
    // Quota or private mode — history is best-effort.
  }
}

/**
 * Prepend a successful download row.
 * @param rows - current rows.
 * @param row - new row without `at` (filled here).
 * @returns next rows.
 */
export function prependVideoHistory(rows, row) {
  return normalizeVideoHistory([{ ...row, at: Date.now() }, ...rows])
}
