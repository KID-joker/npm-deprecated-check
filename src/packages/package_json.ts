import type { VersionOrRange } from '../types'
import { existsSync, readFileSync } from 'node:fs'
import { error } from '../utils/console'
import { formatDependencies } from '../utils/format'

export function getDependenciesOfPackageJson(packageJsonPath: string): { dependencies: Record<string, VersionOrRange>, devDependencies: Record<string, VersionOrRange> } | void {
  if (!existsSync(packageJsonPath))
    return error('package.json does not exist in the current path, please execute it under the correct project path.')

  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8')
  const { dependencies, devDependencies } = JSON.parse(packageJsonContent)

  return {
    dependencies: formatDependencies(dependencies),
    devDependencies: formatDependencies(devDependencies),
  }
}
