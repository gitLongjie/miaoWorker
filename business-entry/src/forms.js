/**
 * Form catalogs and prompt composition for the business workbench.
 * Each entry declares the fields the page collects; {@link composePrompt}
 * fills the locale-owned `prompt.*` template with those values.
 */

/**
 * Curated publish platforms for fields that must not be free-typed.
 * Locale labels live at `option.platform.<id>`.
 */
export const PLATFORM_OPTIONS = [
  'wechat',
  'weibo',
  'xiaohongshu',
  'douyin',
  'channels',
  'bilibili',
]

/**
 * Curated sentiment windows. Locale labels live at `option.timeRange.<id>`.
 */
export const TIME_RANGE_OPTIONS = [
  'today',
  '3d',
  '7d',
  '30d',
]

/** Field ids shared across entries (locale keys are `field.<id>`). */
export const FIELD_DEFS = {
  period: { multiline: false },
  platforms: { multiline: false },
  dataSource: { multiline: false },
  pastedData: { multiline: true, optional: true },
  /** Target platform(s): multi-pick from {@link PLATFORM_OPTIONS}, never free text. */
  platform: { multiline: false, options: PLATFORM_OPTIONS, multiple: true },
  subject: { multiline: false },
  /** Sentiment window: single pick from {@link TIME_RANGE_OPTIONS}. */
  timeRange: { multiline: false, options: TIME_RANGE_OPTIONS },
  topic: { multiline: false },
  duration: { multiline: false },
  tone: { multiline: false },
  footage: { multiline: false },
  kind: { multiline: false },
  audience: { multiline: false },
  material: { multiline: true },
  length: { multiline: false },
  sourceText: { multiline: true },
  claim: { multiline: true },
}

/** Ordered field ids per business entry. `dailyReport` uses a dedicated page. */
export const ENTRY_FIELDS = {
  dailyReport: ['period', 'platforms'],
  /** Platform only — the agent fetches hotspots; no beat/positioning from the user. */
  topics: ['platform'],
  sentiment: ['subject', 'timeRange'],
  videoScript: ['topic', 'duration', 'platform', 'tone', 'footage'],
  report: ['kind', 'audience', 'material', 'length'],
  /** Source draft plus curated platform chips — never free-typed targets. */
  multiFormat: ['sourceText', 'platform'],
  rumor: ['claim'],
}

/**
 * Normalize a form value to the selected label list (multi-select or single).
 * @param raw - string, string[], or undefined.
 * @returns non-empty trimmed labels.
 */
export function selectedLabels(raw) {
  if (Array.isArray(raw)) {
    return raw.filter(item => typeof item === 'string' && item.trim() !== '').map(item => item.trim())
  }
  if (typeof raw === 'string' && raw.trim() !== '') return [raw.trim()]
  return []
}

/**
 * Fill one prompt template with form values. Unknown `{tokens}` stay as-is.
 * Empty optional fields become the locale placeholder for "not provided".
 * Multi-select arrays join with `、` so the instruction lists every platform.
 * @param template - locale `prompt.*` string with `{fieldId}` tokens.
 * @param values - map of field id → user input (string or string[]).
 * @param emptyLabel - text substituted for blank optional fields.
 * @returns the composed instruction.
 */
export function composePrompt(template, values, emptyLabel) {
  return template.replace(/\{(\w+)\}/gu, (_, key) => {
    const labels = selectedLabels(values[key])
    if (labels.length > 0) return labels.join('、')
    return emptyLabel
  })
}

/**
 * Whether every required field for an entry has non-empty input.
 * @param entryId - catalog entry id.
 * @param values - current form values.
 * @returns true when the form may submit.
 */
export function formComplete(entryId, values) {
  const fields = ENTRY_FIELDS[entryId]
  if (fields === undefined) return false
  for (const id of fields) {
    if (FIELD_DEFS[id]?.optional === true) continue
    const raw = values[id]
    if (FIELD_DEFS[id]?.multiple === true) {
      if (selectedLabels(raw).length === 0) return false
      continue
    }
    if (typeof raw !== 'string' || raw.trim() === '') return false
  }
  return true
}
