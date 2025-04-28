import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import { test } from 'node:test'

test('help tests', async (t) => {
  await t.test('check help', (_t, done) => {
    exec('node ./dist/cli.mjs help', (_error, stdout, _stderr) => {
      assert.ok(/display help for command/.test(stdout), 'Expected "display help for command" to be mentioned in help.')
      done()
    })
  })
})
