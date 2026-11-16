/**
 * Host entry for business-entry: Connection Fetch routes that call
 * dsh-video-downloader's pure core so the workbench UI can download without
 * starting an Agent Session.
 */
import {
  ANALYZE_PATH,
  DOWNLOAD_PATH,
  handleAnalyze,
  handleDownload,
  jsonResponse,
} from './video-routes.js'

export const name = '@xmanrui/dsh-business-entry'
export const inject = ['connection']

/**
 * @param ctx - Cordis context with Host `connection`.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({
    path: ANALYZE_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let body
      try {
        body = await request.json()
      } catch {
        return jsonResponse({ error: 'invalid JSON body' }, 400)
      }
      try {
        const { analyze } = await import('dsh-video-downloader')
        return handleAnalyze(body, analyze)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return jsonResponse({ error: `video downloader unavailable: ${message}` }, 503)
      }
    },
  }), 'business-entry: video analyze')

  ctx.effect(() => ctx.connection.fetch.register({
    path: DOWNLOAD_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let body
      try {
        body = await request.json()
      } catch {
        return jsonResponse({ error: 'invalid JSON body' }, 400)
      }
      let deps
      try {
        deps = await import('dsh-video-downloader')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return jsonResponse({ error: `video downloader unavailable: ${message}` }, 503)
      }
      return handleDownload(body, deps, request.signal)
    },
  }), 'business-entry: video download')
}
