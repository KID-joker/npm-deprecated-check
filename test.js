/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import { test } from 'node:test'

console.log('Running tests...')

test('current tests', async (t) => {
  await t.todo('check if deprecation warning is shown', (_t, done) => {
    exec('npm i request && npm run dev current', { timeout: 60000 }, (_error, _stdout, stderr) => {
      assert.ok(/has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test('check if no deprecation warning is shown', (_t, done) => {
    exec('npm run dev current', (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test('check if node version is mentioned in output', (_t, done) => {
    exec('npm run dev current', (_error, stdout, _stderr) => {
      assert.ok(/node version/.test(stdout), 'Expected "node version" to be mentioned in output.')
      done()
    })
  })
})

test('global tests', async (t) => {
  await t.test('check if no deprecation warning is shown', (_t, done) => {
    exec('npm run dev global', (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })
})

test('package tests', async (t) => {
  await t.test('check if deprecated package gets detected', (t, done) => {
    exec('npm run dev package request', (_error, _stdout, stderr) => {
      assert.ok(/has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test('check if not deprecated package does not get detected as deprecated', (t, done) => {
    exec('npm run dev package eslint', (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })
})

test('config tests', async (t) => {
  await t.test('check config --list', (_t, done) => {
    exec('npm run dev config -- --list', (_error, stdout, _stderr) => {
      assert.ok(/latestVersion/.test(stdout), 'Expected "latestVersion" to be mentioned in config list.')
      done()
    })
  })
})

test('help tests', async (t) => {
  await t.test('check help', (_t, done) => {
    exec('npm run dev help', (_error, stdout, _stderr) => {
      assert.ok(/display help for command/.test(stdout), 'Expected "display help for command" to be mentioned in help.')
      done()
    })
  })
})
