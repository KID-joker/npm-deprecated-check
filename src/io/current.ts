import type { CurrentOption, VersionOrRange } from '../types'
import { checkDependencies } from '../check'
import { isGitPackage, isLocalPackage, isURLPackage } from '../filter'
import { getDependenciesOfLockfile } from '../packages/lockfiles'
import { getDependenciesOfPackageJson } from '../packages/package_json'
import { error } from '../utils/console'

export default async function checkCurrent(options: CurrentOption) {
  try {
    const dependenciesOfPackageJson = getDependenciesOfPackageJson()

    if (!dependenciesOfPackageJson)
      return

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
