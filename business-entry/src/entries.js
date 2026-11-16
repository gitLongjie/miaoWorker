/**
 * The business-entry catalog: the deployment's own task entries in the order
 * the workbench and slim sidebar control render them. One physical list — the
 * component maps it, the selection id type derives from it, and the instruction
 * a submit sends lives here too — so a row's id, its label, and its prompt
 * cannot drift apart. Form field ids for each entry live in `forms.js`.
 */

/** The business entries, top to bottom. */
export const BUSINESS_ENTRIES = [
  {
    id: 'dailyReport',
    label: 'item.dailyReport',
    blurb: 'item.blurb.dailyReport',
    tags: ['item.tag.data', 'item.tag.daily'],
    prompt: 'prompt.dailyReport',
    accent: '#2563eb',
  },
  {
    id: 'topics',
    label: 'item.topics',
    blurb: 'item.blurb.topics',
    tags: ['item.tag.hot', 'item.tag.ideas'],
    prompt: 'prompt.topics',
    accent: '#7c3aed',
  },
  {
    id: 'sentiment',
    label: 'item.sentiment',
    blurb: 'item.blurb.sentiment',
    tags: ['item.tag.monitor', 'item.tag.risk'],
    prompt: 'prompt.sentiment',
    accent: '#059669',
  },
  {
    id: 'videoScript',
    label: 'item.videoScript',
    blurb: 'item.blurb.videoScript',
    tags: ['item.tag.video', 'item.tag.script'],
    prompt: 'prompt.videoScript',
    accent: '#ea580c',
  },
  {
    id: 'videoDownload',
    label: 'item.videoDownload',
    blurb: 'item.blurb.videoDownload',
    tags: ['item.tag.video', 'item.tag.download'],
    kind: 'direct',
    accent: '#0d9488',
  },
  {
    id: 'report',
    label: 'item.report',
    blurb: 'item.blurb.report',
    tags: ['item.tag.doc', 'item.tag.brief'],
    prompt: 'prompt.report',
    accent: '#dc2626',
  },
  {
    id: 'multiFormat',
    label: 'item.multiFormat',
    blurb: 'item.blurb.multiFormat',
    tags: ['item.tag.rewrite', 'item.tag.multi'],
    prompt: 'prompt.multiFormat',
    accent: '#8b5cf6',
  },
  {
    id: 'rumor',
    label: 'item.rumor',
    blurb: 'item.blurb.rumor',
    tags: ['item.tag.verify', 'item.tag.safety'],
    prompt: 'prompt.rumor',
    accent: '#0891b2',
  },
]
