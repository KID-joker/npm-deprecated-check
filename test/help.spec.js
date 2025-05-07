import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cli = path.resolve(__dirname, '../dist/cli.mjs')

test('help tests', async (t) => {
  await t.test('check help', (_t, done) => {
    exec(`node ${cli} help`, (_error, stdout, _stderr) => {
      assert.ok(/display help for command/.test(stdout), 'Expected "display help for command" to be mentioned in help.')
      done()
    })
  })
})
