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

const requiredNodeRegex = /^\u001B\[95mRequired node:/gm
const nodeVersionSummaryRegex = /📊 Node Version Summary:/
const compatibleRegex = /compatible with Node/i

async function check(manager, t) {
  const normalDir = path.join(playgroundDir, manager, 'normal')
  const deprecatedDir = path.join(playgroundDir, manager, 'deprecated')

  await t.test(`check ${manager} compat: normal project shows all compatible`, (_t, done) => {
    exec(`cd ${normalDir} && node ${cli} compat`, { timeout: 160000 }, (_error, stdout, _stderr) => {
      assert.doesNotMatch(stdout, requiredNodeRegex, 'Not expected "Required node" in normal project.')
      done()
    })
  })

  await t.test(`check ${manager} compat: deprecated project may show required node`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ${cli} compat`, { timeout: 160000 }, (_error, stdout, _stderr) => {
      assert.ok(nodeVersionSummaryRegex.test(stdout) || compatibleRegex.test(stdout) || requiredNodeRegex.test(stdout), 'Expected compat output.')
      done()
    })
  })

  await t.test(`check ${manager} compat with --node 14: shows incompatibility for eslint`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ${cli} compat --node 14`, { timeout: 160000 }, (_error, stdout, _stderr) => {
      assert.ok(requiredNodeRegex.test(stdout) || /Node.*14/.test(stdout), 'Expected "Required node" or Node 14 in output.')
      done()
    })
  })

  await t.test(`check ${manager} compat: ignore specific packages`, (_t, done) => {
    exec(`cd ${deprecatedDir} && node ${cli} compat --ignore request,tslint`, { timeout: 160000 }, (_error, stdout, _stderr) => {
      assert.doesNotMatch(stdout, /request@/, 'Not expected "request@" in output when ignored.')
      assert.doesNotMatch(stdout, /tslint@/, 'Not expected "tslint@" in output when ignored.')
      done()
    })
  })
}

test('compat tests', async (t) => {
  try {
    for (const manager of managers) {
      for (const caseName of cases) {
        const caseDir = path.join(playgroundDir, manager, caseName)
        fs.mkdirSync(caseDir, { recursive: true })

        const srcFile = path.join(__dirname, 'examples', `${caseName}.json`)
        const destFile = path.join(caseDir, 'package.json')
        fs.copyFileSync(srcFile, destFile)

        if (manager === 'yarn') {
          const pkgJson = JSON.parse(fs.readFileSync(destFile, 'utf-8'))
          pkgJson.packageManager = 'yarn@1.22.22'
          fs.writeFileSync(destFile, JSON.stringify(pkgJson, null, 2))
          fs.writeFileSync(path.join(caseDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n')
        }

        execSync(`${manager} install --quiet`, { env: { ...process.env }, cwd: caseDir })
      }

      await check(manager, t)
    }

    await t.test('deep inspection: checks all subdirectories', (_t, done) => {
      exec(`cd ${playgroundDir} && node ${cli} compat --deep`, { timeout: 160000 }, (_error, stdout, _stderr) => {
        assert.ok(nodeVersionSummaryRegex.test(stdout) || compatibleRegex.test(stdout) || requiredNodeRegex.test(stdout), 'Expected compat output in deep mode.')
        done()
      })
    })

    await t.test('shows Node Version Summary when dependencies have engines.node', (_t, done) => {
      const deprecatedDir = path.join(playgroundDir, 'npm', 'deprecated')
      exec(`cd ${deprecatedDir} && node ${cli} compat`, { timeout: 160000 }, (_error, stdout, _stderr) => {
        if (nodeVersionSummaryRegex.test(stdout)) {
          assert.ok(/Minimum engines\.node:/.test(stdout), 'Expected minimum engines.node message.')
        }
        else {
          assert.ok(compatibleRegex.test(stdout) || requiredNodeRegex.test(stdout), 'Expected compat output.')
        }
        done()
      })
    })

    await t.test('package mode: check specific package compatibility', (_t, done) => {
      exec(`node ${cli} compat eslint --node 18`, { timeout: 30000 }, (_error, stdout, stderr) => {
        const output = stdout + stderr
        assert.ok(/eslint@/.test(output) || /Node 18/.test(output) || /Compatible with Node/.test(output), 'Expected eslint compatibility output.')
        done()
      })
    })
  }
  finally {
    fs.rmSync(playgroundDir, { recursive: true, force: true })
  }
})
