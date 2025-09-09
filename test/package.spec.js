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

test('shows minimum upgrade version for deprecated package', async (t) => {
  await t.test('should display minimum upgrade version', (_t, done) => {
    exec(`node ${cli} package tslint`, (_error, _stdout, stderr) => {
      const output = _stdout + stderr;
      const match = output.match(/minimum upgrade version[^\[]*\[([^\]]+)\]/);
      // the latest non-deprecated version of tslint is 6.0.0-beta1 which is a beta version
      // 39m\n[\x1B[35m is part of the ANSI color codes added by the CLI output
      // so we include it in the expected version to match exactly what is output
      const expectedVersion = '39m\n[\x1B[35m6.0.0-beta1\x1B[39m';
      const actualVersion = match ? match[1] : undefined;
      assert.strictEqual(actualVersion, expectedVersion, `Expected version: ${expectedVersion}, Actual version: ${actualVersion}`);
      assert.ok(/minimum upgrade version/.test(output), 'Expected minimum upgrade version to be mentioned.')
      done()
    })
  })
})

test('shows all-deprecated message when no upgrade available', async (t) => {
  await t.test('should display all-deprecated message', (_t, done) => {
    exec(`node ${cli} package vue-cli`, (_error, _stdout, stderr) => {
      assert.ok(/All available versions are deprecated/.test(_stdout), 'Expected all-deprecated message to be mentioned.')
      done()
    })
  })
})

test('does not show all-deprecated message when upgrade is available', async (t) => {
  await t.test('should not display all-deprecated message', (_t, done) => {
    exec(`node ${cli} package tslint`, (_error, _stdout, stderr) => {
      assert.ok(!/All available versions are deprecated/.test(_stdout + stderr), 'Not expected all-deprecated message to be mentioned.')
      done()
    })
  })
})