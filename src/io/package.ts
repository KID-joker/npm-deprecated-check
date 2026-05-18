import type { PackageOption } from '../types'
import process from 'node:process'
import { checkDependencies } from '../check'
import { renderCheckResult } from '../render'

export default async function checkSpecified(options: PackageOption) {
  const { packageName, range, ...checkOptions } = options
  const result = await checkDependencies({ [packageName]: { range } }, checkOptions)
  renderCheckResult(result)
  if (checkOptions.failfast && result.hasDeprecated) {
    process.exit(1)
  }
  return result
}
