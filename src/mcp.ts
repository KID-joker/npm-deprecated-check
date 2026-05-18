import type { CheckResult, VersionOrRange } from './types'
import process from 'node:process'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { version } from '../package.json'
import { checkDependencies } from './check'
import { getNodeStatus } from './io/node'
import { errorResult, sanitizeError, SECURITY, validatePackageName, validateRegistry, withPackageLimit, withTimeout } from './security'

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
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(pkg, null, 2) }],
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
      ignore: z.string().optional().describe('Comma-separated package names to ignore'),
      deep: z.boolean().optional().describe('Deep inspection for monorepo projects'),
      registry: z.string().optional().describe('Custom npm registry URL'),
    },
    async ({ ignore, deep, registry }) => {
      const regResult = validateRegistry(registry || '')
      if (regResult instanceof Error)
        return errorResult(regResult.message)

      try {
        const { existsSync, readdirSync, readFileSync, statSync } = await import('node:fs')
        const { join } = await import('node:path')
        const { isGitPackage, isLocalPackage, isURLPackage } = await import('./filter')
        const { getDependenciesOfLockfile } = await import('./packages/lockfiles')
        const { getDependenciesOfPackageJson } = await import('./packages/package_json')

        const currentPath = process.cwd()

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

        return { content: [{ type: 'text' as const, text: JSON.stringify(allResults[0], null, 2) }] }
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
        const { execCommand } = await import('./utils/exec')
        const { isLocalPackage } = await import('./filter')

        const pkgManager = manager || 'npm'
        let dependencies: Record<string, { version: string }> = {}

        const yarnRegexp = /"((?:@[a-z][a-z0-9-_.]*\/)?[a-z][a-z0-9-_.]*)@(\d+\.\d+\.\d+(?:-[a-z0-9-]+(?:\.[a-z0-9-]+)*)?)"/g

        if (pkgManager === 'pnpm') {
          const raw = execCommand('pnpm list -g --depth=0 --json')
          const result = JSON.parse(raw)
          dependencies = result
            .map((ele: { dependencies?: object }) => ele.dependencies)
            .reduce((prev: object, curr?: object) => Object.assign(prev, curr), {})
        }
        else if (pkgManager === 'yarn') {
          const result = execCommand('yarn global list --depth=0')
          const iterator = Array.from(result.matchAll(yarnRegexp), (m: string[]) => [m[1], m[2]])
          for (const dep of iterator) {
            dependencies[dep[0]] = { version: dep[1] }
          }
        }
        else {
          const raw = execCommand('npm ls -g --depth=0 --json')
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

        return { content: [{ type: 'text' as const, text: JSON.stringify(checkResult, null, 2) }] }
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
