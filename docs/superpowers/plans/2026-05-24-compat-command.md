# `compat` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `compat` command that checks Node.js version compatibility for a project or package based on `engines.node`, supporting a target Node version parameter.

**Architecture:** Parameterize the existing `checkDependencies` function in `check.ts` to accept an optional `targetNodeVersion`, then create a new `io/compat.ts` entry point that reuses the dependency collection logic from `current.ts`. Add a dedicated render function and an MCP tool.

**Tech Stack:** TypeScript, Commander.js, semver, @modelcontextprotocol/sdk, zod

---

### Task 1: Add `CompatOption` type to `types.ts`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add `CompatOption` interface**

Add the following interface after the existing `PackageOption` interface in `src/types.ts`:

```typescript
export interface CompatOption extends CommonOption {
  packageName?: string
  node?: string
  deep: boolean
  ignore: string
}
```

- [ ] **Step 2: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(compat): add CompatOption type"
```

---

### Task 2: Parameterize `checkDependencies` in `check.ts`

**Files:**
- Modify: `src/check.ts`

- [ ] **Step 1: Add `targetNodeVersion` to `checkDependencies` options**

In `src/check.ts`, update the `checkDependencies` function signature. Add `targetNodeVersion?: string` to the options parameter:

```typescript
export async function checkDependencies(
  dependencies: Record<string, VersionOrRange>,
  config: CommonOption,
  options?: {
    dependencyTypes?: Record<string, 'production' | 'development'>
    projectEnginesNode?: string
    silent?: boolean
    targetNodeVersion?: string
  },
): Promise<CheckResult> {
```

Then pass `targetNodeVersion` to `getPackageInfo`:

```typescript
const result = await getPackageInfo(packageName, dependencies[packageName], config, options?.targetNodeVersion)
```

- [ ] **Step 2: Update `getPackageInfo` to accept `targetNodeVersion`**

Change the function signature:

```typescript
async function getPackageInfo(packageName: string, versionOrRange: VersionOrRange, config: CommonOption, targetNodeVersion?: string): Promise<PackageInfo> {
```

Replace the usage of `currentNode` inside `getPackageInfo` with a local variable:

```typescript
const effectiveNode = coerce(targetNodeVersion) || currentNode
```

Then use `effectiveNode` instead of `currentNode` in the `satisfies` check and pass it to `findCompatibleVersion`:

```typescript
if (requiredNode) {
  if (satisfies(effectiveNode, requiredNode)) {
    requiredNode = undefined
  }
  else {
    compatibleVersion = findCompatibleVersion(packageRes, versionOrRange, effectiveNode)
  }
}
```

- [ ] **Step 3: Update `findCompatibleVersion` — no signature change needed**

`findCompatibleVersion` already accepts a `SemVer` parameter (`currentNode`). Since we now pass `effectiveNode` (which is also a `SemVer` from `coerce`), no changes are needed to this function.

- [ ] **Step 4: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/check.ts
git commit -m "feat(compat): parameterize checkDependencies with targetNodeVersion"
```

---

### Task 3: Create `src/io/compat.ts`

**Files:**
- Create: `src/io/compat.ts`

- [ ] **Step 1: Write the `checkCompat` function**

Create `src/io/compat.ts` with the following content:

```typescript
import type { CompatOption, VersionOrRange } from '../types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { coerce } from 'semver'
import { checkDependencies } from '../check'
import { isGitPackage, isLocalPackage, isURLPackage } from '../filter'
import { getDependenciesOfLockfile } from '../packages/lockfiles'
import { getDependenciesOfPackageJson } from '../packages/package_json'
import { renderCompatResult } from '../render'
import { error, log, warn } from '../utils/console'

export default async function checkCompat(options: CompatOption) {
  const targetNodeVersion = options.node || process.version
  const effectiveNode = coerce(targetNodeVersion)
  if (!effectiveNode) {
    warn(`Invalid Node version: "${targetNodeVersion}", falling back to current Node version (${process.version})`)
  }

  if (options.packageName) {
    await checkPackageCompat(options, targetNodeVersion)
  }
  else {
    await checkProjectCompat(options, targetNodeVersion)
  }
}

async function checkPackageCompat(options: CompatOption, targetNodeVersion: string) {
  const { packageName, node, ...restOptions } = options
  const checkOptions = { ...restOptions, failfast: false }

  const result = await checkDependencies(
    { [packageName!]: { range: undefined } },
    checkOptions,
    { silent: false, targetNodeVersion },
  )

  renderCompatResult(result, {
    targetNodeVersion,
    packageName: packageName!,
  })
}

async function checkProjectCompat(options: CompatOption, targetNodeVersion: string) {
  const currentPath = process.cwd()
  const pkgPaths = options.deep ? findPackageJsonDirs(currentPath) : [currentPath]

  for (const pkgPath of pkgPaths) {
    if (options.deep) {
      log(`> ${pkgPath}`)
    }
    const result = await checkProjectPackageJson(pkgPath, options, targetNodeVersion)
    log()
  }
}

function findPackageJsonDirs(dir: string, results: Array<string> = []) {
  const pkgPath = join(dir, 'package.json')
  if (existsSync(pkgPath)) {
    results.push(dir)
  }

  let files
  try {
    files = readdirSync(dir)
  }
  catch {
    return results
  }

  for (const file of files) {
    if (file === 'node_modules') {
      continue
    }
    const dirPath = join(dir, file)
    try {
      const stat = statSync(dirPath)
      if (stat.isDirectory()) {
        findPackageJsonDirs(dirPath, results)
      }
    }
    catch {
    }
  }

  return results
}

async function checkProjectPackageJson(pkgPath: string, options: CompatOption, targetNodeVersion: string) {
  const packageJsonPath = join(pkgPath, 'package.json')
  const dependenciesOfPackageJson = getDependenciesOfPackageJson(packageJsonPath)

  if (!dependenciesOfPackageJson)
    return

  try {
    const ignores = options.ignore?.split(',') || []

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

    const result = await checkDependencies(dependencies, { registry: options.registry, failfast: false }, {
      dependencyTypes,
      targetNodeVersion,
    })
    renderCompatResult(result, { targetNodeVersion })
    return result
  }
  catch (e: any) {
    error(e.message)
  }
}
```

- [ ] **Step 2: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: Errors about `renderCompatResult` not existing (will be fixed in Task 4)

Note: This is expected. We'll fix it in the next task. For now, just verify the rest of the file compiles correctly by temporarily commenting out the `renderCompatResult` import and calls if needed.

- [ ] **Step 3: Commit**

```bash
git add src/io/compat.ts
git commit -m "feat(compat): add io/compat.ts with project and package mode"
```

---

### Task 4: Add `renderCompatResult` to `render.ts`

**Files:**
- Modify: `src/render.ts`

- [ ] **Step 1: Add the `renderCompatResult` function**

Add the following function to `src/render.ts`. It follows the same output conventions as `renderCheckResult` (using `warn`, `log`, `ok`, `error` from `../utils/console` and `ansis` for coloring). It does NOT output deprecation information — only Node version compatibility.

```typescript
export function renderCompatResult(
  result: CheckResult,
  options?: {
    targetNodeVersion?: string
    packageName?: string
    hasNodeFlag?: boolean
  },
) {
  const { packages, hasErrors, nodeVersionSummary } = result
  const targetNode = options?.targetNodeVersion || process.version
  const targetNodeClean = coerce(targetNode)?.version || targetNode

  if (options?.packageName) {
    const pkg = packages[0]
    if (pkg?.error) {
      error(pkg.error)
      return
    }
    warn(`${pkg!.name}@${pkg!.version}: ${pkg!.time}`)
    if (pkg!.nodeRequirement) {
      if (!pkg!.requiredNode) {
        log(`${ansis.cyanBright('Compatible with Node ')}${ansis.magenta(targetNode)}${ansis.cyanBright(' (engines.node: ')}${ansis.magenta(pkg!.nodeRequirement)}${ansis.cyanBright(')')}`)
      }
      else {
        log(`${ansis.magentaBright('Required node: ')}${pkg!.requiredNode}`)
        if (pkg!.compatibleVersion) {
          log(`${ansis.cyanBright(`Compatible version for Node ${targetNodeClean}: `)}${ansis.magenta(pkg!.compatibleVersion)}`)
        }
      }
    }
    else {
      log(`${ansis.cyanBright('Compatible with Node ')}${ansis.magenta(targetNode)}${ansis.cyanBright(' (no engines.node constraint)')}`)
    }
    log()
    return
  }

  for (const pkg of packages) {
    if (pkg.error) {
      error(pkg.error)
      log()
    }

    if (pkg.requiredNode) {
      warn(`${pkg.name}@${pkg.version}: ${pkg.time}`)
      log(`${ansis.magentaBright('Required node: ')}${pkg.requiredNode}`)
      if (pkg.compatibleVersion) {
        log(`${ansis.cyanBright(`Compatible version for Node ${targetNodeClean}: `)}${ansis.magenta(pkg.compatibleVersion)}`)
      }
      log()
    }
  }

  const incompatibleCount = packages.filter(p => p.requiredNode).length
  const errorCount = packages.filter(p => p.error).length

  if (!hasErrors && incompatibleCount === 0) {
    ok(`All dependencies are compatible with Node ${targetNode}.`)
  }

  if (nodeVersionSummary) {
    const { minimumRequired } = nodeVersionSummary
    const productionMin = minimumRequired.production || minimumRequired.development

    log()

    if (productionMin) {
      log(ansis.cyanBright('📊 Node Version Summary:'))
      log(`Minimum engines.node: ${ansis.magenta(`>=${productionMin}`)}`)
      log(`Target Node version: ${ansis.magenta(targetNode)}`)

      const targetNodeSemver = coerce(targetNode)
      if (targetNodeSemver && !satisfies(targetNodeSemver, `>=${productionMin}`)) {
        warn(`Target Node version is below the minimum requirement!`)
      }
    }
  }
}
```

Also update the import at the top of `render.ts` to include `PackageInfo` if needed (check if already imported). Actually, since we removed the `PackageInfo[]` arrays and use inline filtering, no additional import is needed beyond what's already there.

- [ ] **Step 2: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/render.ts
git commit -m "feat(compat): add renderCompatResult function"
```

---

### Task 5: Register `compat` command in `cli.ts`

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Add import for `checkCompat`**

Add the import at the top of `src/cli.ts`:

```typescript
import checkCompat from './io/compat'
```

- [ ] **Step 2: Add `CompatOption` to the type import**

Update the type import line:

```typescript
import type { CommonOption, CompatOption, ConfigOption, CurrentOption, GlobalOption, PackageOption } from './types'
```

- [ ] **Step 3: Register the `compat` command**

Add the following command registration after the `package` command and before the `config` command:

```typescript
program
  .command('compat [packageName]')
  .description('check Node.js version compatibility for project or package')
  .addOption(new Option('--node <version>', 'target Node.js version'))
  .addOption(new Option('--deep', 'deep inspection for monorepo projects'))
  .addOption(new Option('--ignore <value>', 'ignore specific packages'))
  .addOption(registryOption)
  .action((packageName?: string, option: any) => {
    const compatOption: CompatOption = {
      ...option,
      packageName,
    }
    checkCompat(compatOption)
  })
```

- [ ] **Step 4: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat(compat): register compat command in CLI"
```

---

### Task 6: Add `check_compat` MCP tool to `mcp.ts`

**Files:**
- Modify: `src/mcp.ts`

- [ ] **Step 1: Add the `check_compat` MCP tool**

Add the following tool registration in `src/mcp.ts`, after the existing `check_node` tool and before the `const transport = new StdioServerTransport()` line:

```typescript
server.tool(
  'check_compat',
  'Check Node.js version compatibility for a project or package. Reports which dependencies are compatible/incompatible with a target Node version based on engines.node.',
  {
    packageName: z.string().optional().describe('npm package name. If not provided, checks the current project.'),
    nodeVersion: z.string().optional().describe('Target Node.js version (e.g. "18", "20.11.0"). Defaults to current Node version.'),
    projectPath: z.string().optional().describe('Absolute path to project root (only used when packageName is not provided)'),
    deep: z.boolean().optional().describe('Deep inspection for monorepo projects'),
    ignore: z.string().optional().describe('Comma-separated package names to ignore'),
    registry: z.string().optional().describe('Custom npm registry URL'),
  },
  async ({ packageName, nodeVersion, projectPath, deep, ignore, registry }) => {
    const regResult = validateRegistry(registry || '')
    if (regResult instanceof Error)
      return errorResult(regResult.message)

    if (packageName) {
      const nameResult = validatePackageName(packageName)
      if (nameResult instanceof Error)
        return errorResult(nameResult.message)

      try {
        const targetNodeVersion = nodeVersion || process.version
        const result = await withTimeout(
          checkDependencies(
            { [nameResult]: { range: undefined } },
            { registry: regResult, failfast: false },
            { silent: true, targetNodeVersion },
          ),
          SECURITY.FETCH_TIMEOUT_MS,
        )

        const pkg = result.packages[0]
        if (pkg?.error) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: sanitizeError(pkg.error) }, null, 2) }],
          }
        }

        const compatResult = {
          targetNodeVersion,
          packages: result.packages.map(p => ({
            name: p.name,
            version: p.version,
            compatible: !p.requiredNode,
            nodeRequirement: p.nodeRequirement || null,
            compatibleVersion: p.compatibleVersion || null,
          })),
          summary: {
            total: result.summary.total,
            incompatible: result.packages.filter(p => p.requiredNode).length,
            errors: result.summary.errors,
          },
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(compatResult, null, 2) }],
        }
      }
      catch (e) {
        return errorResult(sanitizeError(e))
      }
    }
    else {
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

        const targetNodeVersion = nodeVersion || process.version
        const pkgPaths = deep ? findPackageJsonDirs(currentPath, [], SECURITY.MAX_RECURSION_DEPTH, 0) : [currentPath]
        const allDependencies: Record<string, VersionOrRange> = {}
        const allDependencyTypes: Record<string, 'production' | 'development'> = {}

        for (const pkgPath of pkgPaths) {
          const packageJsonPath = join(pkgPath, 'package.json')
          const dependenciesOfPackageJson = getDependenciesOfPackageJson(packageJsonPath)
          if (!dependenciesOfPackageJson)
            continue

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
            targetNodeVersion,
            silent: true,
          }),
          SECURITY.FETCH_TIMEOUT_MS,
        )

        const compatResult = {
          targetNodeVersion,
          packages: result.packages.map(p => ({
            name: p.name,
            version: p.version,
            dependencyType: p.dependencyType || null,
            compatible: !p.requiredNode,
            nodeRequirement: p.nodeRequirement || null,
            compatibleVersion: p.compatibleVersion || null,
          })),
          summary: {
            total: result.summary.total,
            incompatible: result.packages.filter(p => p.requiredNode).length,
            errors: result.summary.errors,
          },
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(compatResult, null, 2) }],
        }
      }
      catch (e) {
        return errorResult(sanitizeError(e))
      }
    }
  },
)
```

- [ ] **Step 2: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/mcp.ts
git commit -m "feat(compat): add check_compat MCP tool"
```

---

### Task 7: Build and smoke test

**Files:**
- None (verification only)

- [ ] **Step 1: Build the project**

Run: `pnpm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Test `compat` command help**

Run: `node dist/cli.mjs compat --help`
Expected: Shows help text with `--node`, `--deep`, `--ignore`, `--registry` options

- [ ] **Step 3: Test `compat` project mode (current Node)**

Run: `node dist/cli.mjs compat`
Expected: Shows compatibility report for current project dependencies

- [ ] **Step 4: Test `compat` project mode (target Node)**

Run: `node dist/cli.mjs compat --node 18`
Expected: Shows compatibility report for Node 18

- [ ] **Step 5: Test `compat` package mode (current Node)**

Run: `node dist/cli.mjs compat eslint`
Expected: Shows eslint compatibility with current Node version

- [ ] **Step 6: Test `compat` package mode (target Node)**

Run: `node dist/cli.mjs compat esbuild --node 18`
Expected: Shows esbuild compatibility with Node 18

- [ ] **Step 7: Run existing tests to verify no regression**

Run: `node --test`
Expected: All existing tests pass

- [ ] **Step 8: Run lint**

Run: `pnpm run lint`
Expected: No lint errors

- [ ] **Step 9: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(compat): address build/lint issues"
```

---

### Task 8: Add tests for `compat` command

**Files:**
- Create: `test/compat.spec.js`

- [ ] **Step 1: Write tests for the `compat` command**

Create `test/compat.spec.js`:

```javascript
import assert from 'node:assert/strict'
import { exec } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cli = path.resolve(__dirname, '../dist/cli.mjs')

test('compat help', async (t) => {
  await t.test('shows compat command help', (_t, done) => {
    exec(`node ${cli} compat --help`, (_error, stdout, _stderr) => {
      assert.ok(/--node/.test(stdout), 'Expected "--node" option in help.')
      assert.ok(/--deep/.test(stdout), 'Expected "--deep" option in help.')
      assert.ok(/--ignore/.test(stdout), 'Expected "--ignore" option in help.')
      done()
    })
  })
})

test('compat package mode', async (t) => {
  await t.test('check package compatibility with current Node', (_t, done) => {
    exec(`node ${cli} compat eslint`, { timeout: 30000 }, (_error, stdout, _stderr) => {
      assert.ok(/eslint@/.test(stdout), 'Expected eslint version in output.')
      done()
    })
  })

  await t.test('check package compatibility with target Node version', (_t, done) => {
    exec(`node ${cli} compat esbuild --node 18`, { timeout: 30000 }, (_error, stdout, _stderr) => {
      assert.ok(/Node 18\./.test(stdout) || /Node v18/.test(stdout), 'Expected Node 18 in output.')
      done()
    })
  })
})

test('compat project mode', async (t) => {
  await t.test('check project compatibility with current Node', (_t, done) => {
    exec(`node ${cli} compat`, { timeout: 60000 }, (_error, stdout, _stderr) => {
      assert.ok(/compatible/.test(stdout) || /Required node/.test(stdout) || /Node Version Summary/.test(stdout), 'Expected compatibility output.')
      done()
    })
  })

  await t.test('check project compatibility with target Node version', (_t, done) => {
    exec(`node ${cli} compat --node 18`, { timeout: 60000 }, (_error, stdout, _stderr) => {
      assert.ok(/Node v?18/.test(stdout), 'Expected Node 18 in output.')
      done()
    })
  })
})
```

- [ ] **Step 2: Build and run tests**

Run: `pnpm run build && node --test test/compat.spec.js`
Expected: All tests pass

- [ ] **Step 3: Run full test suite**

Run: `node --test`
Expected: All tests pass (including existing ones)

- [ ] **Step 4: Commit**

```bash
git add test/compat.spec.js
git commit -m "test(compat): add compat command tests"
```
