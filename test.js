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

test('current tests', async (t) => {
  await t.test('check if no deprecation warning is shown', (_t, done) => {
    exec('node ./dist/cli.mjs current', (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test('check if deprecation warning is shown if deprecated package is installed', (_t, done) => {
    exec('pnpm i request --force && node ./dist/cli.mjs current', { timeout: 160000 }, (_error, _stdout, stderr) => {
      assert.ok(/request has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      // Cleanup: Undo the installation
      exec('pnpm remove request')
      done()
    })
  })

  await t.test('check if no deprecation warning is shown if ignore deprecated package', (_t, done) => {
    exec('pnpm i request --force && node ./dist/cli.mjs current --ignore request', { timeout: 160000 }, (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      // Cleanup: Undo the installation
      exec('pnpm remove request')
      done()
    })
  })

  await t.test('check if exit the program if the package is deprecated', (_t, done) => {
    exec('pnpm i request tslint --force && node ./dist/cli.mjs current --failfast', { timeout: 160000 }, (_error, _stdout, stderr) => {
      assert.ok(/request has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      assert.ok(!/tslint has been deprecated/.test(stderr), 'Expected process.exit(1), only "request has been deprecated".')
      // Cleanup: Undo the installation
      exec('pnpm remove request tslint')
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

  await t.test('check if no deprecation warning is shown if ignore deprecated package', (_t, done) => {
    exec('pnpm i request --force -g && node ./dist/cli.mjs global --manager pnpm --ignore request', { timeout: 160000 }, (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      // Cleanup: Undo the installation
      exec('pnpm remove request -g')
      done()
    })
  })
})

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
