/**
 * Build the OEM file: plugins that ship beside Desktop but are not part of the
 * workspace `build:artifacts` graph. Official packaging copies these packages
 * through electron-builder's production dependency closure; a clean checkout
 * has no `lib/`, so this step must run before electron-builder.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(appRoot, '../..')

const plugins = [
  {
    name: '@xmanrui/dsh-im',
    root: resolve(repoRoot, 'dsh-im', 'dsh-im-main'),
    build: ['npm', ['run', 'build']],
    artifact: 'lib/index.js',
  },
  {
    name: '@xmanrui/dsh-business-entry',
    root: resolve(repoRoot, 'business-entry'),
    build: ['node', ['build.mjs']],
    artifact: 'lib/index.js',
  },
  {
    name: 'dsh-video-downloader',
    root: resolve(repoRoot, 'dsh-video-downloader'),
    build: undefined,
    artifact: 'src/index.js',
  },
]

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

for (const plugin of plugins) {
  if (!existsSync(plugin.root)) {
    throw new Error(`desktop oem plugins: missing ${plugin.name} at ${plugin.root}`)
  }
  if (plugin.build !== undefined) {
    process.stdout.write(`desktop oem plugins: building ${plugin.name}\n`)
    run(plugin.build[0], plugin.build[1], plugin.root)
  }
  const artifact = resolve(plugin.root, plugin.artifact)
  if (!existsSync(artifact)) {
    throw new Error(`desktop oem plugins: ${plugin.name} missing ${plugin.artifact}`)
  }
}

process.stdout.write('desktop oem plugins: ready\n')
