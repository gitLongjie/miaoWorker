/**
 * Shared task-page chrome and entry icons for the business workbench.
 */
import React from 'react'
import { css } from './styles.js'

function Icon({ children, size = 22 }) {
  return React.createElement('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': 'true',
  }, children)
}

const stroke = { stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round' }

/** Per-entry line icons; fill comes from the card accent color. */
export const ENTRY_ICONS = {
  dailyReport: React.createElement(Icon, null,
    React.createElement('path', { d: 'M4 19V5', ...stroke }),
    React.createElement('path', { d: 'M8 19v-6', ...stroke }),
    React.createElement('path', { d: 'M12 19V9', ...stroke }),
    React.createElement('path', { d: 'M16 19v-4', ...stroke }),
    React.createElement('path', { d: 'M20 19V7', ...stroke }),
  ),
  topics: React.createElement(Icon, null,
    React.createElement('path', { d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z', ...stroke }),
    React.createElement('path', { d: 'M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z', ...stroke }),
  ),
  sentiment: React.createElement(Icon, null,
    React.createElement('path', { d: 'M12 20a8 8 0 1 0-8-8', ...stroke }),
    React.createElement('path', { d: 'M12 12l5.2-5.2', ...stroke }),
    React.createElement('circle', { cx: '12', cy: '12', r: '1.4', fill: 'currentColor' }),
  ),
  videoScript: React.createElement(Icon, null,
    React.createElement('rect', { x: '3.5', y: '6', width: '17', height: '12', rx: '2.5', ...stroke }),
    React.createElement('path', { d: 'M10 9.8v4.4L14.2 12 10 9.8z', fill: 'currentColor', stroke: 'none' }),
  ),
  videoDownload: React.createElement(Icon, null,
    React.createElement('path', { d: 'M12 4v10', ...stroke }),
    React.createElement('path', { d: 'M8.5 10.5L12 14l3.5-3.5', ...stroke }),
    React.createElement('path', { d: 'M5 18h14', ...stroke }),
  ),
  report: React.createElement(Icon, null,
    React.createElement('path', { d: 'M7 3.5h7.5L19 8v12.5H7V3.5z', ...stroke }),
    React.createElement('path', { d: 'M14.5 3.5V8H19', ...stroke }),
    React.createElement('path', { d: 'M10 12h6M10 15.5h4', ...stroke }),
  ),
  multiFormat: React.createElement(Icon, null,
    React.createElement('rect', { x: '4', y: '5', width: '12', height: '9', rx: '1.5', ...stroke }),
    React.createElement('path', { d: 'M8 16.5h10.5a1.5 1.5 0 0 0 1.5-1.5V8', ...stroke }),
    React.createElement('path', { d: 'M6 19.5h10.5a1.5 1.5 0 0 0 1.5-1.5v-2', ...stroke }),
  ),
  rumor: React.createElement(Icon, null,
    React.createElement('path', { d: 'M12 3.5l7 3v5.2c0 4.2-2.8 7.2-7 8.8-4.2-1.6-7-4.6-7-8.8V6.5l7-3z', ...stroke }),
    React.createElement('path', { d: 'M9.2 12.1l1.9 1.9 3.7-3.8', ...stroke }),
  ),
}

export const TASK_SUBTITLE = {
  topics: 'topics.subtitle',
  sentiment: 'sentiment.subtitle',
  videoScript: 'videoScript.subtitle',
  report: 'report.subtitle',
  multiFormat: 'multiFormat.subtitle',
  rumor: 'rumor.subtitle',
  dailyReport: 'daily.subtitle',
  videoDownload: 'video.subtitle',
}

/**
 * Shared task-page chrome: back pill, accent icon, title, task copy, tags.
 * @param props.entry - catalog entry when available (accent / tags / icon).
 */
export function PageChrome({ t, entry, title, subtitle, onBack, children }) {
  const accent = entry?.accent ?? '#3b82f6'
  const icon = entry ? ENTRY_ICONS[entry.id] : null
  return React.createElement('div', { className: css.wbRoot },
    React.createElement('div', { className: css.wbShell },
      React.createElement('header', { className: css.wbHeader, style: { '--be-accent': accent } },
        onBack !== undefined && React.createElement('button', {
          type: 'button',
          className: css.wbBack,
          onClick: onBack,
        }, `← ${t('workbench.back')}`),
        React.createElement('div', { className: css.wbTaskHead },
          icon !== null && React.createElement('span', {
            className: css.wbTaskIcon,
            'aria-hidden': 'true',
          }, icon),
          React.createElement('div', { className: css.wbTaskCopy },
            React.createElement('h1', { className: css.wbTitle }, title),
            React.createElement('p', { className: css.wbSubtitle }, subtitle),
            entry?.tags !== undefined && entry.tags.length > 0
              && React.createElement('div', { className: css.wbTaskTags },
                entry.tags.map(tag => React.createElement('span', {
                  key: tag,
                  className: css.wbTag,
                  style: { '--be-accent': accent },
                }, t(tag))),
              ),
          ),
        ),
      ),
      children,
    ),
  )
}

export function SearchIcon() {
  return React.createElement(Icon, { size: 18 },
    React.createElement('circle', { cx: '11', cy: '11', r: '6.5', ...stroke }),
    React.createElement('path', { d: 'M16.2 16.2L20 20', ...stroke }),
  )
}

export function SendIcon() {
  return React.createElement(Icon, { size: 18 },
    React.createElement('path', { d: 'M4 12l15-7-6.5 15-2.2-5.3L4 12z', ...stroke }),
  )
}
