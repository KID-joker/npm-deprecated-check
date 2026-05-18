import type { NodeStatus } from '../types'
import process from 'node:process'
import { coerce, gt, major } from 'semver'
import { renderNodeStatus } from '../render'
import nodeReleases from '../schedule.json' assert { type: 'json' }

interface VersionInfo {
  start: string
  lts?: string
  maintenance?: string
  end: string
  codename?: string
}

function getLatestNodeVersion(releases: Record<string, VersionInfo>) {
  const versions = Object.keys(releases)
  const latestVersion = versions.reduce((_prev, _curr) => {
    const prev = coerce(_prev)!
    const curr = coerce(_curr)!
    return gt(curr, prev) ? _curr : _prev
  })
  return latestVersion
}

const releases = nodeReleases as unknown as Record<string, VersionInfo>

export function getNodeStatus(): NodeStatus {
  const nodeVersion = coerce(process.version)!
  const latestNodeVersion = coerce(getLatestNodeVersion(releases))!
  const nodeVersionData = releases[`v${major(nodeVersion)}`]

  if (nodeVersionData) {
    const endDate = new Date(nodeVersionData.end)
    const currentDate = new Date()
    const isSupported = currentDate < endDate

    return {
      version: nodeVersion.version,
      majorVersion: major(nodeVersion),
      eol: !isSupported,
      eolDate: nodeVersionData.end,
      codename: nodeVersionData.codename || null,
      supported: isSupported,
      latestVersion: latestNodeVersion.version,
    }
  }
  else if (gt(nodeVersion, latestNodeVersion)) {
    return {
      version: nodeVersion.version,
      majorVersion: major(nodeVersion),
      eol: false,
      eolDate: null,
      codename: null,
      supported: true,
      latestVersion: latestNodeVersion.version,
    }
  }
  else {
    return {
      version: nodeVersion.version,
      majorVersion: major(nodeVersion),
      eol: false,
      eolDate: null,
      codename: null,
      supported: false,
      latestVersion: latestNodeVersion.version,
    }
  }
}

export default function checkNode() {
  const status = getNodeStatus()
  renderNodeStatus(status)
  return status
}
