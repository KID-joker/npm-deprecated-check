import chalk from 'chalk'
import fetch from 'node-fetch'
import semver from 'semver'
import type { OpenaiOption, PackageInfo, PackageVersions, VersionOrRange } from './types'
import { getRegistry } from './utils/exec'
import { startSpinner, stopSpinner } from './utils/spinner'
import { recommendDependencies } from './chatgpt'
import { error, log } from './utils/console'

export async function checkDependencies(dependencies: Record<string, VersionOrRange>, config: OpenaiOption) {
  const packageList = Object.keys(dependencies)
  for (const packageName of packageList) {
    startSpinner()
    const result = await getPackageInfo(packageName, dependencies[packageName], config)
    stopSpinner()
    if (result.error) {
      error(result.error)
      log()
    }

    if (result.deprecated) {
      log(`${chalk.bgYellow(' WARN ')} ${chalk.yellow(`${result.name}@${result.version}: `)}${result.time}`)
      log(chalk.red(`deprecated: ${result.deprecated}`))

      if (result.recommend) {
        log(chalk.green('recommended: '))
        if (Array.isArray(result.recommend)) {
          for (const packageName of result.recommend)
            log(`[${chalk.magenta(packageName)}](https://www.npmjs.com/package/${packageName})`)
        }
        else {
          log(result.recommend)
        }
      }
      log()
    }
  }
}

async function getPackageInfo(packageName: string, versionOrRange: VersionOrRange, config: OpenaiOption) {
  let packageRes
  try {
    const response = await fetch(getRegistry() + packageName)
    packageRes = await response.json() as PackageVersions

    if (!packageRes)
      return { name: packageName, error: `${packageName}: Could not find the package!` }
  }
  catch (e: any) {
    return { name: packageName, error: `${packageName}: ${e.message}` }
  }

  const version: string | null = versionOrRange.version || (versionOrRange.range
    ? packageRes['dist-tags'][versionOrRange.range] || semver.maxSatisfying(Object.keys(packageRes.versions), versionOrRange.range || '*')
    : packageRes['dist-tags'].latest)

  if (!version || !packageRes.versions[version])
    return { name: packageName, error: `${packageName}: Please enter the correct range!` }

  const deprecated = packageRes.versions[version].deprecated
  const recommend = deprecated ? await recommendDependencies(packageRes.name, config) : null

  const packageInfo: PackageInfo = {
    name: packageRes.name,
    version,
    time: packageRes.time[version],
    deprecated,
    recommend,
  }

  return packageInfo
}
