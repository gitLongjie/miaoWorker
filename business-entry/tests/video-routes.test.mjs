/**
 * Host video-route helpers: path sandboxing and analyze/download handlers
 * without real network I/O.
 */
import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, test } from 'node:test'
import {
  downloadsRoot,
  handleAnalyze,
  handleDownload,
  resolveDownloadPath,
} from '../src/video-routes.js'

const previousHome = process.env.DSH_HOME

afterEach(() => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
})

const sanitizeName = (s) => String(s).replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'media'
const defaultFileName = (url, ext) => `media.${ext || 'mp4'}`

test('downloadsRoot uses DSH_HOME/business-downloads', () => {
  process.env.DSH_HOME = 'F:\\tmp\\dsh-home-fixture'
  assert.equal(downloadsRoot(), resolve('F:\\tmp\\dsh-home-fixture', 'business-downloads'))
})

test('downloadsRoot falls back to ~/.dsh when DSH_HOME is unset', () => {
  delete process.env.DSH_HOME
  assert.equal(downloadsRoot(), resolve(homedir(), '.dsh', 'business-downloads'))
})

test('resolveDownloadPath rejects traversal and absolute names', () => {
  process.env.DSH_HOME = join(homedir(), '.dsh-video-test-home')
  assert.equal(
    resolveDownloadPath('../etc/passwd', 'mp4', sanitizeName, defaultFileName, 'https://x/a.mp4'),
    undefined,
  )
  assert.equal(
    resolveDownloadPath('sub/dir.mp4', 'mp4', sanitizeName, defaultFileName, 'https://x/a.mp4'),
    undefined,
  )
  const ok = resolveDownloadPath('clip', 'mp4', sanitizeName, defaultFileName, 'https://x/a.mp4')
  assert.equal(ok, resolve(downloadsRoot(), 'clip.mp4'))
})

test('handleAnalyze requires url and returns analyze payload', async () => {
  const bad = handleAnalyze({}, (url) => ({ url, isMedia: false }))
  assert.equal(bad.status, 400)
  const good = handleAnalyze(
    { url: 'https://example.com/a.mp4' },
    () => ({ isMedia: true, site: 'other', quality: '1080P', ext: 'mp4', mimeHint: 'video/mp4' }),
  )
  assert.equal(good.status, 200)
  const body = JSON.parse(await good.text())
  assert.equal(body.isMedia, true)
  assert.equal(body.ext, 'mp4')
})

test('handleDownload refuses non-media URLs and accepts a mocked stream', async () => {
  process.env.DSH_HOME = join(homedir(), '.dsh-video-test-home')
  const refused = await handleDownload(
    { url: 'https://www.bilibili.com/video/BV1xx' },
    {
      analyze: () => ({ isMedia: false, site: 'bilibili', quality: '', ext: 'mp4', mimeHint: 'video/mp4' }),
      sanitizeName,
      defaultFileName,
      downloadMedia: async () => { throw new Error('should not run') },
    },
  )
  assert.equal(refused.status, 400)

  const saved = resolve(downloadsRoot(), 'clip.mp4')
  const ok = await handleDownload(
    { url: 'https://cdn.example.com/clip.mp4', fileName: 'clip.mp4' },
    {
      analyze: () => ({ isMedia: true, site: 'other', quality: '720P', ext: 'mp4', mimeHint: 'video/mp4' }),
      sanitizeName,
      defaultFileName,
      downloadMedia: async (url, { outPath }) => {
        assert.equal(url, 'https://cdn.example.com/clip.mp4')
        assert.equal(outPath, saved)
        return { filePath: outPath, bytes: 42, ext: 'mp4' }
      },
    },
  )
  assert.equal(ok.status, 200)
  const body = JSON.parse(await ok.text())
  assert.equal(body.savedTo, saved)
  assert.equal(body.bytes, 42)
  assert.equal(body.quality, '720P')
})

test('launchForm ignores direct catalog entries', async () => {
  const { BUSINESS_ENTRIES } = await import('../src/entries.js')
  const direct = BUSINESS_ENTRIES.find(entry => entry.id === 'videoDownload')
  assert.equal(direct?.kind, 'direct')
  assert.equal(direct.prompt, undefined)
})
