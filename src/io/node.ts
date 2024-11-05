import process from 'node:process'
import fetch from 'node-fetch'
import { coerce, gt, major } from 'semver'
import { ok, warn } from '../utils/console'

interface versionInfo {
  start: string
  lts?: string
  maintenance?: string
  end: string
  codename?: string
}

function getNodeReleases() {
  return fetch('https://raw.githubusercontent.com/nodejs/Release/master/schedule.json').then(res => res.json())
}

function getLatestNodeVersion(nodeReleases: Record<string, versionInfo>) {
  const versions = Object.keys(nodeReleases)
  const latestVersion = versions.reduce((_prev, _curr) => {
    const prev = coerce(_prev)!
    const curr = coerce(_curr)!
    return gt(curr, prev) ? _curr : _prev
  })
  return latestVersion
}

async function checkNode() {
  const nodeReleases = await getNodeReleases() as Record<string, versionInfo>
  const nodeVersion = coerce(process.version)!
  const latestNodeVersion = coerce(getLatestNodeVersion(nodeReleases))!
  const nodeVersionData = nodeReleases[`v${major(nodeVersion)}` as keyof typeof nodeReleases]
  if (nodeVersionData) {
    const endDate = new Date(nodeVersionData.end)
    const currentDate = new Date()
    const isNodeVersionSupported = currentDate < endDate
    if (isNodeVersionSupported) {
      ok(`Your node version (${nodeVersion}) is supported until ${nodeVersionData.end}.`)
    }
    else {
      warn(`Your node version (${nodeVersion}) is no longer supported since ${nodeVersionData.end}.`)
    }
  }
  else if (gt(nodeVersion, latestNodeVersion)) {
    warn(`Your node version (${nodeVersion}) is higher than the latest version ${latestNodeVersion}. Please update 'npm-deprecated-check'.`)
  }
  else {
    warn(`Your node version (${nodeVersion}) can't be found in the release schedule. Please update 'npm-deprecated-check'.`)
  }
}

export default checkNode
