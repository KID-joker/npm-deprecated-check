import type { SemVer } from 'semver'
import type { CommonOption, PackageInfo, PackageVersions, VersionOrRange } from './types'
import process from 'node:process'
import ansis from 'ansis'
import { coerce, maxSatisfying, minVersion, satisfies, sort } from 'semver'
import { recommendDependencies } from './chatgpt'
import { getGlobalConfig } from './shared'
import { error, log, ok, warn } from './utils/console'
import { getRegistry } from './utils/exec'
import { startSpinner, stopSpinner } from './utils/spinner'

const globalConfig = getGlobalConfig()
const currentNode = coerce(process.version)!

export async function checkDependencies(dependencies: Record<string, VersionOrRange>, config: CommonOption, dependencyTypes?: Record<string, 'production' | 'development'>, projectEnginesNode?: string) {
  const packageList = Object.keys(dependencies)
  const resultList = []
  let haveDeprecated = false
  let haveErrors = false
  for (const packageName of packageList) {
    startSpinner()
    const result = await getPackageInfo(packageName, dependencies[packageName], config)
    if (dependencyTypes && dependencyTypes[packageName]) {
      result.dependencyType = dependencyTypes[packageName]
    }
    stopSpinner()
    resultList.push(result)
    if (result.error) {
      haveErrors = true
      error(result.error)
      log()
    }

    if (result.deprecated || result.requiredNode) {
      haveDeprecated = true
      warn(`${result.name}@${result.version}: ${result.time}`)
      if (result.deprecated)
        log(`${ansis.yellowBright('Deprecated: ')}${result.deprecated}`)
      if (result.requiredNode) {
        log(`${ansis.magentaBright('Required node: ')}${result.requiredNode}`)
        if (result.compatibleVersion) {
          log(`${ansis.cyanBright('Compatible version for current Node: ')}${ansis.magenta(result.compatibleVersion)}`)
        }
      }

      if (result.deprecated) {
        if (result.minimumUpgradeVersion) {
          log(ansis.greenBright('Minimum upgrade version: '))
          log(`[${ansis.magenta(result.minimumUpgradeVersion)}](https://www.npmjs.com/package/${result.name}/v/${result.minimumUpgradeVersion})`)
        }
        else {
          log(ansis.yellowBright(`Since v${result.version}, there are no upgradable versions.`))
        }
      }
      if (result.recommend) {
        log(ansis.greenBright('Recommended: '))
        if (Array.isArray(result.recommend)) {
          for (const packageName of result.recommend)
            log(`[${ansis.magenta(packageName)}](https://www.npmjs.com/package/${packageName})`)
        }
        else {
          log(result.recommend)
        }
      }
      log()

      if (config.failfast) {
        process.exit(1)
      }
    }
  }

  if (!haveErrors)
    ok(`All dependencies retrieved successfully.${haveDeprecated ? '' : ' There are no deprecated dependencies.'}`)

  // Calculate and display minimum required Node version across all dependencies
  const minRequiredNode = calculateMinimumNodeVersion(resultList)
  if (minRequiredNode.production || minRequiredNode.development) {
    log()
    log(ansis.cyanBright('📊 Node Version Summary:'))

    if (minRequiredNode.production === minRequiredNode.development) {
      log(`Minimum Node version required: ${ansis.magenta(minRequiredNode.production || minRequiredNode.development)} (same for production and development)`)
    }
    else {
      if (minRequiredNode.production) {
        log(`Minimum Node version (production): ${ansis.magenta(minRequiredNode.production)}`)
      }
      if (minRequiredNode.development) {
        log(`Minimum Node version (development): ${ansis.magenta(minRequiredNode.development)}`)
      }
    }

    log(`Current Node version: ${ansis.magenta(process.version)}`)

    // Show project's engines.node if provided
    if (projectEnginesNode) {
      log(`Project engines.node: ${ansis.cyan(projectEnginesNode)}`)

      // Validate engines.node against actual requirements
      const productionMin = minRequiredNode.production
      if (productionMin) {
        // Check if the project's engines.node range is compatible with the minimum requirement
        // We need to check if engines.node could allow versions below productionMin
        const projectMinVersion = minVersion(projectEnginesNode)
        const requiredMinVersion = coerce(productionMin)

        if (projectMinVersion && requiredMinVersion && projectMinVersion.compare(requiredMinVersion) < 0) {
          log()
          warn(`Production dependencies require Node >=${productionMin}, but package.json allows ${projectEnginesNode}`)
          log(`  ${ansis.yellowBright(`Consider updating engines.node to ">=${productionMin}"`)}`)
        }
      }
    }

    const requiredVersion = minRequiredNode.production || minRequiredNode.development
    if (requiredVersion && !satisfies(currentNode, `>=${requiredVersion}`)) {
      warn(`Your Node version is below the minimum requirement!`)
    }
  }

  return resultList
}

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

  if (!packageRes['dist-tags'])
    return { name: packageName, error: `${packageName}: Could not find the package!` }

  const version: string | null = versionOrRange.version || (versionOrRange.range
    ? packageRes['dist-tags'][versionOrRange.range] || maxSatisfying(Object.keys(packageRes.versions), versionOrRange.range || '*') || null
    : packageRes['dist-tags'].latest
      ? packageRes['dist-tags'].latest
      : error(`${packageName}: 'latest' dist-tag does not exist!`) as unknown as string)

  if (!version || !packageRes.versions[version])
    return { name: packageName, error: `${packageName}: Please enter the correct range!` }

  const deprecated = packageRes.versions[version].deprecated
  const recommend = deprecated ? await recommendDependencies(packageRes.name, config) : null

  let minimumUpgradeVersion: string | null = null
  if (deprecated) {
    const versions = sort(Object.keys(packageRes.versions))
    for (let i = versions.indexOf(version); i < versions.length; i++) {
      const ver = versions[i]
      if (!packageRes.versions[ver].deprecated) {
        minimumUpgradeVersion = ver
        break
      }
    }
  }

  const nodeRequirement = packageRes.versions[version]?.engines?.node
  let requiredNode = nodeRequirement
  let compatibleVersion: string | null = null

  if (requiredNode) {
    if (satisfies(currentNode, requiredNode)) {
      requiredNode = undefined
    }
    else {
      // Find the highest version compatible with current Node
      compatibleVersion = findCompatibleVersion(packageRes, versionOrRange, currentNode)
    }
  }

  const packageInfo: PackageInfo = {
    name: packageRes.name,
    version,
    time: packageRes.time[version],
    deprecated,
    recommend,
    minimumUpgradeVersion,
    requiredNode,
    compatibleVersion,
    nodeRequirement,
  }

  return packageInfo
}

function findCompatibleVersion(packageRes: PackageVersions, versionOrRange: VersionOrRange, currentNode: SemVer): string | null {
  const versions = sort(Object.keys(packageRes.versions)).reverse()

  for (const ver of versions) {
    const versionData = packageRes.versions[ver]
    const nodeRequirement = versionData.engines?.node

    // Skip deprecated versions unless specifically requested
    if (versionData.deprecated)
      continue

    // If no node requirement, it's compatible
    if (!nodeRequirement)
      return ver

    // Check if this version is compatible with current Node
    if (satisfies(currentNode, nodeRequirement)) {
      // If a range was specified, also check if this version satisfies it
      if (versionOrRange.range) {
        if (satisfies(ver, versionOrRange.range))
          return ver
      }
      else {
        return ver
      }
    }
  }

  return null
}

function calculateMinimumNodeVersion(results: PackageInfo[]): { production: string | null, development: string | null } {
  const productionRequirements: string[] = []
  const developmentRequirements: string[] = []

  for (const result of results) {
    if (result.nodeRequirement) {
      if (result.dependencyType === 'production') {
        productionRequirements.push(result.nodeRequirement)
      }
      else if (result.dependencyType === 'development') {
        developmentRequirements.push(result.nodeRequirement)
      }
      else {
        // If no type specified, assume it affects both
        productionRequirements.push(result.nodeRequirement)
        developmentRequirements.push(result.nodeRequirement)
      }
    }
  }

  const productionMin = findHighestMinimum(productionRequirements)
  const developmentMin = findHighestMinimum(developmentRequirements)

  return {
    production: productionMin,
    development: developmentMin,
  }
}

function findHighestMinimum(requirements: string[]): string | null {
  if (requirements.length === 0)
    return null

  let highestMin: SemVer | null = null

  for (const requirement of requirements) {
    const min = minVersion(requirement)
    if (min) {
      if (!highestMin || min.compare(highestMin) > 0) {
        highestMin = min
      }
    }
  }

  return highestMin ? highestMin.version : null
}
