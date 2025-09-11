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
    exec(`node ${cli} package eslint -r 8.57.1`, (_error, _stdout, stderr) => {
      const output = _stdout + stderr;
      const match = output.match(/minimum upgrade version[^\[]*\[([^\]]+)\]/);
      const expectedVersion = '9.11.0';
      const actualVersion = match ? match[1].replace(/\x1B\[[0-9;]*m/g, '').replace(/[0-9;]*m\n[[]/, '') : undefined;
      assert.strictEqual(actualVersion, expectedVersion, `Expected version: ${expectedVersion}, Actual version: ${actualVersion}`);
      assert.ok(/minimum upgrade version/.test(output), 'Expected minimum upgrade version to be mentioned.');
      done();
    })
  })
})

test('shows no-upgrade message when no upgrade available', async (t) => {
  await t.test('should display no-upgrade message', (_t, done) => {
    exec(`node ${cli} package vue-cli`, (_error, _stdout) => {
      const output = _stdout;
      assert.ok(/No upgrade available\./.test(output), 'Expected "No upgrade available." message to be mentioned.');
      done()
    })
  })
})