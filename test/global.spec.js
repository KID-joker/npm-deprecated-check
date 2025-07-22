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

async function check(manager, t) {
  try {
    execSync(`${installCommands[manager]} eslint`)

    await t.test(`check ${manager} that no deprecation warning is shown`, (_t, done) => {
      exec(`node ${cli} global --manager ${manager}`, (_error, _stdout, stderr) => {
        assert.ok(!/deprecated/.test(stderr), 'Not expected "deprecated" to be mentioned in deprecation warning.')
        done()
      })
    })

    execSync(`${installCommands[manager]} tslint vue-cli`)

    await t.test(`check ${manager} that deprecation warning is shown if deprecated package is installed`, (_t, done) => {
      exec(`node ${cli} global --manager ${manager}`, { timeout: 160000 }, (_error, _stdout, stderr) => {
        assert.ok(/deprecated/.test(stderr), 'Expected "deprecated" to be mentioned in deprecation warning.')
        done()
      })
    })

    await t.test(`check ${manager} that no deprecation warning is shown if ignore deprecated package`, (_t, done) => {
      exec(`node ${cli} global --manager ${manager} --ignore tslint,vue-cli`, { timeout: 160000 }, (_error, _stdout, stderr) => {
        assert.ok(!/deprecated/.test(stderr), 'Not expected "deprecated" to be mentioned in deprecation warning.')
        done()
      })
    })

    await t.test(`check ${manager} that exit the program if the package is deprecated`, (_t, done) => {
      exec(`node ${cli} global --manager ${manager} --failfast`, { timeout: 160000 }, (error, _stdout, stderr) => {
        // eslint-disable-next-line no-control-regex
        assert.strictEqual((stderr.match(/^\u001B\[33mdeprecated:/gm) || []).length, 1, 'Expected exactly one deprecation warning')
        assert.strictEqual(error?.code, 1, 'Expected process to exit with code 1')
        done()
      })
    })
  }
  finally {
    ['eslint', 'tslint', 'vue-cli'].forEach((dep) => {
      try {
        execSync(`${uninstallCommands[manager]} ${dep}`)
      }
      catch {}
    })
  }
}

test('global tests', async (t) => {
  await Promise.all(managers.map(async (manager) => {
    await check(manager, t)
  }))
})
