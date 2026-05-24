import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function findPackageJsonDirs(dir: string, results: Array<string> = [], maxDepth: number = Infinity, currentDepth: number = 0) {
  if (currentDepth >= maxDepth)
    return results
  const pkgPath = join(dir, 'package.json')
  if (existsSync(pkgPath))
    results.push(dir)
  let files
  try {
    files = readdirSync(dir)
  }
  catch {
    return results
  }
  for (const file of files) {
    if (file === 'node_modules')
      continue
    const dirPath = join(dir, file)
    try {
      const stat = statSync(dirPath)
      if (stat.isDirectory())
        findPackageJsonDirs(dirPath, results, maxDepth, currentDepth + 1)
    }
    catch {}
  }
  return results
}
