import type { VersionOrRange } from '../types'

export function formatDependencies(dependencies: Record<string, string>): Record<string, VersionOrRange> {
  const newDependencies: Record<string, VersionOrRange> = {}
  for (const packageName in dependencies) {
    if (dependencies[packageName].includes('@')) {
      const idx = dependencies[packageName].lastIndexOf('@')
      dependencies[packageName] = dependencies[packageName].slice(idx + 1)
    }
    newDependencies[packageName] = {
      range: dependencies[packageName],
    }
  }
  return newDependencies
}
