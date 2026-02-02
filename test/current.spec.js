/* eslint-disable no-control-regex */
import assert from 'node:assert/strict'
import { exec, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cli = path.resolve(__dirname, '../dist/cli.mjs')

const managers = ['npm', 'yarn', 'pnpm']
const cases = ['deprecated', 'normal']
const playgroundDir = path.join(__dirname, 'playground')

// Regex to match ANSI-formatted deprecation warnings (yellowBright = \u001B[93m)
const deprecatedRegex = /^\u001B\[93mDeprecated:/gm

async function check(manager, t) {
  const normalDir = path.join(playgroundDir, manager, 'normal')
  const deprecatedDir = path.join(playgroundDir, manager, 'deprecated')

  await t.test(`check ${manager} that no deprecation warning is shown`, (_t, done) => {
    exec(`cd ${normalDir} && node ${cli} current`, (_error, stdout, _stderr) => {
      assert.doesNotMatch(stdout, deprecatedRegex, 'Not expected "Deprecated" to be mentioned in output.')
      done()
    })
  })

  await t.test(`check ${manager} that deprecation warning is shown if deprecated package is installed`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ${cli} current`, { timeout: 160000 }, (_error, stdout, _stderr) => {
      assert.match(stdout, deprecatedRegex, 'Expected "Deprecated" to be mentioned in output.')
      done()
    })
  })

  await t.test(`check ${manager} that no deprecation warning is shown if ignore deprecated package`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ${cli} current --ignore request,tslint`, { timeout: 160000 }, (_error, stdout, _stderr) => {
      assert.doesNotMatch(stdout, deprecatedRegex, 'Not expected "Deprecated" to be mentioned when packages are ignored.')
      done()
    })
  })

  await t.test(`check ${manager} that exit the program if the package is deprecated`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ${cli} current --failfast`, { timeout: 160000 }, (error, stdout, _stderr) => {
      assert.strictEqual(error.code, 1, 'Expected process to exit with code 1.')

      assert.strictEqual((stdout.match(deprecatedRegex) || []).length, 1, 'Expected exactly one "Deprecated" warning.')
      done()
    })
  })
}

test('current tests', async (t) => {
  try {
    for (const manager of managers) {
      // Setup test directories
      for (const caseName of cases) {
        const caseDir = path.join(playgroundDir, manager, caseName)
        fs.mkdirSync(caseDir, { recursive: true })

        const srcFile = path.join(__dirname, 'examples', `${caseName}.json`)
        const destFile = path.join(caseDir, 'package.json')
        fs.copyFileSync(srcFile, destFile)
        execSync(`${manager} install --quiet`, { cwd: caseDir })
      }

      await check(manager, t)
    }

    await t.test(`deep inspection: checks for six deprecated dependencies`, (_t, done) => {
      exec(`cd ${playgroundDir} && node ${cli} current --deep`, { timeout: 160000 }, (_error, stdout, _stderr) => {
        assert.strictEqual((stdout.match(deprecatedRegex) || []).length, 6, 'Expected exactly six "Deprecated" warnings.')
        done()
      })
    })

    await t.test(`shows minimum Node version summary for current project`, (_t, done) => {
      const normalDir = path.join(playgroundDir, 'npm', 'normal')
      exec(`cd ${normalDir} && node ${cli} current`, (_error, stdout, _stderr) => {
        assert.ok(/📊 Node Version Summary:/.test(stdout), 'Expected "Node Version Summary" to be shown.')
        assert.ok(/Minimum engines\.node:/.test(stdout), 'Expected minimum engines.node message.')
        done()
      })
    })
  }
  finally {
    fs.rmSync(playgroundDir, { recursive: true, force: true })
  }
})
