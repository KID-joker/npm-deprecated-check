/* eslint-disable no-console */
import process from 'node:process'
import chalk from 'chalk'
import nodeReleases from 'node-releases/data/release-schedule/release-schedule.json'

function getLatestNodeVersion() {
  const versions = Object.keys(nodeReleases)
  const latestVersion = versions[versions.length - 1]
  const versionWithoutV = latestVersion.slice(1)
  const nodeVersion = versionWithoutV.split('.')[0]
  return nodeVersion
}

function getNodeVersion() {
  const nodeVersionWithoutV = process.version.slice(1)
  const nodeVersion = nodeVersionWithoutV.split('.')[0]
  return nodeVersion
}

function checkNode() {
  const nodeVersion = getNodeVersion()
  const nodeVersionData = nodeReleases[`v${nodeVersion}` as keyof typeof nodeReleases]
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
  else if (nodeVersion > getLatestNodeVersion()) {
    console.log(chalk.green(`Your node version (${nodeVersion}) is higher than the latest version ${getLatestNodeVersion()}.`))
    result = true
  }
  else {
    console.log(chalk.yellow(`Your node version (${nodeVersion}) can't be found in the release schedule.`))
    result = false
  }
  return result
}

export default checkNode