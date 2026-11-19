/** The smoke harness must still publish when Windows will not delete the temp app copy. */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { removeSmokeCopy } from '../scripts/packaged-smoke.mjs'

const roots: string[] = []
const harness = fileURLToPath(new URL('../scripts/packaged-smoke.mjs', import.meta.url))
const mainEntry = fileURLToPath(new URL('../src/main/index.ts', import.meta.url))

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('packaged smoke cleanup', () => {
  it('deletes the outside copy', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-smoke-cleanup-'))
    roots.push(root)
    const copy = join(root, 'DSH Desktop copy')
    mkdirSync(copy)
    writeFileSync(join(copy, 'app.exe'), '')
    removeSmokeCopy(copy)
    expect(existsSync(copy)).toBe(false)
  })

  it('continues when the copy is still locked', () => {
    const lines: string[] = []
    const original = console.error
    console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')) }
    const locked = Object.assign(new Error('locked'), { code: 'EPERM' })
    try {
      removeSmokeCopy('C:\\locked copy', () => { throw locked })
    } finally {
      console.error = original
    }
    expect(lines).toEqual([
      'smoke copy cleanup failed (EPERM); the verdict and publish do not use this directory: C:\\locked copy',
    ])
  })

  it('retries the Windows file lock and skips the ComfyUI copy during smoke', () => {
    const source = readFileSync(harness, 'utf8')
    expect(source).toContain('maxRetries: 10')
    expect(source).toContain('taskkill')
    const main = readFileSync(mainEntry, 'utf8')
    expect(main).toContain("process.env.DSH_PACKAGED_SMOKE !== '1'")
  })
})
