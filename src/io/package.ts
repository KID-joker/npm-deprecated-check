import { checkDependencies } from '../check'
import type { PackageOption } from '../types'

export default function checkSpecified(options: PackageOption) {
  const { packageName, range, ...openaiOptions } = options

  checkDependencies({ [packageName]: { range } }, openaiOptions)
}
