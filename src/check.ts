import type { CommonOption, PackageInfo, PackageVersions, VersionOrRange } from './types'
import chalk from 'chalk'
import fetch from 'node-fetch'
import semver from 'semver'
import { recommendDependencies } from './chatgpt'
import { getGlobalConfig } from './shared'
import { error, log, ok, warn } from './utils/console'
import { getRegistry } from './utils/exec'
import { startSpinner, stopSpinner } from './utils/spinner'

export async function checkDependencies(dependencies: Record<string, VersionOrRange>, config: CommonOption) {
  const packageList = Object.keys(dependencies)
  let haveDeprecated = false
  for (const packageName of packageList) {
    startSpinner()
    const result = await getPackageInfo(packageName, dependencies[packageName], config)
    stopSpinner()
    if (result.error) {
      error(result.error)
      log()
    }

    if (result.deprecated) {
      haveDeprecated = true
      warn(`${result.name}@${result.version}: ${result.time}\ndeprecated: ${result.deprecated}`)

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

  ok(`All dependencies retrieved successfully.${haveDeprecated ? '' : ' There are no deprecated dependencies.'}`)
}

const globalConfig = getGlobalConfig()
async function getPackageInfo(packageName: string, versionOrRange: VersionOrRange, config: CommonOption) {
  let packageRes
  try {
    const registry = config.registry || globalConfig.registry || getRegistry()
    const _registry = registry.endsWith('/') ? registry : `${registry}/`
    const response = await fetch(_registry + packageName)
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
