import type { CheckResult, VersionOrRange } from './types'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { checkDependencies } from './check'
import { getNodeStatus } from './io/node'
import { version } from '../package.json'

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
      const config = { registry: registry || '', failfast: false }
      const result = await checkDependencies(
        { [packageName]: { range } },
        config,
        { silent: true },
      )

      const pkg = result.packages[0]
      if (pkg?.error) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: pkg.error }, null, 2) }],
        }
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(pkg, null, 2) }],
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
      const { existsSync, readdirSync, readFileSync, statSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { isGitPackage, isLocalPackage, isURLPackage } = await import('./filter')
      const { getDependenciesOfLockfile } = await import('./packages/lockfiles')
      const { getDependenciesOfPackageJson } = await import('./packages/package_json')

      const currentPath = process.cwd()
      const pkgPaths = deep ? findPackageJsonDirs(currentPath) : [currentPath]
      const allResults: CheckResult[] = []

      for (const pkgPath of pkgPaths) {
        const packageJsonPath = join(pkgPath, 'package.json')
        const dependenciesOfPackageJson = getDependenciesOfPackageJson(packageJsonPath)
        if (!dependenciesOfPackageJson) continue

        let projectEnginesNode: string | undefined
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
        const dependencies = Object.assign(npmDependencies, dependenciesOfLockfile)

        const config = { registry: registry || '', failfast: false }
        const result = await checkDependencies(dependencies, config, {
          dependencyTypes,
          projectEnginesNode,
          silent: true,
        })
        allResults.push(result)
      }

      if (allResults.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ packages: [], nodeVersionSummary: null, summary: { total: 0, deprecated: 0, nodeIncompatible: 0, errors: 0 } }, null, 2) }] }
      }

      if (allResults.length === 1) {
        return { content: [{ type: 'text' as const, text: JSON.stringify(allResults[0], null, 2) }] }
      }

      const merged = {
        packages: allResults.flatMap(r => r.packages),
        nodeVersionSummary: allResults[allResults.length - 1].nodeVersionSummary,
        summary: {
          total: allResults.reduce((sum, r) => sum + r.summary.total, 0),
          deprecated: allResults.reduce((sum, r) => sum + r.summary.deprecated, 0),
          nodeIncompatible: allResults.reduce((sum, r) => sum + r.summary.nodeIncompatible, 0),
          errors: allResults.reduce((sum, r) => sum + r.summary.errors, 0),
        },
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(merged, null, 2) }] }

      function findPackageJsonDirs(dir: string, results: Array<string> = []) {
        const pkgPath = join(dir, 'package.json')
        if (existsSync(pkgPath)) results.push(dir)
        let files
        try { files = readdirSync(dir) }
        catch { return results }
        for (const file of files) {
          if (file === 'node_modules') continue
          const dirPath = join(dir, file)
          try {
            const stat = statSync(dirPath)
            if (stat.isDirectory()) findPackageJsonDirs(dirPath, results)
          }
          catch {}
        }
        return results
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
      const { execCommand } = await import('./utils/exec')
      const { isLocalPackage } = await import('./filter')

      const pkgManager = manager || 'npm'
      let dependencies: Record<string, { version: string }> = {}

      const yarnRegexp = /"((?:@[a-z][a-z0-9-_.]*\/)?[a-z][a-z0-9-_.]*)@(\d+\.\d+\.\d+(?:-[a-z0-9-]+(?:\.[a-z0-9-]+)*)?)"/g

      if (pkgManager === 'pnpm') {
        const result = JSON.parse(execCommand('pnpm list -g --depth=0 --json'))
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
        const result = JSON.parse(execCommand('npm ls -g --depth=0 --json'))
        dependencies = result.dependencies
      }

      const ignores = ignore?.split(',') || []
      const filteredDeps = Object.fromEntries(
        Object.entries(dependencies).filter(([key, { version }]) => !ignores.includes(key) && !isLocalPackage(version)),
      )

      const config = { registry: registry || '', failfast: false }
      const checkResult = await checkDependencies(filteredDeps, config, { silent: true })

      return { content: [{ type: 'text' as const, text: JSON.stringify(checkResult, null, 2) }] }
    },
  )

  server.tool(
    'check_node',
    'Check if the current Node.js version has reached End of Life.',
    {},
    async () => {
      const status = getNodeStatus()
      return { content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }] }
    },
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
