import { resolve } from 'node:path'
import fs from 'fs-extra'
import { error } from '../utils/console'
import { formatDependencies } from '../utils/format'

const packageJsonPath = resolve('./package.json')

export function getDependenciesOfPackageJson() {
  if (!fs.existsSync(packageJsonPath))
    return error('package.json does not exist in the current path, please execute it under the correct project path.')

  const { dependencies, devDependencies } = fs.readJsonSync(packageJsonPath)

  return {
    ...formatDependencies(dependencies),
    ...formatDependencies(devDependencies),
  }
}
