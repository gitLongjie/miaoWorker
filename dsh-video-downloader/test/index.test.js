import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  apply,
  isMedia,
  getQuality,
  getExt,
  detectSite,
  analyze,
} from '../src/index.js'

// A minimal ctx so the tools can be registered and executed headlessly
// (the tools under test are pure — no network calls happen).
function mockCtx() {
  const tools = []
  return {
    tools: {
      register(t) {
        tools.push(t)
      },
    },
    get(name) {
      return tools.find((t) => t.name === name)
    },
  }
}

test('isMedia detects mp4 and bilivideo m4s, rejects plain pages', () => {
  assert.equal(isMedia('https://example.com/video.mp4'), true)
  assert.equal(isMedia('https://bilivideo.com/foo.m4s'), true)
  assert.equal(isMedia('https://example.com/page'), false)
})

test('getQuality extracts 1080P from height param and 4K from high bitrate', () => {
  assert.equal(getQuality('https://example.com/video.mp4?height=1080&foo=bar'), '1080P')
  assert.equal(getQuality('https://example.com/video.mp4?bitrate=9000000'), '4K')
})

test('getExt returns m3u8 for .m3u8 URLs and mpd for .mpd URLs', () => {
  assert.equal(getExt('https://example.com/stream/master.m3u8'), 'm3u8')
  assert.equal(getExt('https://example.com/stream/manifest.mpd'), 'mpd')
})

test('detectSite identifies the four supported hosts', () => {
  assert.equal(detectSite('https://www.bilibili.com/video/BV1xx411c7mD'), 'bilibili')
  assert.equal(detectSite('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube')
  assert.equal(detectSite('https://www.douyin.com/video/123'), 'douyin')
  assert.equal(detectSite('https://www.xiaohongshu.com/explore/abc'), 'xiaohongshu')
  assert.equal(detectSite('https://example.com/page'), 'other')
})

test('video_quality_parse returns { quality: "720P", ext: "mp4" } for a sample URL', async () => {
  const ctx = mockCtx()
  apply(ctx)
  const tool = ctx.get('video_quality_parse')
  assert.ok(tool, 'video_quality_parse tool registered')
  const out = await tool.execute({ url: 'https://example.com/video.mp4?height=720' })
  assert.deepEqual(JSON.parse(out), { quality: '720P', ext: 'mp4' })
})

test('video_analyze tool reports media + site + mime hint', async () => {
  const ctx = mockCtx()
  apply(ctx)
  const tool = ctx.get('video_analyze')
  assert.ok(tool, 'video_analyze tool registered')
  const out = JSON.parse(await tool.execute({ url: 'https://bilivideo.com/foo.m4s' }))
  assert.equal(out.isMedia, true)
  assert.equal(out.site, 'other') // bilivideo.com CDN host is not the bilibili site page
  assert.equal(out.ext, 'm4s')
  assert.equal(out.mimeHint, 'video/iso.segment')
})

test('analyze marks a plain page as non-media', () => {
  assert.equal(analyze('https://example.com/page').isMedia, false)
})
