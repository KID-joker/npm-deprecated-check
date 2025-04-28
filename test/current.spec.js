import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const fsPromises = fs.promises

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const managers = ['npm', 'yarn', 'pnpm']
const cases = ['deprecated', 'normal']
const playgroundDir = path.join(__dirname, 'playground')

async function check(manager, t) {
  const normalDir = path.join(playgroundDir, manager, 'normal')
  const deprecatedDir = path.join(playgroundDir, manager, 'deprecated')

  await t.test(`check ${manager} if no deprecation warning is shown`, (_t, done) => {
    exec(`cd ${normalDir} && node ./dist/cli.mjs current`, (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test(`check ${manager} if deprecation warning is shown if deprecated package is installed`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ./dist/cli.mjs current`, { timeout: 160000 }, (_error, _stdout, stderr) => {
      assert.ok(/request has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test(`check ${manager} if no deprecation warning is shown if ignore deprecated package`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ./dist/cli.mjs current --ignore request,tslint`, { timeout: 160000 }, (_error, _stdout, stderr) => {
      assert.ok(!/has been deprecated/.test(stderr), 'Not expected "has been deprecated" to be mentioned in deprecation warning.')
      done()
    })
  })

  await t.test(`check ${manager} if exit the program if the package is deprecated`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ./dist/cli.mjs current --failfast`, { timeout: 160000 }, (_error, _stdout, stderr) => {
      assert.ok(/request has been deprecated/.test(stderr), 'Expected "has been deprecated" to be mentioned in deprecation warning.')
      assert.ok(!/tslint has been deprecated/.test(stderr), 'Expected process.exit(1), only "request has been deprecated".')
      done()
    })
  })
}

test('current tests', async (t) => {
  await Promise.all(managers.map(async (manager) => {
    await Promise.all(cases.map(async (caseName) => {
      const caseDir = path.join(playgroundDir, manager, caseName)

      await fsPromises.mkdir(caseDir, { recursive: true })

      const srcFile = path.join(__dirname, 'examples', `${caseName}.json`)
      const destFile = path.join(caseDir, 'package.json')
      await fsPromises.copyFile(srcFile, destFile)
      await execAsync(`${manager} install`, { cwd: caseDir })
    }))

    await check(manager, t)
  })).finally(() => {
    fsPromises.rm(playgroundDir, { recursive: true, force: true })
  })
})
