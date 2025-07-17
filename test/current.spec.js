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

async function check(manager, t) {
  const normalDir = path.join(playgroundDir, manager, 'normal')
  const deprecatedDir = path.join(playgroundDir, manager, 'deprecated')

  await t.test(`check ${manager} that no deprecation warning is shown`, (_t, done) => {
    exec(`cd ${normalDir} && node ${cli} current`, (_error, _stdout, stderr) => {
      assert.ok(!/deprecated/.test(stderr), 'Not expected "deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test(`check ${manager} that deprecation warning is shown if deprecated package is installed`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ${cli} current`, { timeout: 160000 }, (_error, _stdout, stderr) => {
      assert.ok(/deprecated/.test(stderr), 'Expected "deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test(`check ${manager} that no deprecation warning is shown if ignore deprecated package`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ${cli} current --ignore request,tslint`, { timeout: 160000 }, (_error, _stdout, stderr) => {
      assert.ok(!/deprecated/.test(stderr), 'Not expected "deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test(`check ${manager} that exit the program if the package is deprecated`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ${cli} current --failfast`, { timeout: 160000 }, (error, _stdout, stderr) => {
      // eslint-disable-next-line no-control-regex
      assert.ok(error.code === 1 && (stderr.match(/^\u001B\[33mdeprecated:/gm) || []).length === 1, 'Expected "WARN" to be mentioned once in deprecation warning, and process.exit(1).')
      done()
    })
  })
}

test('current tests', async (t) => {
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
    }),
  ).then(async () => {
    await t.test(`deep inspection of deprecated dependencies`, (_t, done) => {
      exec(`cd ${playgroundDir} && node ${cli} current --deep`, { timeout: 160000 }, (_error, _stdout, stderr) => {
        // eslint-disable-next-line no-control-regex
        assert.ok((stderr.match(/^\u001B\[33mdeprecated:/gm) || []).length === 6, 'Expected "WARN" to be mentioned six times in deprecation warning).')
        done()
      })
    })
  }).finally(() => {
    fs.rmSync(playgroundDir, { recursive: true, force: true })
  })
})
