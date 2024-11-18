import type { PackageOption } from '../types'
import { checkDependencies } from '../check'

export default function checkSpecified(options: PackageOption) {
  const { packageName, range, ...openaiOptions } = options

  return checkDependencies({ [packageName]: { range } }, openaiOptions)
}
