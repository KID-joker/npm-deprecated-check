export function isLocalPackage(versionRange: string) {
  const localPackagePrefix = [
    'link:',
    'file:',
    'workspace:',
  ]
  return localPackagePrefix.some(prefix => versionRange.startsWith(prefix))
}

export function isURLPackage(versionRange: string) {
  return /^https?:\/\/.+/.test(versionRange)
}

export function isGitPackage(versionRange: string) {
  return /.+\.git$/.test(versionRange)
}
