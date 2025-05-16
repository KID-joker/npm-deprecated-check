import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cli = path.resolve(__dirname, '../dist/cli.mjs')

test('node tests', async (t) => {
  await t.test('test node version deprecation check', (_t, done) => {
    exec(`node ${cli} node`, (_error, stdout, stderr) => {
      assert.ok(/node version/.test(stdout) || /node version/.test(stderr), 'Expected "node version" to be mentioned in output.')
      done()
    })
  })
})
