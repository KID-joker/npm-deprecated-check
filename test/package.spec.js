import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import { test } from 'node:test'

test('package tests', async (t) => {
  await t.test('check if deprecated package gets detected', (_t, done) => {
    exec('node ./dist/cli.mjs package request', (_error, _stdout, stderr) => {
      assert.ok(/has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test('check if not deprecated package does not get detected as deprecated', (_t, done) => {
    exec('node ./dist/cli.mjs package eslint', (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })
})
