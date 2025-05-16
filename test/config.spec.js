import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cli = path.resolve(__dirname, '../dist/cli.mjs')

test('config tests', async (t) => {
  await t.test('check config', (_t, done) => {
    exec(`node ${cli} config`, (_error, stdout, _stderr) => {
      assert.ok(/inspect and modify the config/.test(stdout), 'Expected "inspect and modify the config" to be mentioned in config list.')
      done()
    })
  })
})
