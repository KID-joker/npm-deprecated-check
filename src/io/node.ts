/* eslint-disable no-console */
import process from 'node:process'
import chalk from 'chalk'
import nodeReleases from 'node-releases/data/release-schedule/release-schedule.json'
import { coerce, gt, major } from 'semver'

function getLatestNodeVersion() {
  const versions = Object.keys(nodeReleases)
  const latestVersion = versions[versions.length - 1]
  return latestVersion
}

function checkNode() {
  const nodeVersion = coerce(process.version)
  const latestNodeVersion = coerce(getLatestNodeVersion())
  const nodeVersionData = nodeReleases[`v${major(nodeVersion)}` as keyof typeof nodeReleases]
  let result = false
  if (nodeVersionData) {
    const endDate = new Date(nodeVersionData.end)
    const currentDate = new Date()
    const isNodeVersionSupported = currentDate < endDate
    if (isNodeVersionSupported) {
      console.log(chalk.green(`Your node version (${nodeVersion}) is supported until ${nodeVersionData.end}.`))
      result = true
    }
    else {
      console.log(chalk.yellow(`Your node version (${nodeVersion}) is no longer supported since ${nodeVersionData.end}.`))
      result = false
    }
  }
  else if (gt(nodeVersion, latestNodeVersion)) {
    console.log(chalk.yellow(`Your node version (${nodeVersion}) is higher than the latest version ${latestNodeVersion}. Please update 'npm-deprecated-check'.`))
    result = true
  }
  else {
    console.log(chalk.yellow(`Your node version (${nodeVersion}) can't be found in the release schedule. Please update 'npm-deprecated-check'.`))
    result = false
  }
  return result
}

export default checkNode
