import type { PackageOption } from '../types'
import { checkDependencies } from '../check'
import { renderCheckResult } from '../render'

export default async function checkSpecified(options: PackageOption) {
  const { packageName, range, ...checkOptions } = options
  const result = await checkDependencies({ [packageName]: { range } }, checkOptions)
  renderCheckResult(result, { failfast: checkOptions.failfast })
  return result
}
