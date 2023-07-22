import { checkDependencies } from '../check'
import { isGitPackage, isLocalPackage, isURLPackage } from '../filter'
import { getDependenciesOfLockfile } from '../packages/lockfiles'
import { getDependenciesOfPackageJson } from '../packages/package_json'

export default async function checkCurrent() {
  try {
    const dependenciesOfPackageJson = getDependenciesOfPackageJson()

    if (!dependenciesOfPackageJson)
      return

    const entries = Object.entries(dependenciesOfPackageJson)
      .filter(ele => !isLocalPackage(ele[1].range as string) && !isURLPackage(ele[1].range as string) && !isGitPackage(ele[1].range as string))

    const npmDependencies = Object.fromEntries(entries)

    const dependenciesOfLockfile = await getDependenciesOfLockfile(npmDependencies)

    const dependencies = Object.assign(npmDependencies, dependenciesOfLockfile)

    checkDependencies(dependencies)
  }
  catch (e: any) {
    console.error(e.message)
  }
}
