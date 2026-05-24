import type { CommonOption, PackageOption } from '../types'
import { checkDependencies } from '../check'
import { renderCheckResult } from '../render'

export default async function checkSpecified(options: PackageOption) {
  const { packageName, range, ...restOptions } = options
  const checkOptions: CommonOption = { ...restOptions, failfast: false }
  const result = await checkDependencies({ [packageName]: { range } }, checkOptions)
  renderCheckResult(result)
  return result
}
