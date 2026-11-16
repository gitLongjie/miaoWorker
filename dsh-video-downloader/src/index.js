/**
 * dsh-video-downloader — media downloader for DeepSeek Harness.
 *
 * Ports the media-detection/parsing logic of the Chrome MV3 extension
 * (video-downloader-extension) OUT of the browser sandbox into pure Node
 * functions, exposed as three agent-callable tools:
 *
 *   - video_analyze       : classify a URL — is it media, which site, what
 *                           quality / container, and a mime hint.
 *   - video_quality_parse : pure regex quality + extension extraction.
 *   - video_download      : stream a media URL to disk with a browser-like
 *                           User-Agent, redirect following, and a 60s timeout.
 *
 * Pure ESM, zero build step — the published package is the runtime code.
 */

import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-video-downloader'
export const inject = ['tools']

// ---------------------------------------------------------------- pure core

// Media heuristics lifted verbatim from video-downloader-extension/background.js.
const MEDIA_EXT = /\.(mp4|m3u8|flv|webm|mkv|avi|mov|ts|f4v|mpd|m4s|mp3|wav|aac|ogg|opus|flac)(\?[^]*)?$/i
const MEDIA_URL = /videoplayback|manifest\.(mpd|m3u8)|\/flv\/|\.m3u8|\.mp4|bilivideo\.com|googlevideo\.com|xvideos\.com|pornhub\.com/i
const MEDIA_CT = /^video\/|^audio\/|application\/x-mpegURL|application\/dash\+xml|application\/vnd\.apple\.mpegurl|octet-stream/i

// Bilibili DASH quality-id → label map (background.js QUALITY_MAP).
const QUALITY_MAP = {
  127: '8K', 126: 'Dolby Atmos', 125: 'HDR', 120: '4K',
  116: '1080P60', 112: '1080P高码率', 80: '1080P', 74: '720P60',
  64: '720P', 48: '720P', 32: '480P', 16: '360P',
}

// Bilibili playurl label map (sites/bilibili.js `qm`).
const BILI_QUALITY = {
  127: '8K', 126: 'Dolby', 125: 'HDR', 120: '4K', 116: '1080P60', 112: '1080P+',
  80: '1080P', 74: '720P60', 64: '720P', 48: '480P', 32: '360P', 16: '360P',
}

const EXT_MIME = {
  mp4: 'video/mp4', m3u8: 'application/x-mpegURL', mpd: 'application/dash+xml',
  flv: 'video/x-flv', webm: 'video/webm', mkv: 'video/x-matroska',
  avi: 'video/x-msvideo', mov: 'video/quicktime', ts: 'video/mp2t',
  f4v: 'video/x-f4v', m4s: 'video/iso.segment',
  mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg',
  opus: 'audio/ogg', flac: 'audio/flac',
}

const mimeHintOf = (ext) => EXT_MIME[ext] || 'application/octet-stream'

/** True when the URL (and optional content-type) looks like downloadable media. */
export function isMedia(url, ct) {
  if (ct && MEDIA_CT.test(ct)) return true
  if (MEDIA_EXT.test(url)) return true
  if (MEDIA_URL.test(url)) return true
  return false
}

/**
 * Best-effort quality label from a URL: WxH dimensions, height/h/quality
 * query params, bitrate thresholds, then raw keyword matches and container.
 * (Original background.js read the bitrate group index as the param name —
 * lifted as-is but with that index bug fixed to m[2].)
 */
export function getQuality(url) {
  let m = url.match(/(\d{3,4})x(\d{3,4})/)
  if (m) return m[2] + 'P'
  m = url.match(/[?&](height|h|resolution|quality)=(\d{3,4})/i)
  if (m) return m[2] + 'P'
  m = url.match(/[?&](bitrate|br)=(\d+)/i)
  if (m) {
    const br = parseInt(m[2], 10)
    if (br > 8000000) return '4K'
    if (br > 5000000) return '1080P'
    if (br > 2000000) return '720P'
    if (br > 800000) return '480P'
    return '360P'
  }
  if (/2160|4k/i.test(url)) return '4K'
  if (/1080/i.test(url)) return '1080P'
  if (/720/i.test(url)) return '720P'
  if (/480/i.test(url)) return '480P'
  if (/360/i.test(url)) return '360P'
  if (url.includes('.m3u8')) return 'HLS'
  if (url.includes('.mpd')) return 'DASH'
  if (url.includes('.m4s')) return 'M4S'
  if (url.includes('.flv')) return 'FLV'
  return ''
}

/** Container extension for a URL (optionally refined by content-type). */
export function getExt(url, ct) {
  if (url.includes('.m3u8')) return 'm3u8'
  if (url.includes('.mpd')) return 'mpd'
  if (url.includes('.flv')) return 'flv'
  if (url.includes('.m4s')) return 'm4s'
  if (url.includes('.ts')) return 'ts'
  if (ct && ct.includes('webm')) return 'webm'
  return 'mp4'
}

/**
 * Which supported site a URL belongs to (by hostname). Covers the share-link
 * shorteners too: youtu.be, iesdouyin.com, xhslink.com.
 */
export function detectSite(url) {
  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch {
    hostname = String(url).split(/[/?#]/)[0]
  }
  if (hostname.includes('bilibili.com')) return 'bilibili'
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
  if (hostname.includes('douyin.com') || hostname.includes('iesdouyin.com')) return 'douyin'
  if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) return 'xiaohongshu'
  return 'other'
}

/** One-line classification used by `video_analyze`. */
export function analyze(url) {
  const u = String(url)
  const ext = getExt(u)
  return {
    isMedia: isMedia(u),
    site: detectSite(u),
    quality: getQuality(u),
    ext,
    mimeHint: mimeHintOf(ext),
  }
}

// ------------------------------------------------- per-site parsers (pure)

/**
 * Bilibili playurl JSON (DASH or durl) → media URL list. Mirrors
 * sites/bilibili.js processJson/parseDash/parseDurl, but pure: takes a text
 * payload, returns an array of { url, quality, size, ext }.
 */
export function parseBilibiliJson(text) {
  const found = []
  let j
  try {
    j = JSON.parse(text)
  } catch {
    return found
  }
  if (j?.data?.dash) found.push(...parseBilibiliDash(j.data.dash))
  if (j?.data?.durl) found.push(...parseBilibiliDurl(j.data.durl))
  if (j?.result?.dash) found.push(...parseBilibiliDash(j.result.dash))
  if (j?.result?.durl) found.push(...parseBilibiliDurl(j.result.durl))
  return found
}

export function parseBilibiliDash(dash) {
  const out = []
  if (!dash) return out
  ;(dash.video || []).forEach((v) => {
    const u = v.baseUrl || v.base_url || v.backupUrl?.[0]
    if (u) out.push({ url: u, quality: BILI_QUALITY[v.id] || v.id + 'P', size: 0, ext: u.includes('.m4s') ? 'm4s' : 'mp4' })
  })
  ;(dash.audio || []).forEach((a, i) => {
    const u = a.baseUrl || a.base_url || a.backupUrl?.[0]
    if (u) out.push({ url: u, quality: '音频' + (i + 1), size: 0, ext: u.includes('.m4s') ? 'm4s' : 'mp4' })
  })
  return out
}

export function parseBilibiliDurl(durl) {
  const out = []
  if (!Array.isArray(durl)) return out
  durl.forEach((d, i) => {
    if (d.url) out.push({ url: d.url, quality: '分段' + (i + 1), size: d.size || 0, ext: 'mp4' })
  })
  return out
}

/** YouTube player response → media URLs (sites/youtube.js parseStreaming). */
export function parseYoutubeStreaming(data) {
  const out = []
  const fmts = [...(data?.streamingData?.formats || []), ...(data?.streamingData?.adaptiveFormats || [])]
  fmts.forEach((f) => {
    if (f.url) out.push({ url: f.url, quality: f.qualityLabel || f.quality || '', size: 0, ext: 'mp4' })
  })
  return out
}

/**
 * Bare mp4/m3u8 URLs embedded in page text (sites/douyin.js + xiaohongshu.js),
 * unescaping `\u002F` as the content scripts did.
 */
export function extractMediaUrls(text, pattern = /https?:\/\/[^"'\s]*\.(m3u8|mp4)[^"'\s]*/g) {
  const urls = String(text).match(pattern)
  if (!urls) return []
  return [...new Set(urls.map((u) => u.replace(/\\u002F/g, '/')))]
}

// ---------------------------------------------------------------- download

const DOWNLOAD_TIMEOUT_MS = 60_000
const MAX_REDIRECTS = 5
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export function sanitizeName(s) {
  return String(s).replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'media'
}

export function defaultFileName(url, ext) {
  let base = ''
  try {
    const last = decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean).pop() || ''
    base = sanitizeName(last.replace(/\.[a-z0-9]+$/i, ''))
  } catch {
    // malformed URL — fall through to the timestamped name
  }
  return `${base || 'media'}.${ext || 'mp4'}`
}

function resolveOutPath(url, ext, outPath) {
  if (outPath) return isAbsolute(outPath) ? outPath : resolve(process.cwd(), outPath)
  return join(process.cwd(), 'downloads', defaultFileName(url, ext))
}

function refererHeader(url) {
  try {
    return { Referer: new URL(url).origin + '/' }
  } catch {
    return {}
  }
}

/** Pipe a (node) readable stream to a file, resolving with the byte count. */
function streamToFile(stream, filePath) {
  return new Promise((resolve, reject) => {
    const ws = createWriteStream(filePath)
    let bytes = 0
    let settled = false
    const fail = (err) => {
      if (settled) return
      settled = true
      ws.destroy()
      reject(err)
    }
    ws.on('error', fail)
    stream.on('data', (c) => {
      bytes += c.length
    })
    stream.on('error', fail)
    stream.pipe(ws)
    ws.on('finish', () => {
      if (settled) return
      settled = true
      resolve(bytes)
    })
  })
}

/** Global fetch pipeline: manual redirect loop (≤5) then stream to file. */
async function fetchStreamToFile(url, filePath, headers, signal) {
  let current = url
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(current, { headers, signal, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (loc) {
        current = new URL(loc, current).toString()
        continue
      }
      throw new Error(`HTTP ${res.status} redirect without Location for ${current}`)
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${current}`)
    if (!res.body) throw new Error(`empty response body for ${current}`)
    return streamToFile(Readable.fromWeb(res.body), filePath)
  }
  throw new Error(`too many redirects (max ${MAX_REDIRECTS})`)
}

/** node:https fallback for runtimes without a global fetch (same contract). */
async function httpsStreamToFile(url, filePath, headers, signal) {
  const { request } = await import('node:https')
  let current = new URL(url)
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await new Promise((resolve, reject) => {
      const req = request(current, { method: 'GET', headers, signal }, resolve)
      req.on('error', reject)
    })
    if (res.statusCode >= 300 && res.statusCode < 400) {
      const loc = res.headers.location
      res.resume()
      if (loc) {
        current = new URL(loc, current)
        continue
      }
      throw new Error(`HTTP ${res.statusCode} redirect without Location`)
    }
    if (res.statusCode >= 400) {
      res.resume()
      throw new Error(`HTTP ${res.statusCode} ${res.statusMessage} for ${current.href}`)
    }
    return streamToFile(res, filePath)
  }
  throw new Error(`too many redirects (max ${MAX_REDIRECTS})`)
}

/**
 * Download a media URL to disk with a browser-like User-Agent.
 *
 * @param {string} url the media URL (mp4/m3u8/mpd/...).
 * @param {object} [options]
 *   - outPath: absolute or cwd-relative destination; default
 *     ./downloads/<sanitized-filename>.
 *   - headers: extra request headers merged over the browser defaults.
 *   - signal: optional AbortSignal (a 60s timeout is always enforced).
 * @returns {{ filePath: string, bytes: number, ext: string }}
 */
export async function downloadMedia(url, { outPath, headers = {}, signal } = {}) {
  const ext = getExt(url)
  const filePath = resolveOutPath(url, ext, outPath)
  mkdirSync(dirname(filePath), { recursive: true })

  const requestHeaders = {
    'User-Agent': BROWSER_UA,
    Accept: '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    ...refererHeader(url),
    ...headers,
  }

  const bytes =
    typeof fetch === 'function'
      ? await fetchStreamToFile(url, filePath, requestHeaders, signal)
      : await httpsStreamToFile(url, filePath, requestHeaders, signal)

  return { filePath, bytes, ext }
}

// ---------------------------------------------------------------- tools

const renderText = (_args, value) => [{ type: 'text', text: value }]

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'video_analyze',
    description:
      'Analyze a URL without downloading: is it media, which supported site it belongs to ' +
      '(bilibili/youtube/douyin/xiaohongshu/other), its likely quality, container extension, ' +
      'and a mime type hint. Pure analysis — never fetches the URL. Returns JSON ' +
      '{ isMedia, site, quality, ext, mimeHint }. Use this first to decide whether and how to download.',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL to analyze (page URL or direct media URL).' },
    },
    output: {
      schema: { type: 'string' },
      render: renderText,
    },
    async execute(args) {
      return JSON.stringify(analyze(args.url))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'video_download',
    description:
      'Download a media URL (mp4/m3u8/mpd/flv/m4s/webm/... and common audio) to disk. ' +
      'Streams with fs.createWriteStream, follows redirects (up to 5), sends a browser-like ' +
      'User-Agent + Referer, and enforces a 60s timeout (also aborted on execution cancel). ' +
      'Returns JSON { savedTo, bytes, quality, ext, elapsedMs }. Default destination is ' +
      './downloads/<sanitized-filename>. Only download content you have rights to.',
    parameters: {
      url: { type: 'string', required: true, description: 'Direct media URL to download.' },
      outPath: { type: 'string', description: 'Optional destination path (absolute or relative). Defaults to ./downloads/<sanitized-filename>.' },
      headers: { type: 'object', additionalProperties: true, description: 'Optional extra request headers merged over the browser-like defaults.' },
    },
    output: {
      schema: { type: 'string' },
      render: renderText,
    },
    async execute(args, exec) {
      const url = String(args.url)
      const started = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(
        () => controller.abort(new Error(`download timed out after ${DOWNLOAD_TIMEOUT_MS}ms`)),
        DOWNLOAD_TIMEOUT_MS,
      )
      const onOuterAbort = () => controller.abort(new Error('execution cancelled'))
      if (exec?.signal) {
        if (exec.signal.aborted) controller.abort(new Error('execution cancelled'))
        else exec.signal.addEventListener('abort', onOuterAbort, { once: true })
      }
      try {
        const { filePath, bytes, ext } = await downloadMedia(url, {
          outPath: args.outPath,
          headers: args.headers,
          signal: controller.signal,
        })
        return JSON.stringify({
          savedTo: filePath,
          bytes,
          quality: getQuality(url),
          ext,
          elapsedMs: Date.now() - started,
        })
      } finally {
        clearTimeout(timer)
        if (exec?.signal) exec.signal.removeEventListener('abort', onOuterAbort)
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'video_quality_parse',
    description:
      'Pure regex quality/extension analysis of a URL, no network access. Returns JSON ' +
      '{ quality, ext }. Quality is best-effort: dimensions, height/quality params, bitrate ' +
      'thresholds, keyword matches, then container (HLS/DASH/M4S/FLV).',
    parameters: {
      url: { type: 'string', required: true, description: 'The media URL to analyze.' },
    },
    output: {
      schema: { type: 'string' },
      render: renderText,
    },
    async execute(args) {
      const url = String(args.url)
      return JSON.stringify({ quality: getQuality(url), ext: getExt(url) })
    },
  }))
}
