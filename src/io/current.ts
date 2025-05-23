import type { CurrentOption, VersionOrRange } from '../types'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { checkDependencies } from '../check'
import { isGitPackage, isLocalPackage, isURLPackage } from '../filter'
import { getDependenciesOfLockfile } from '../packages/lockfiles'
import { getDependenciesOfPackageJson } from '../packages/package_json'
import { error, log } from '../utils/console'

export default async function checkCurrent(options: CurrentOption) {
  const currentPath = process.cwd()
  const pkgPaths = options.deep ? findPackageJsonDirs(currentPath) : [currentPath]
  for (const pkgPath of pkgPaths) {
    log(`> ${pkgPath}`)
    await checkCurrentPackageJson(pkgPath, options)
    log()
  }
}

function findPackageJsonDirs(dir: string, results: Array<string> = []) {
  const pkgPath = join(dir, 'package.json')
  if (existsSync(pkgPath)) {
    results.push(dir)
  }

  let files
  try {
    files = readdirSync(dir)
  }
  catch {
    return results
  }

  for (const file of files) {
    if (file === 'node_modules') {
      continue
    }
    const dirPath = join(dir, file)
    try {
      const stat = statSync(dirPath)
      if (stat.isDirectory()) {
        findPackageJsonDirs(dirPath, results)
      }
    }
    catch {
    }
  }

  return results
}

async function checkCurrentPackageJson(pkgPath: string, options: CurrentOption) {
  const packageJsonPath = join(pkgPath, 'package.json')
  const dependenciesOfPackageJson = getDependenciesOfPackageJson(packageJsonPath)

  if (!dependenciesOfPackageJson)
    return

  try {
    const ignores = options.ignore?.split(',') || []

    const npmDependencies: Record<string, VersionOrRange> = {}

    for (const name in dependenciesOfPackageJson) {
      const versionInfo = dependenciesOfPackageJson[name]
      if (!ignores.includes(name) && !isLocalPackage(versionInfo.range as string) && !isURLPackage(versionInfo.range as string) && !isGitPackage(versionInfo.range as string)) {
        npmDependencies[name] = versionInfo
      }
    }

    const dependenciesOfLockfile = await getDependenciesOfLockfile(npmDependencies)

    const dependencies = Object.assign(npmDependencies, dependenciesOfLockfile)

    return checkDependencies(dependencies, options)
  }
  catch (e: any) {
    error(e.message)
  }
}
