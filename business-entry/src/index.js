/**
 * Host entry for business-entry: Connection Fetch routes that call
 * dsh-video-downloader's pure core so the workbench UI can download without
 * starting an Agent Session.
 *
 * No package-level `inject`. Desktop boots this plugin from a root-plane
 * overlay insert; a hard `inject: ['connection']` there waits forever (the
 * provider lives deeper in the web profile) and hangs packaged smoke before
 * any verdict is written. Nested `ctx.inject` keeps the entry ACTIVE and
 * registers the routes once `connection` appears in scope.
 */
import {
  ANALYZE_PATH,
  DOWNLOAD_PATH,
  handleAnalyze,
  handleDownload,
  jsonResponse,
} from './video-routes.js'

export const name = '@xmanrui/dsh-business-entry'

/**
 * @param ctx - Cordis context; Fetch routes wait for nested `connection`.
 */
export function apply(ctx) {
  ctx.inject(['connection'], (scope) => {
    scope.effect(() => scope.connection.fetch.register({
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

    scope.effect(() => scope.connection.fetch.register({
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
  })
}
