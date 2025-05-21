import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { error } from '../utils/console'
import { formatDependencies } from '../utils/format'

const packageJsonPath = resolve('./package.json')

export function getDependenciesOfPackageJson() {
  if (!existsSync(packageJsonPath))
    return error('package.json does not exist in the current path, please execute it under the correct project path.')

  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8')
  const { dependencies, devDependencies } = JSON.parse(packageJsonContent)

  return {
    ...formatDependencies(dependencies),
    ...formatDependencies(devDependencies),
  }
}
