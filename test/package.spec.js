/* eslint-disable no-control-regex */
import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { coerce, satisfies } from 'semver'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cli = path.resolve(__dirname, '../dist/cli.mjs')

test('package tests', async (t) => {
  await t.test('check that a deprecated package is detected', (_t, done) => {
    exec(`node ${cli} package request`, (_error, stdout, _stderr) => {
      assert.ok(stdout.match(/^\u001B\[93mDeprecated:/gim), 'Expected "Deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test('check that a non-deprecated package is not detected as deprecated', (_t, done) => {
    exec(`node ${cli} package eslint`, (_error, stdout, _stderr) => {
      assert.ok(!stdout.match(/^\u001B\[93mDeprecated:/gim), 'Not expected "Deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })
})

test('shows minimum upgrade version for deprecated package', async (t) => {
  await t.test('should display minimum upgrade version', (_t, done) => {
    exec(`node ${cli} package eslint -r 8.57.1`, (_error, stdout, _stderr) => {
      const match = stdout.match(/Minimum upgrade version[^[]*\[([^\]]+)\]/)
      const expectedVersion = '9.0.0-alpha.0'
      const actualVersion = match ? match[1].replace(/\x1B\[[0-9;]*m/g, '').replace(/[0-9;]*m\n\[/, '') : undefined
      assert.strictEqual(actualVersion, expectedVersion, `Expected version: ${expectedVersion}, Actual version: ${actualVersion}`)
      assert.ok(match, 'Expected minimum upgrade version to be mentioned.')
      done()
    })
  })
})

test('shows no-upgrade message when no upgrade available', async (t) => {
  await t.test('should display no-upgrade message', (_t, done) => {
    exec(`node ${cli} package vue-cli`, (_error, stdout) => {
      assert.ok(/no upgradable versions\./.test(stdout), 'Expected "no upgradable versions" message to be mentioned.')
      done()
    })
  })
})

test('engine requirements for Node versions', async (t) => {
  const currentNode = coerce(process.version)
  const requiredNode = '^18.18.0 || ^20.9.0 || >=21.1.0'
  if (satisfies(currentNode, requiredNode)) {
    await t.test('check that the current environment meets the Node.js version range required for eslint', (_t, done) => {
      exec(`node ${cli} package eslint -r 9.35.0`, (_error, stdout, _stderr) => {
        assert.ok(!/required node/.test(stdout), 'Not expected "required node" to be mentioned in deprecation warning.')
        done()
      })
    })
  }
  else {
    await t.test('check that the current environment doesn\'t meet the Node.js version range required for eslint', (_t, done) => {
      exec(`node ${cli} package eslint -r 9.35.0`, (_error, stdout, _stderr) => {
        assert.ok(/required node/.test(stdout), 'Expected "required node" to be mentioned in deprecation warning.')
        done()
      })
    })
  }
})
