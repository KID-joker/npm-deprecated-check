import assert from 'node:assert/strict'
import { exec as execCallback } from 'node:child_process'
import process from 'node:process'
import { test } from 'node:test'
import { promisify } from 'node:util'

const exec = promisify(execCallback)

test('current tests', async (t) => {
  await t.test('check if no deprecation warning is shown', (_t, done) => {
    exec('node ./dist/cli.mjs current', (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  if (!process.version.startsWith('v16')) {
    // Skip this test on Node.js v16 because I can't get it to work
    await t.test('check if deprecation warning is shown if deprecated package is installed', async (_t) => {
      const { stderr } = await exec('npx pnpm i request && node ./dist/cli.mjs current', { timeout: 160000 })
      assert.ok(/request has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      // Cleanup: Undo the installation
      await exec('pnpm remove request')
    })
  }

  await t.test('check if node version is mentioned in output', (_t, done) => {
    exec('node ./dist/cli.mjs current', (_error, stdout, stderr) => {
      assert.ok(/node version/.test(stdout) || /node version/.test(stderr), 'Expected "node version" to be mentioned in output.')
      done()
    })
  })
})

test('global tests', async (t) => {
  await t.test('check if no deprecation warning is shown', (_t, done) => {
    exec('node ./dist/cli.mjs global', (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })
})

test('package tests', async (t) => {
  await t.test('check if deprecated package gets detected', (t, done) => {
    exec('node ./dist/cli.mjs package request', (_error, _stdout, stderr) => {
      assert.ok(/has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test('check if not deprecated package does not get detected as deprecated', (t, done) => {
    exec('node ./dist/cli.mjs package eslint', (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })
})

test('config tests', async (t) => {
  await t.test('check config --list', (_t, done) => {
    exec('node ./dist/cli.mjs config -- --list', (_error, stdout, _stderr) => {
      assert.ok(/inspect and modify the config/.test(stdout), 'Expected "inspect and modify the config" to be mentioned in config list.')
      done()
    })
  })
})

test('help tests', async (t) => {
  await t.test('check help', (_t, done) => {
    exec('node ./dist/cli.mjs help', (_error, stdout, _stderr) => {
      assert.ok(/display help for command/.test(stdout), 'Expected "display help for command" to be mentioned in help.')
      done()
    })
  })
})
