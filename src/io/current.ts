import type { CommonOption } from '../types'
import { checkDependencies } from '../check'
import { isGitPackage, isLocalPackage, isURLPackage } from '../filter'
import { getDependenciesOfLockfile } from '../packages/lockfiles'
import { getDependenciesOfPackageJson } from '../packages/package_json'
import { error } from '../utils/console'

export default async function checkCurrent(options: CommonOption) {
  try {
    const dependenciesOfPackageJson = getDependenciesOfPackageJson()

    if (!dependenciesOfPackageJson)
      return

    const entries = Object.entries(dependenciesOfPackageJson)
      .filter(ele => !isLocalPackage(ele[1].range as string) && !isURLPackage(ele[1].range as string) && !isGitPackage(ele[1].range as string))

    const npmDependencies = Object.fromEntries(entries)

    const dependenciesOfLockfile = await getDependenciesOfLockfile(npmDependencies)

    const dependencies = Object.assign(npmDependencies, dependenciesOfLockfile)

    return checkDependencies(dependencies, options)
  }
  catch (e: any) {
    error(e.message)
  }
}
