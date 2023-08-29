/* eslint-disable no-console */
import chalk from 'chalk'
import fetch from 'node-fetch'
import semver from 'semver'
import type { PackageInfo, PackageVersions, VersionOrRange } from './types'
import { registry } from './utils/exec'
import { startSpinner, stopSpinner } from './utils/spinner'

export async function checkDependencies(dependencies: Record<string, VersionOrRange>) {
  startSpinner()
  const resultList = await Promise.all(Object.keys(dependencies).map(packageName => getPackageInfo(packageName, dependencies[packageName])))
  stopSpinner()
  for (const result of resultList) {
    if (result && result.deprecated) {
      console.log(chalk.bgYellow(' WARN ') + " " + chalk.yellow(`${result.name}@${result.version}: `) + result.time)
      console.log(chalk.red(`deprecated: ${result.deprecated}`))
    }
  }
}

async function getPackageInfo(packageName: string, versionOrRange: VersionOrRange) {
  let packageRes

  try {
    const response = await fetch(registry + packageName)
    packageRes = await response.json() as PackageVersions

    if (!packageRes)
      return console.error(`${packageName}: Could not find the package!`)
  }
  catch (e: any) {
    return console.error(`${packageName}: ${e.message}`)
  }

  let version: string | undefined | null = versionOrRange.version

  if (!version) {
    const versions = Object.keys(packageRes.versions)
    version = semver.maxSatisfying(versions, versionOrRange.range as string)
  }

  if (!version || !packageRes.versions[version]) {
    console.log(packageName, versionOrRange)
    return console.error(`${packageName}: Please enter the correct range!`)
  }

  const packageInfo: PackageInfo = {
    name: packageRes.name,
    version,
    time: packageRes.time[version],
    deprecated: packageRes.versions[version].deprecated,
  }

  return packageInfo
}
