import type { CompatOption, VersionOrRange } from '../types'
import { join } from 'node:path'
import process from 'node:process'
import { coerce } from 'semver'
import { checkDependencies } from '../check'
import { isGitPackage, isLocalPackage, isURLPackage } from '../filter'
import { getDependenciesOfLockfile } from '../packages/lockfiles'
import { getDependenciesOfPackageJson } from '../packages/package_json'
import { renderCompatResult } from '../render'
import { error, log, warn } from '../utils/console'
import { findPackageJsonDirs } from '../utils/fs'

export default async function checkCompat(options: CompatOption) {
  const targetNodeVersion = options.node || process.version
  const effectiveNode = coerce(targetNodeVersion)
  if (!effectiveNode) {
    warn(`Invalid Node version: "${targetNodeVersion}", falling back to current Node version (${process.version})`)
  }

  if (options.packageName) {
    await checkPackageCompat(options, targetNodeVersion)
  }
  else {
    await checkProjectCompat(options, targetNodeVersion)
  }
}

async function checkPackageCompat(options: CompatOption, targetNodeVersion: string) {
  const { packageName, ...restOptions } = options
  const checkOptions = { ...restOptions, failfast: false }

  const result = await checkDependencies(
    { [packageName!]: { range: undefined } },
    checkOptions,
    { targetNodeVersion },
  )

  renderCompatResult(result, {
    targetNodeVersion,
    packageName: packageName!,
  })
}

async function checkProjectCompat(options: CompatOption, targetNodeVersion: string) {
  const currentPath = process.cwd()
  const pkgPaths = options.deep ? findPackageJsonDirs(currentPath) : [currentPath]

  for (const pkgPath of pkgPaths) {
    if (options.deep) {
      log(`> ${pkgPath}`)
    }
    await checkProjectPackageJson(pkgPath, options, targetNodeVersion)
    log()
  }
}

async function checkProjectPackageJson(pkgPath: string, options: CompatOption, targetNodeVersion: string) {
  const packageJsonPath = join(pkgPath, 'package.json')
  const dependenciesOfPackageJson = getDependenciesOfPackageJson(packageJsonPath)

  if (!dependenciesOfPackageJson)
    return

  try {
    const ignores = options.ignore?.split(',') || []

    const npmDependencies: Record<string, VersionOrRange> = {}
    const dependencyTypes: Record<string, 'production' | 'development'> = {}

    for (const name in dependenciesOfPackageJson.dependencies) {
      const versionInfo = dependenciesOfPackageJson.dependencies[name]
      if (!ignores.includes(name) && !isLocalPackage(versionInfo.range as string) && !isURLPackage(versionInfo.range as string) && !isGitPackage(versionInfo.range as string)) {
        npmDependencies[name] = versionInfo
        dependencyTypes[name] = 'production'
      }
    }

    for (const name in dependenciesOfPackageJson.devDependencies) {
      const versionInfo = dependenciesOfPackageJson.devDependencies[name]
      if (!ignores.includes(name) && !isLocalPackage(versionInfo.range as string) && !isURLPackage(versionInfo.range as string) && !isGitPackage(versionInfo.range as string)) {
        npmDependencies[name] = versionInfo
        dependencyTypes[name] = 'development'
      }
    }

    const dependenciesOfLockfile = await getDependenciesOfLockfile(npmDependencies)
    const dependencies = Object.assign(npmDependencies, dependenciesOfLockfile)

    const result = await checkDependencies(dependencies, { registry: options.registry, failfast: false }, {
      dependencyTypes,
      targetNodeVersion,
    })
    renderCompatResult(result, { targetNodeVersion })
    return result
  }
  catch (e: any) {
    error(e.message)
  }
}
