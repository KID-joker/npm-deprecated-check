import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cli = path.resolve(__dirname, '../dist/cli.mjs')

test('package tests', async (t) => {
  await t.test('check that a deprecated package is detected', (_t, done) => {
    exec(`node ${cli} package request`, (_error, _stdout, stderr) => {
      assert.ok(/has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test('check that a non-deprecated package is not detected as deprecated', (_t, done) => {
    exec(`node ${cli} package eslint`, (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })
})
