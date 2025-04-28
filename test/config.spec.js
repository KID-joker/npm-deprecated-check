import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import { test } from 'node:test'

test('config tests', async (t) => {
  await t.test('check config --list', (_t, done) => {
    exec('node ./dist/cli.mjs config -- --list', (_error, stdout, _stderr) => {
      assert.ok(/inspect and modify the config/.test(stdout), 'Expected "inspect and modify the config" to be mentioned in config list.')
      done()
    })
  })
})
