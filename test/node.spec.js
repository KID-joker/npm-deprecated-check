import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import { test } from 'node:test'

test('node tests', async (t) => {
  await t.test('test node version deprecation check', (_t, done) => {
    exec('node ./dist/cli.mjs node', (_error, stdout, stderr) => {
      assert.ok(/node version/.test(stdout) || /node version/.test(stderr), 'Expected "node version" to be mentioned in output.')
      done()
    })
  })
})
