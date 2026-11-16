/**
 * Daily-report data sources: browser-local catalog the workbench persists and
 * the daily-report page picks from. A source is named once; generating a report
 * selects existing sources instead of retyping “数据来源”.
 */

/** How the source supplies numbers for a report. */
export const SOURCE_METHODS = ['paste', 'file', 'system']

/**
 * @returns a new source id.
 */
export function newSourceId() {
  return `ds-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Normalize one source record for storage.
 * @param input - partial source fields from the editor.
 * @param existing - previous record when editing.
 * @returns a complete source, or undefined when name is empty.
 */
export function normalizeSource(input, existing) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (name === '') return undefined
  const method = SOURCE_METHODS.includes(input?.method) ? input.method : 'paste'
  const note = typeof input?.note === 'string' ? input.note.trim() : ''
  const content = typeof input?.content === 'string' ? input.content : ''
  const now = Date.now()
  return {
    id: existing?.id ?? newSourceId(),
    name,
    method,
    note,
    content,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

/**
 * Build the `dataSource` / `pastedData` values the daily-report prompt expects
 * from the selected catalog rows.
 * @param sources - full catalog.
 * @param selectedIds - ids the user picked for this run.
 * @param emptyLabel - locale placeholder when a piece is missing.
 * @param methodLabel - maps method id → localized label.
 * @returns `{ dataSource, pastedData }` for {@link composePrompt}.
 */
export function valuesFromSources(sources, selectedIds, emptyLabel, methodLabel) {
  const selected = (selectedIds ?? [])
    .map(id => sources.find(row => row.id === id))
    .filter(row => row !== undefined)
  if (selected.length === 0) {
    return { dataSource: emptyLabel, pastedData: emptyLabel }
  }
  const dataSource = selected.map(row => {
    const method = typeof methodLabel === 'function' ? methodLabel(row.method) : row.method
    const note = row.note.trim() === '' ? '' : `; ${row.note.trim()}`
    return `${row.name} (${method}${note})`
  }).join('; ')
  const pastedParts = selected
    .map(row => row.content.trim())
    .filter(text => text !== '')
  const pastedData = pastedParts.length === 0 ? emptyLabel : pastedParts.join('\n\n---\n\n')
  return { dataSource, pastedData }
}
