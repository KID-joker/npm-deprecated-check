import type { SemVer } from 'semver'
import type { CheckResult, CommonOption, PackageInfo, PackageVersions, VersionOrRange } from './types'
import process from 'node:process'
import { coerce, maxSatisfying, minVersion, satisfies, sort } from 'semver'
import { createSafeFetch, SECURITY } from './security'
import { getGlobalConfig } from './shared'
import { getRegistry } from './utils/exec'
import { startSpinner, stopSpinner } from './utils/spinner'

const globalConfig = getGlobalConfig()
const currentNode = coerce(process.version)!

export async function checkDependencies(
  dependencies: Record<string, VersionOrRange>,
  config: CommonOption,
  options?: {
    dependencyTypes?: Record<string, 'production' | 'development'>
    projectEnginesNode?: string
    silent?: boolean
  },
): Promise<CheckResult> {
  const packageList = Object.keys(dependencies)
  const resultList: PackageInfo[] = []
  let hasDeprecated = false
  let hasErrors = false
  let interrupted = false
  const silent = options?.silent ?? false

  for (const packageName of packageList) {
    if (!silent)
      startSpinner()
    const result = await getPackageInfo(packageName, dependencies[packageName], config)
    if (options?.dependencyTypes && options.dependencyTypes[packageName]) {
      result.dependencyType = options.dependencyTypes[packageName]
    }
    if (!silent)
      stopSpinner()
    resultList.push(result)

    if (result.error) {
      hasErrors = true
    }
    if (result.deprecated || result.requiredNode) {
      hasDeprecated = true
      if (config.failfast) {
        interrupted = true
        break
      }
    }
  }

  // Calculate minimum required Node version
  const minRequiredNode = calculateMinimumNodeVersion(resultList)
  const nodeVersionSummary = (minRequiredNode.production || minRequiredNode.development)
    ? {
        currentNode: process.version,
        minimumRequired: minRequiredNode,
        projectEnginesNode: options?.projectEnginesNode,
      }
    : null

  // Compute summary
  const summary = {
    total: resultList.length,
    deprecated: resultList.filter(r => r.deprecated).length,
    nodeIncompatible: resultList.filter(r => r.requiredNode).length,
    errors: resultList.filter(r => r.error).length,
  }

  return {
    packages: resultList,
    hasDeprecated,
    hasErrors,
    interrupted,
    nodeVersionSummary,
    summary,
  }
}

async function getPackageInfo(packageName: string, versionOrRange: VersionOrRange, config: CommonOption): Promise<PackageInfo> {
  let packageRes
  try {
    const registry = config.registry || globalConfig.registry || getRegistry()
    const _registry = registry.endsWith('/') ? registry : `${registry}/`
    const safeFetch = createSafeFetch({ timeout: SECURITY.FETCH_TIMEOUT_MS })
    const response = await safeFetch(_registry + packageName)
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
      : null)

  if (!version || !packageRes.versions[version])
    return { name: packageName, error: `${packageName}: Please enter the correct range!` }

  const deprecated = packageRes.versions[version].deprecated

  let replacementHint: string | undefined
  if (deprecated) {
    replacementHint = extractReplacementHint(deprecated)
  }

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
      compatibleVersion = findCompatibleVersion(packageRes, versionOrRange, currentNode)
    }
  }

  const packageInfo: PackageInfo = {
    name: packageRes.name,
    version,
    time: packageRes.time[version],
    deprecated,
    replacementHint,
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

    if (versionData.deprecated)
      continue

    if (!nodeRequirement)
      return ver

    if (satisfies(currentNode, nodeRequirement)) {
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

function calculateMinimumNodeVersion(results: PackageInfo[]): {
  production: string | null
  development: string | null
  productionPackage: string | null
  developmentPackage: string | null
} {
  const productionRequirements: Array<{ requirement: string, package: string }> = []
  const developmentRequirements: Array<{ requirement: string, package: string }> = []

  for (const result of results) {
    if (result.nodeRequirement) {
      const pkgInfo = { requirement: result.nodeRequirement, package: `${result.name}@${result.version}` }
      if (result.dependencyType === 'production') {
        productionRequirements.push(pkgInfo)
      }
      else if (result.dependencyType === 'development') {
        developmentRequirements.push(pkgInfo)
      }
      else {
        productionRequirements.push(pkgInfo)
        developmentRequirements.push(pkgInfo)
      }
    }
  }

  const productionResult = findHighestMinimum(productionRequirements)
  const developmentResult = findHighestMinimum(developmentRequirements)

  return {
    production: productionResult.version,
    development: developmentResult.version,
    productionPackage: productionResult.package,
    developmentPackage: developmentResult.package,
  }
}

function findHighestMinimum(requirements: Array<{ requirement: string, package: string }>): { version: string | null, package: string | null } {
  if (requirements.length === 0)
    return { version: null, package: null }

  let highestMin: SemVer | null = null
  let highestPackage: string | null = null

  for (const { requirement, package: pkg } of requirements) {
    const min = minVersion(requirement)
    if (min) {
      if (!highestMin || min.compare(highestMin) > 0) {
        highestMin = min
        highestPackage = pkg
      }
    }
  }

  return { version: highestMin?.version || null, package: highestPackage }
}

function extractReplacementHint(deprecatedMessage: string): string | undefined {
  const patterns = [
    /use\s+(@[\w\-.~]+\/[\w\-.~]+|[\w\-.~]+)\s+instead/i,
    /replaced\s+by\s+(@[\w\-.~]+\/[\w\-.~]+|[\w\-.~]+)/i,
    /migrated?\s+to\s+(@[\w\-.~]+\/[\w\-.~]+|[\w\-.~]+)/i,
    /deprecated\s+in\s+favor\s+of\s+(@[\w\-.~]+\/[\w\-.~]+|[\w\-.~]+)/i,
    /prefer\s+(@[\w\-.~]+\/[\w\-.~]+|[\w\-.~]+)\s+instead/i,
    /switch\s+to\s+(@[\w\-.~]+\/[\w\-.~]+|[\w\-.~]+)/i,
    /please\s+use\s+(@[\w\-.~]+\/[\w\-.~]+|[\w\-.~]+)\s+instead/i,
  ]

  for (const pattern of patterns) {
    const match = deprecatedMessage.match(pattern)
    if (match?.[1])
      return match[1]
  }

  return undefined
}
