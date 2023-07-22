import type { VersionOrRange } from '../types'

export function formatDependencies(dependencies: Record<string, string>): Record<string, VersionOrRange> {
  const newDependencies: Record<string, VersionOrRange> = {}
  for (let packageName in dependencies) {
    if (/^npm:(.+)@(.+)$/.test(dependencies[packageName])) {
      const result = /^npm:(.+)@(.+)$/.exec(dependencies[packageName])
      if (result) {
        packageName = result[1]
        dependencies[packageName] = result[2]
      }
    }
    newDependencies[packageName] = {
      range: dependencies[packageName],
    }
  }
  return newDependencies
}
