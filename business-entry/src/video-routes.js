/**
 * Host helpers for business-entry video download Fetch routes.
 * Download destinations stay under a fixed root; callers never pass absolute paths.
 */
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'

export const ANALYZE_PATH = '/api/business/video/analyze'
export const DOWNLOAD_PATH = '/api/business/video/download'

/**
 * Root directory for workbench downloads: `$DSH_HOME/business-downloads`.
 * @returns absolute downloads root.
 */
export function downloadsRoot() {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return resolve(home, 'business-downloads')
}

/**
 * Resolve a client-supplied optional file name into a path under the downloads root.
 * Rejects empty, traversal, or absolute inputs.
 * @param fileName - optional basename (extension optional).
 * @param fallbackExt - extension used when the name has none (from analyze/download).
 * @param sanitizeName - downloader sanitizer.
 * @param defaultFileName - downloader default name builder.
 * @param url - media URL used when fileName is omitted.
 * @returns absolute outPath under downloadsRoot, or undefined when invalid.
 */
export function resolveDownloadPath(fileName, fallbackExt, sanitizeName, defaultFileName, url) {
  const root = downloadsRoot()
  const ext = fallbackExt || 'mp4'
  let base
  if (typeof fileName === 'string' && fileName.trim() !== '') {
    const trimmed = fileName.trim().replace(/\\/g, '/')
    if (trimmed.includes('/') || trimmed.includes('..')) return undefined
    base = sanitizeName(trimmed.replace(/\.[a-z0-9]+$/i, ''))
    if (!base) return undefined
    const hasExt = /\.[a-z0-9]+$/i.test(trimmed)
    base = hasExt ? `${base}${trimmed.slice(trimmed.lastIndexOf('.'))}` : `${base}.${ext}`
  } else {
    base = defaultFileName(url, ext)
  }
  const outPath = resolve(root, base)
  const rootWithSep = root.endsWith(sep) ? root : root + sep
  if (outPath !== root && !outPath.startsWith(rootWithSep)) return undefined
  return outPath
}

/**
 * @param body - unknown JSON body.
 * @returns true when body is a plain object.
 */
export function isRecord(body) {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
}

/**
 * Build a JSON Response.
 * @param value - JSON-serializable body.
 * @param status - HTTP status.
 */
export function jsonResponse(value, status = 200) {
  return new Response(`${JSON.stringify(value)}\n`, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/**
 * Handle analyze: classify a URL without downloading.
 * @param body - request JSON.
 * @param analyze - downloader analyze(url).
 */
export function handleAnalyze(body, analyze) {
  if (!isRecord(body) || typeof body.url !== 'string' || body.url.trim() === '') {
    return jsonResponse({ error: 'url is required' }, 400)
  }
  const url = body.url.trim()
  try {
    return jsonResponse(analyze(url))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: message }, 400)
  }
}

/**
 * Handle download: stream media into the sandboxed downloads directory.
 * @param body - request JSON `{ url, fileName? }`.
 * @param deps - downloader pure functions + downloadMedia.
 * @param signal - abort signal from the request.
 */
export async function handleDownload(body, deps, signal) {
  if (!isRecord(body) || typeof body.url !== 'string' || body.url.trim() === '') {
    return jsonResponse({ error: 'url is required' }, 400)
  }
  const url = body.url.trim()
  const fileName = typeof body.fileName === 'string' ? body.fileName : undefined
  const analysis = deps.analyze(url)
  if (!analysis.isMedia) {
    return jsonResponse({
      error: 'url does not look like a direct media link; paste an mp4/m3u8/m4s (or similar) URL',
      analysis,
    }, 400)
  }
  const outPath = resolveDownloadPath(
    fileName,
    analysis.ext,
    deps.sanitizeName,
    deps.defaultFileName,
    url,
  )
  if (outPath === undefined) {
    return jsonResponse({ error: 'invalid fileName' }, 400)
  }
  const started = Date.now()
  try {
    const { filePath, bytes, ext } = await deps.downloadMedia(url, { outPath, signal })
    return jsonResponse({
      savedTo: filePath,
      bytes,
      quality: analysis.quality,
      ext,
      site: analysis.site,
      elapsedMs: Date.now() - started,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const aborted = signal?.aborted === true
      || (error instanceof Error && /cancel|abort|timed out/i.test(error.message))
    return jsonResponse({ error: message }, aborted ? 499 : 502)
  }
}
