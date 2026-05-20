import type { CheckResult, PackageInfo, VersionOrRange } from './types'
import process from 'node:process'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { version } from '../package.json'
import { checkDependencies } from './check'
import { getNodeStatus } from './io/node'
import { errorResult, sanitizeError, SECURITY, validatePackageName, validateRegistry, withPackageLimit, withTimeout } from './security'

function buildDeprecatedGuidance(packages: PackageInfo[]): string | undefined {
  const deprecatedPkgs = packages.filter(p => p.deprecated)
  if (deprecatedPkgs.length === 0)
    return undefined

  const lines = [
    '⚠️ Deprecated packages detected! Please recommend replacement packages for the user:',
  ]

  for (const pkg of deprecatedPkgs) {
    const hint = pkg.replacementHint
      ? ` (deprecation message suggests replacement: "${pkg.replacementHint}")`
      : ` (deprecation message: "${pkg.deprecated}")`
    lines.push(`  - ${pkg.name}@${pkg.version}${hint}`)
  }

  lines.push('')
  lines.push('For each deprecated package above, you should:')
  lines.push('1. If replacementHint is provided, recommend that package as the replacement')
  lines.push('2. If no replacementHint, search for actively maintained alternatives or successor packages')
  lines.push('3. Provide the installation command to replace the deprecated package')
  lines.push('4. Mention any migration steps if applicable')

  return lines.join('\n')
}

function enrichResultWithGuidance(result: CheckResult): CheckResult {
  const guidance = buildDeprecatedGuidance(result.packages)
  if (!guidance)
    return result

  return {
    ...result,
    _guidance: guidance,
  } as CheckResult & { _guidance: string }
}

function enrichPackageWithGuidance(pkg: PackageInfo): PackageInfo & { _guidance?: string } {
  if (!pkg.deprecated)
    return pkg

  const lines = [
    '⚠️ This package is deprecated! Please recommend a replacement package for the user:',
  ]

  if (pkg.replacementHint) {
    lines.push(`The deprecation message suggests replacement: "${pkg.replacementHint}"`)
  }
  else {
    lines.push(`Deprecation message: "${pkg.deprecated}"`)
  }

  lines.push('')
  lines.push('You should:')
  lines.push('1. If replacementHint is provided, recommend that package as the replacement')
  lines.push('2. If no replacementHint, search for actively maintained alternatives or successor packages')
  lines.push('3. Provide the installation command to replace the deprecated package')
  lines.push('4. Mention any migration steps if applicable')

  return { ...pkg, _guidance: lines.join('\n') }
}

export async function startServer() {
  const server = new McpServer({
    name: 'npm-deprecated-check',
    version,
  })

  server.tool(
    'check_package',
    'Check if a specific npm package is deprecated. Returns deprecation info, minimum upgrade version, and Node.js compatibility.',
    {
      packageName: z.string().describe('npm package name'),
      range: z.string().optional().describe('Version range, e.g. "^1.0.0"'),
      registry: z.string().optional().describe('Custom npm registry URL'),
    },
    async ({ packageName, range, registry }) => {
      const nameResult = validatePackageName(packageName)
      if (nameResult instanceof Error)
        return errorResult(nameResult.message)

      const regResult = validateRegistry(registry || '')
      if (regResult instanceof Error)
        return errorResult(regResult.message)

      try {
        const result = await withTimeout(
          checkDependencies(
            { [nameResult]: { range } },
            { registry: regResult, failfast: false },
            { silent: true },
          ),
          SECURITY.FETCH_TIMEOUT_MS,
        )

        const pkg = result.packages[0]
        if (pkg?.error) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: sanitizeError(pkg.error) }, null, 2) }],
          }
        }
        const enrichedPkg = enrichPackageWithGuidance(pkg)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(enrichedPkg, null, 2) }],
        }
      }
      catch (e) {
        return errorResult(sanitizeError(e))
      }
    },
  )

  server.tool(
    'check_current_project',
    'Check all dependencies of the current project for deprecation, upgrade versions, and Node.js compatibility.',
    {
      projectPath: z.string().optional().describe('Absolute path to the project root directory (must contain package.json). If not provided, uses the current working directory.'),
      ignore: z.string().optional().describe('Comma-separated package names to ignore'),
      deep: z.boolean().optional().describe('Deep inspection for monorepo projects'),
      registry: z.string().optional().describe('Custom npm registry URL'),
    },
    async ({ projectPath, ignore, deep, registry }) => {
      const regResult = validateRegistry(registry || '')
      if (regResult instanceof Error)
        return errorResult(regResult.message)

      try {
        const { existsSync, readdirSync, readFileSync, statSync } = await import('node:fs')
        const { join, isAbsolute } = await import('node:path')
        const { isGitPackage, isLocalPackage, isURLPackage } = await import('./filter')
        const { getDependenciesOfLockfile } = await import('./packages/lockfiles')
        const { getDependenciesOfPackageJson } = await import('./packages/package_json')

        const currentPath = projectPath || process.cwd()
        if (projectPath && !isAbsolute(projectPath))
          return errorResult('projectPath must be an absolute path')
        if (!existsSync(currentPath))
          return errorResult(`Project path does not exist: ${currentPath}`)
        if (!existsSync(join(currentPath, 'package.json')))
          return errorResult(`No package.json found in: ${currentPath}`)

        function findPackageJsonDirs(dir: string, results: Array<string> = [], maxDepth: number = SECURITY.MAX_RECURSION_DEPTH, currentDepth: number = 0) {
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

        const pkgPaths = deep ? findPackageJsonDirs(currentPath, [], SECURITY.MAX_RECURSION_DEPTH, 0) : [currentPath]
        const allResults: CheckResult[] = []
        const allDependencies: Record<string, VersionOrRange> = {}
        const allDependencyTypes: Record<string, 'production' | 'development'> = {}
        let projectEnginesNode: string | undefined

        for (const pkgPath of pkgPaths) {
          const packageJsonPath = join(pkgPath, 'package.json')
          const dependenciesOfPackageJson = getDependenciesOfPackageJson(packageJsonPath)
          if (!dependenciesOfPackageJson)
            continue

          try {
            const content = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
            projectEnginesNode = content.engines?.node
          }
          catch {}

          const ignores = ignore?.split(',') || []
          const npmDependencies: Record<string, VersionOrRange> = {}
          const dependencyTypes: Record<string, 'production' | 'development'> = {}

          for (const name in dependenciesOfPackageJson.dependencies) {
            const versionInfo = dependenciesOfPackageJson.dependencies[name]
            if (!ignores.includes(name) && !isLocalPackage(versionInfo.range as string) && !isURLPackage(versionInfo.range as string) && !isGitPackage(versionInfo.range as string)) {
              npmDependencies[name] = versionInfo
              dependencyTypes[name] = 'production'
            }
          }

          for (const name in dependenciesOfPackageJson.devDependencies) {
            const versionInfo = dependenciesOfPackageJson.devDependencies[name]
            if (!ignores.includes(name) && !isLocalPackage(versionInfo.range as string) && !isURLPackage(versionInfo.range as string) && !isGitPackage(versionInfo.range as string)) {
              npmDependencies[name] = versionInfo
              dependencyTypes[name] = 'development'
            }
          }

          const dependenciesOfLockfile = await getDependenciesOfLockfile(npmDependencies)
          Object.assign(allDependencies, npmDependencies, dependenciesOfLockfile)
          Object.assign(allDependencyTypes, dependencyTypes)
        }

        const limitResult = withPackageLimit(allDependencies)
        if (limitResult instanceof Error)
          return errorResult(limitResult.message)

        const config = { registry: regResult, failfast: false }
        const result = await withTimeout(
          checkDependencies(limitResult, config, {
            dependencyTypes: allDependencyTypes,
            projectEnginesNode,
            silent: true,
          }),
          SECURITY.FETCH_TIMEOUT_MS,
        )
        allResults.push(result)

        if (allResults.length === 0) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ packages: [], nodeVersionSummary: null, summary: { total: 0, deprecated: 0, nodeIncompatible: 0, errors: 0 } }, null, 2) }] }
        }

        const enrichedResult = enrichResultWithGuidance(allResults[0])
        return { content: [{ type: 'text' as const, text: JSON.stringify(enrichedResult, null, 2) }] }
      }
      catch (e) {
        return errorResult(sanitizeError(e))
      }
    },
  )

  server.tool(
    'check_global',
    'Check globally installed packages for deprecation.',
    {
      manager: z.enum(['npm', 'yarn', 'pnpm']).optional().describe('Package manager (default: npm)'),
      ignore: z.string().optional().describe('Comma-separated package names to ignore'),
      registry: z.string().optional().describe('Custom npm registry URL'),
    },
    async ({ manager, ignore, registry }) => {
      const regResult = validateRegistry(registry || '')
      if (regResult instanceof Error)
        return errorResult(regResult.message)

      try {
        const { execCommand, resolveCommand } = await import('./utils/exec')
        const { isLocalPackage } = await import('./filter')

        const pkgManager = manager || 'npm'
        const resolvedPath = resolveCommand(pkgManager)
        if (!resolvedPath)
          return errorResult(`Could not find "${pkgManager}" command. Please ensure ${pkgManager} is installed and available in your PATH. You can also try specifying a different package manager.`)

        const pkgCmd = `"${resolvedPath}"`
        let dependencies: Record<string, { version: string }> = {}

        const yarnRegexp = /"((?:@[a-z][a-z0-9-_.]*\/)?[a-z][a-z0-9-_.]*)@(\d+\.\d+\.\d+(?:-[a-z0-9-]+(?:\.[a-z0-9-]+)*)?)"/g

        if (pkgManager === 'pnpm') {
          const raw = execCommand(`${pkgCmd} list -g --depth=0 --json`)
          const result = JSON.parse(raw)
          dependencies = result
            .map((ele: { dependencies?: object }) => ele.dependencies)
            .reduce((prev: object, curr?: object) => Object.assign(prev, curr), {})
        }
        else if (pkgManager === 'yarn') {
          const result = execCommand(`${pkgCmd} global list --depth=0`)
          const iterator = Array.from(result.matchAll(yarnRegexp), (m: string[]) => [m[1], m[2]])
          for (const dep of iterator) {
            dependencies[dep[0]] = { version: dep[1] }
          }
        }
        else {
          const raw = execCommand(`${pkgCmd} ls -g --depth=0 --json`)
          const result = JSON.parse(raw)
          dependencies = result.dependencies
        }

        const ignores = ignore?.split(',') || []
        const filteredDeps = Object.fromEntries(
          Object.entries(dependencies).filter(([key, { version }]) => !ignores.includes(key) && !isLocalPackage(version)),
        )

        const limitResult = withPackageLimit(filteredDeps)
        if (limitResult instanceof Error)
          return errorResult(limitResult.message)

        const config = { registry: regResult, failfast: false }
        const checkResult = await withTimeout(
          checkDependencies(limitResult, config, { silent: true }),
          SECURITY.FETCH_TIMEOUT_MS,
        )

        const enrichedResult = enrichResultWithGuidance(checkResult)
        return { content: [{ type: 'text' as const, text: JSON.stringify(enrichedResult, null, 2) }] }
      }
      catch (e) {
        return errorResult(sanitizeError(e))
      }
    },
  )

  server.tool(
    'check_node',
    'Check if the current Node.js version has reached End of Life.',
    {},
    async () => {
      try {
        const status = getNodeStatus()
        return { content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }] }
      }
      catch (e) {
        return errorResult(sanitizeError(e))
      }
    },
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
