/* eslint-disable no-console */
import { createRequire } from 'node:module'
import process from 'node:process'
import chalk from 'chalk'
import { coerce, gt, major } from 'semver'

const require = createRequire(import.meta.url)
const nodeReleases = require('node-releases/data/release-schedule/release-schedule.json')

function getLatestNodeVersion() {
  const versions = Object.keys(nodeReleases)
  const latestVersion = versions.reduce((_prev, _curr) => {
    const prev = coerce(_prev)!
    const curr = coerce(_curr)!
    return gt(curr, prev) ? _curr : _prev
  })
  return latestVersion
}

function checkNode() {
  const nodeVersion = coerce(process.version)!
  const latestNodeVersion = coerce(getLatestNodeVersion())!
  const nodeVersionData = nodeReleases[`v${major(nodeVersion)}` as keyof typeof nodeReleases]
  if (nodeVersionData) {
    const endDate = new Date(nodeVersionData.end)
    const currentDate = new Date()
    const isNodeVersionSupported = currentDate < endDate
    if (isNodeVersionSupported) {
      console.log(chalk.green(`Your node version (${nodeVersion}) is supported until ${nodeVersionData.end}.`))
    }
    else {
      console.log(chalk.yellow(`Your node version (${nodeVersion}) is no longer supported since ${nodeVersionData.end}.`))
    }
  }
  else if (gt(nodeVersion, latestNodeVersion)) {
    console.log(chalk.yellow(`Your node version (${nodeVersion}) is higher than the latest version ${latestNodeVersion}. Please update 'npm-deprecated-check'.`))
  }
  else {
    console.log(chalk.yellow(`Your node version (${nodeVersion}) can't be found in the release schedule. Please update 'npm-deprecated-check'.`))
  }
}

export default checkNode
