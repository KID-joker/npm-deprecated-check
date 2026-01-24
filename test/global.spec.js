/* eslint-disable no-control-regex */
import assert from 'node:assert/strict'
import { exec, execSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cli = path.resolve(__dirname, '../dist/cli.mjs')

const managers = ['npm', 'yarn', 'pnpm']
const installCommands = {
  npm: 'npm i -g --force',
  yarn: 'yarn global add --force',
  pnpm: 'pnpm add -g --force',
}
const uninstallCommands = {
  npm: 'npm un -g',
  yarn: 'yarn global remove',
  pnpm: 'pnpm remove -g',
}

const deprecatedRegex = /^\u001B\[93mDeprecated:/gm

async function check(manager, t) {
  try {
    // Cleanup before tests to ensure clean state
    try {
      execSync(`${uninstallCommands[manager]} eslint tslint vue-cli`, { stdio: 'ignore' })
    }
    catch {}

    execSync(`${installCommands[manager]} eslint`)

    await t.test(`check ${manager} that no deprecation warning is shown`, (_t, done) => {
      exec(`node ${cli} global --manager ${manager}`, (_error, stdout, _stderr) => {
        assert.doesNotMatch(stdout, deprecatedRegex, 'Not expected "deprecated" to be mentioned in deprecation warning.')
        done()
      })
    })

    execSync(`${installCommands[manager]} tslint vue-cli`)

    await t.test(`check ${manager} that deprecation warning is shown if deprecated package is installed`, (_t, done) => {
      exec(`node ${cli} global --manager ${manager}`, { timeout: 160000 }, (_error, stdout, _stderr) => {
        assert.match(stdout, deprecatedRegex, 'Expected "deprecated" to be mentioned in deprecation warning.')
        done()
      })
    })

    await t.test(`check ${manager} that no deprecation warning is shown if ignore deprecated package`, (_t, done) => {
      exec(`node ${cli} global --manager ${manager} --ignore request,tslint,vue-cli`, { timeout: 160000 }, (_error, stdout, _stderr) => {
        assert.doesNotMatch(stdout, deprecatedRegex, 'Not expected "deprecated" to be mentioned in deprecation warning.')
        done()
      })
    })

    await t.test(`check ${manager} that exit the program if the package is deprecated`, (_t, done) => {
      exec(`node ${cli} global --manager ${manager} --failfast`, { timeout: 160000 }, (error, stdout, _stderr) => {
        const deprecatedMatches = (stdout.match(deprecatedRegex) || []).length
        assert.strictEqual(deprecatedMatches, 1, 'Expected exactly one deprecation warning')
        assert.strictEqual(error?.code, 1, 'Expected process to exit with code 1')

        done()
      })
    })

    // Cleanup
    t.after(() => {
      execSync(`${uninstallCommands[manager]} eslint tslint vue-cli`)
    })
  }
  catch (error) {
    console.error(`Error during tests for ${manager}:`, error)
    throw error
  }
}

test('global tests', async (t) => {
  for (const manager of managers) {
    await check(manager, t)
  }
})
