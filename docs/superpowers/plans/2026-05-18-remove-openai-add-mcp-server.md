# Remove OpenAI & Add MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OpenAI/ChatGPT integration with MCP Server capability, exposing structured deprecation data via tools for external agents.

**Architecture:** Remove all OpenAI code, refactor check.ts into a pure data layer + render layer, add MCP Server with stdio transport exposing 4 tools (`check_package`, `check_current_project`, `check_global`, `check_node`). CLI retains full functionality minus AI recommendations.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, unbuild, Node.js built-in test runner

---

## File Structure

| File | Role |
|------|------|
| `src/cli.ts` | CLI entry, `--mcp` flag detection, commander setup |
| `src/check.ts` | Pure data layer: fetch package info, compute deprecation/upgrade/node compat |
| `src/render.ts` | CLI display layer: colored terminal output from CheckResult |
| `src/mcp.ts` | MCP Server: tool registration, stdio transport |
| `src/types.ts` | Shared TypeScript types (CheckResult, NodeStatus, PackageInfo, etc.) |
| `src/shared.ts` | Config helpers (rcPath, getGlobalConfig) |
| `src/io/node.ts` | Node EOL data function + CLI render call |
| `src/io/current.ts` | CLI handler for `ndc current` |
| `src/io/global.ts` | CLI handler for `ndc global` |
| `src/io/package.ts` | CLI handler for `ndc package` |
| `src/io/config.ts` | CLI handler for `ndc config` |

---

### Task 1: Remove OpenAI Code

**Files:**
- Delete: `src/chatgpt.ts`
- Modify: `src/shared.ts`
- Modify: `src/types.ts`
- Modify: `src/check.ts`
- Modify: `src/cli.ts`
- Modify: `src/io/config.ts`
- Modify: `src/io/package.ts`
- Modify: `src/io/global.ts`
- Modify: `package.json`

- [ ] **Step 1: Delete `src/chatgpt.ts`**

```bash
rm src/chatgpt.ts
```

- [ ] **Step 2: Clean `src/shared.ts`**

Replace the entire file with:

```typescript
import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const homedir = os.homedir()

export const rcPath = path.resolve(homedir, '.ndcrc')

export function getGlobalConfig() {
  try {
    const data = readFileSync(rcPath, 'utf-8')
    return JSON.parse(data) || {}
  }
  catch {
    return {}
  }
}
```

- [ ] **Step 3: Clean `src/types.ts`**

Replace the entire file with:

```typescript
export interface CommonOption {
  registry: string
  failfast: boolean
}

export interface CurrentOption extends CommonOption {
  ignore: string
  deep: boolean
  verbose: boolean
}

export interface GlobalOption extends CommonOption {
  manager: string
  ignore: string
}

export interface PackageOption extends CommonOption {
  packageName: string
  range?: string
}

export interface ConfigOption {
  get?: string
  set?: Array<string>
  delete?: string
  list?: boolean
}

export interface PackageInfo {
  name: string
  version?: string
  time?: string
  deprecated?: string | undefined
  error?: string
  minimumUpgradeVersion?: string | null
  requiredNode?: string
  compatibleVersion?: string | null
  nodeRequirement?: string
  dependencyType?: 'production' | 'development'
}

export interface PackageVersions {
  'name': string
  'time': Record<string, string>
  'dist-tags': Record<string, string>
  'versions': {
    [version: string]: {
      name: string
      version: string
      deprecated?: string
      engines?: {
        node?: string
      }
    }
  }
}

export interface VersionOrRange {
  version?: string
  range?: string
}

export interface CheckResult {
  packages: PackageInfo[]
  hasDeprecated: boolean
  hasErrors: boolean
  nodeVersionSummary: {
    currentNode: string
    minimumRequired: {
      production: string | null
      development: string | null
      productionPackage: string | null
      developmentPackage: string | null
    }
    projectEnginesNode?: string
  } | null
  summary: {
    total: number
    deprecated: number
    nodeIncompatible: number
    errors: number
  }
}

export interface NodeStatus {
  version: string
  majorVersion: number
  eol: boolean
  eolDate: string | null
  codename: string | null
  supported: boolean
  latestVersion: string
}
```

- [ ] **Step 4: Remove OpenAI from `src/check.ts`**

Remove line 6 (`import { recommendDependencies } from './chatgpt'`).

In `getPackageInfo` function, replace line 185:
```typescript
const recommend = deprecated ? await recommendDependencies(packageRes.name, config) : null
```
with nothing (delete the line).

In the `packageInfo` object (lines 213-224), remove the `recommend` field. The object becomes:
```typescript
  const packageInfo: PackageInfo = {
    name: packageRes.name,
    version,
    time: packageRes.time[version],
    deprecated,
    minimumUpgradeVersion,
    requiredNode,
    compatibleVersion,
    nodeRequirement,
  }
```

Remove the `result.recommend` output block (lines 55-64):
```typescript
      if (result.recommend) {
        log(ansis.greenBright('Recommended: '))
        if (Array.isArray(result.recommend)) {
          for (const packageName of result.recommend)
            log(`[${ansis.magenta(packageName)}](https://www.npmjs.com/package/${packageName})`)
        }
        else {
          log(result.recommend)
        }
      }
```

- [ ] **Step 5: Remove OpenAI options from `src/cli.ts`**

Remove the import of `openaiModels` from `./shared` (line 11).

Remove these three option definitions (lines 16-18):
```typescript
const gptOption = new Option('--openaiKey <value>', 'recommend alternative packages via ChatGPT')
const gptModelOption = new Option('--openaiModel <value>', 'ChatGPT model').choices(openaiModels)
const gptBaseURL = new Option('--openaiBaseURL <value>', 'override the default base URL for the API')
```

Remove all `.addOption(gptOption)`, `.addOption(gptModelOption)`, `.addOption(gptBaseURL)` calls from the `current`, `global`, and `package` commands.

- [ ] **Step 6: Clean `src/io/config.ts`**

Remove the import of `openaiModels` from `../shared` (line 5 partial).

Remove the openaiModel validation block (lines 28-31):
```typescript
    if (path === 'openaiModel' && !openaiModels.includes(value)) {
      error(`error: option '--openaiModel <value>' argument '${value}' is invalid. Allowed choices are ${openaiModels.join(', ')}.`)
      process.exit(1)
    }
```

- [ ] **Step 7: Simplify `src/io/package.ts`**

The destructuring currently separates openai options. Since `CommonOption` no longer has openai fields after Step 3, simplify to:

```typescript
import type { PackageOption } from '../types'
import { checkDependencies } from '../check'

export default function checkSpecified(options: PackageOption) {
  const { packageName, range, ...checkOptions } = options
  return checkDependencies({ [packageName]: { range } }, checkOptions)
}
```

- [ ] **Step 8: Simplify `src/io/global.ts`**

In the destructuring at line 10, change:
```typescript
const { manager, ...openaiOptions } = options
```
to:
```typescript
const { manager, ignore, ...checkOptions } = options
```

Update the `checkDependencies` call (line 34) to pass `checkOptions` instead of `openaiOptions`. Note: At this stage `checkDependencies` still uses the old positional signature — this will be updated in Task 2.

- [ ] **Step 9: Update `package.json` keywords**

Remove `"OpenAI"` and `"ai-recommend"` from the keywords array.

- [ ] **Step 10: Run tests to verify nothing is broken**

```bash
node --run build && node --run test
```

Expected: All existing tests pass. Build succeeds without import errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: remove all OpenAI/ChatGPT integration code"
```

---

### Task 2: Refactor check.ts — Separate Data from Display

**Files:**
- Modify: `src/check.ts`
- Create: `src/render.ts`
- Modify: `src/io/current.ts`
- Modify: `src/io/global.ts`
- Modify: `src/io/package.ts`

- [ ] **Step 1: Rewrite `src/check.ts` as pure data layer**

Replace the entire file with:

```typescript
import type { SemVer } from 'semver'
import type { CheckResult, CommonOption, PackageInfo, PackageVersions, VersionOrRange } from './types'
import process from 'node:process'
import { coerce, maxSatisfying, minVersion, satisfies, sort } from 'semver'
import { getGlobalConfig } from './shared'
import { getRegistry } from './utils/exec'
import { startSpinner, stopSpinner } from './utils/spinner'

const globalConfig = getGlobalConfig()
const currentNode = coerce(process.version)!

export async function checkDependencies(
  dependencies: Record<string, VersionOrRange>,
  config: CommonOption,
  options?: {
    dependencyTypes?: Record<string, 'production' | 'development'>
    projectEnginesNode?: string
    silent?: boolean
  },
): Promise<CheckResult> {
  const packageList = Object.keys(dependencies)
  const resultList: PackageInfo[] = []
  let hasDeprecated = false
  let hasErrors = false
  const silent = options?.silent ?? false

  for (const packageName of packageList) {
    if (!silent) startSpinner()
    const result = await getPackageInfo(packageName, dependencies[packageName], config)
    if (options?.dependencyTypes && options.dependencyTypes[packageName]) {
      result.dependencyType = options.dependencyTypes[packageName]
    }
    if (!silent) stopSpinner()
    resultList.push(result)

    if (result.error) {
      hasErrors = true
    }
    if (result.deprecated || result.requiredNode) {
      hasDeprecated = true
    }
  }

  // Calculate minimum required Node version
  const minRequiredNode = calculateMinimumNodeVersion(resultList)
  const nodeVersionSummary = (minRequiredNode.production || minRequiredNode.development)
    ? {
        currentNode: process.version,
        minimumRequired: minRequiredNode,
        projectEnginesNode: options?.projectEnginesNode,
      }
    : null

  // Compute summary
  const summary = {
    total: resultList.length,
    deprecated: resultList.filter(r => r.deprecated).length,
    nodeIncompatible: resultList.filter(r => r.requiredNode).length,
    errors: resultList.filter(r => r.error).length,
  }

  return {
    packages: resultList,
    hasDeprecated,
    hasErrors,
    nodeVersionSummary,
    summary,
  }
}

async function getPackageInfo(packageName: string, versionOrRange: VersionOrRange, config: CommonOption): Promise<PackageInfo> {
  let packageRes
  try {
    const registry = config.registry || globalConfig.registry || getRegistry()
    const _registry = registry.endsWith('/') ? registry : `${registry}/`
    const response = await fetch(_registry + packageName)
    packageRes = await response.json() as PackageVersions

    if (!packageRes)
      return { name: packageName, error: `${packageName}: Could not find the package!` }
  }
  catch (e: any) {
    return { name: packageName, error: `${packageName}: ${e.message}` }
  }

  if (!packageRes['dist-tags'])
    return { name: packageName, error: `${packageName}: Could not find the package!` }

  const version: string | null = versionOrRange.version || (versionOrRange.range
    ? packageRes['dist-tags'][versionOrRange.range] || maxSatisfying(Object.keys(packageRes.versions), versionOrRange.range || '*') || null
    : packageRes['dist-tags'].latest
      ? packageRes['dist-tags'].latest
      : null)

  if (!version || !packageRes.versions[version])
    return { name: packageName, error: `${packageName}: Please enter the correct range!` }

  const deprecated = packageRes.versions[version].deprecated

  let minimumUpgradeVersion: string | null = null
  if (deprecated) {
    const versions = sort(Object.keys(packageRes.versions))
    for (let i = versions.indexOf(version); i < versions.length; i++) {
      const ver = versions[i]
      if (!packageRes.versions[ver].deprecated) {
        minimumUpgradeVersion = ver
        break
      }
    }
  }

  const nodeRequirement = packageRes.versions[version]?.engines?.node
  let requiredNode = nodeRequirement
  let compatibleVersion: string | null = null

  if (requiredNode) {
    if (satisfies(currentNode, requiredNode)) {
      requiredNode = undefined
    }
    else {
      compatibleVersion = findCompatibleVersion(packageRes, versionOrRange, currentNode)
    }
  }

  const packageInfo: PackageInfo = {
    name: packageRes.name,
    version,
    time: packageRes.time[version],
    deprecated,
    minimumUpgradeVersion,
    requiredNode,
    compatibleVersion,
    nodeRequirement,
  }

  return packageInfo
}

function findCompatibleVersion(packageRes: PackageVersions, versionOrRange: VersionOrRange, currentNode: SemVer): string | null {
  const versions = sort(Object.keys(packageRes.versions)).reverse()

  for (const ver of versions) {
    const versionData = packageRes.versions[ver]
    const nodeRequirement = versionData.engines?.node

    if (versionData.deprecated)
      continue

    if (!nodeRequirement)
      return ver

    if (satisfies(currentNode, nodeRequirement)) {
      if (versionOrRange.range) {
        if (satisfies(ver, versionOrRange.range))
          return ver
      }
      else {
        return ver
      }
    }
  }

  return null
}

function calculateMinimumNodeVersion(results: PackageInfo[]): {
  production: string | null
  development: string | null
  productionPackage: string | null
  developmentPackage: string | null
} {
  const productionRequirements: Array<{ requirement: string, package: string }> = []
  const developmentRequirements: Array<{ requirement: string, package: string }> = []

  for (const result of results) {
    if (result.nodeRequirement) {
      const pkgInfo = { requirement: result.nodeRequirement, package: `${result.name}@${result.version}` }
      if (result.dependencyType === 'production') {
        productionRequirements.push(pkgInfo)
      }
      else if (result.dependencyType === 'development') {
        developmentRequirements.push(pkgInfo)
      }
      else {
        productionRequirements.push(pkgInfo)
        developmentRequirements.push(pkgInfo)
      }
    }
  }

  const productionResult = findHighestMinimum(productionRequirements)
  const developmentResult = findHighestMinimum(developmentRequirements)

  return {
    production: productionResult.version,
    development: developmentResult.version,
    productionPackage: productionResult.package,
    developmentPackage: developmentResult.package,
  }
}

function findHighestMinimum(requirements: Array<{ requirement: string, package: string }>): { version: string | null, package: string | null } {
  if (requirements.length === 0)
    return { version: null, package: null }

  let highestMin: SemVer | null = null
  let highestPackage: string | null = null

  for (const { requirement, package: pkg } of requirements) {
    const min = minVersion(requirement)
    if (min) {
      if (!highestMin || min.compare(highestMin) > 0) {
        highestMin = min
        highestPackage = pkg
      }
    }
  }

  return { version: highestMin?.version || null, package: highestPackage }
}
```

- [ ] **Step 2: Create `src/render.ts`**

Create the file with:

```typescript
import type { CheckResult, NodeStatus } from './types'
import process from 'node:process'
import ansis from 'ansis'
import { coerce, minVersion, satisfies } from 'semver'
import { error, log, ok, warn } from './utils/console'

export function renderCheckResult(result: CheckResult, options?: { verbose?: boolean, failfast?: boolean }) {
  const { packages, hasDeprecated, hasErrors, nodeVersionSummary } = result

  for (const pkg of packages) {
    if (pkg.error) {
      error(pkg.error)
      log()
    }

    if (pkg.deprecated || pkg.requiredNode) {
      warn(`${pkg.name}@${pkg.version}: ${pkg.time}`)
      if (pkg.deprecated)
        log(`${ansis.yellowBright('Deprecated: ')}${pkg.deprecated}`)
      if (pkg.requiredNode) {
        log(`${ansis.magentaBright('Required node: ')}${pkg.requiredNode}`)
        if (pkg.compatibleVersion) {
          log(`${ansis.cyanBright('Compatible version for current Node: ')}${ansis.magenta(pkg.compatibleVersion)}`)
        }
      }

      if (pkg.deprecated) {
        if (pkg.minimumUpgradeVersion) {
          log(ansis.greenBright('Minimum upgrade version: '))
          log(`[${ansis.magenta(pkg.minimumUpgradeVersion)}](https://www.npmjs.com/package/${pkg.name}/v/${pkg.minimumUpgradeVersion})`)
        }
        else {
          log(ansis.yellowBright(`Since v${pkg.version}, there are no upgradable versions.`))
        }
      }
      log()

      if (options?.failfast) {
        process.exit(1)
      }
    }
  }

  if (!hasErrors)
    ok(`All dependencies retrieved successfully.${hasDeprecated ? '' : ' There are no deprecated dependencies.'}`)

  // Node version summary
  if (nodeVersionSummary) {
    const { minimumRequired, projectEnginesNode } = nodeVersionSummary
    const productionMin = minimumRequired.production || minimumRequired.development

    log()

    if (!options?.verbose) {
      if (productionMin) {
        log(ansis.cyanBright('📊 Node Version Summary:'))
        log(`Minimum engines.node: ${ansis.magenta(`>=${productionMin}`)}`)

        if (projectEnginesNode) {
          const projectMinVersion = minVersion(projectEnginesNode)
          const requiredMinVersion = coerce(productionMin)

          if (projectMinVersion && requiredMinVersion && projectMinVersion.compare(requiredMinVersion) < 0) {
            log()
            warn(`Recommendation: Update package.json engines.node to ">=${productionMin}"`)
            log(`  Current: ${ansis.cyan(projectEnginesNode)}`)
          }
        }
      }
    }
    else {
      log(ansis.cyanBright('📊 Node Version Summary (detailed):'))

      if (minimumRequired.production === minimumRequired.development) {
        log(`Minimum Node version required: ${ansis.magenta(minimumRequired.production || minimumRequired.development)} (same for production and development)`)
        if (minimumRequired.productionPackage) {
          log(`  ${ansis.dim('Determined by:')} ${ansis.cyan(minimumRequired.productionPackage)}`)
        }
      }
      else {
        if (minimumRequired.production) {
          log(`Minimum Node version (production): ${ansis.magenta(minimumRequired.production)}`)
          if (minimumRequired.productionPackage) {
            log(`  ${ansis.dim('Determined by:')} ${ansis.cyan(minimumRequired.productionPackage)}`)
          }
        }
        if (minimumRequired.development) {
          log(`Minimum Node version (development): ${ansis.magenta(minimumRequired.development)}`)
          if (minimumRequired.developmentPackage) {
            log(`  ${ansis.dim('Determined by:')} ${ansis.cyan(minimumRequired.developmentPackage)}`)
          }
        }
      }

      log(`Current Node version: ${ansis.magenta(process.version)}`)

      if (projectEnginesNode) {
        log(`Project engines.node: ${ansis.cyan(projectEnginesNode)}`)

        if (productionMin) {
          const projectMinVersion = minVersion(projectEnginesNode)
          const requiredMinVersion = coerce(productionMin)

          if (projectMinVersion && requiredMinVersion && projectMinVersion.compare(requiredMinVersion) < 0) {
            log()
            warn(`Production dependencies require Node >=${productionMin}, but package.json allows ${projectEnginesNode}`)
            log(`  ${ansis.yellowBright(`Consider updating engines.node to ">=${productionMin}"`)}`)
          }
        }
      }
    }

    const currentNode = coerce(process.version)!
    const requiredVersion = minimumRequired.production || minimumRequired.development
    if (requiredVersion && !satisfies(currentNode, `>=${requiredVersion}`)) {
      warn(`Your Node version is below the minimum requirement!`)
    }
  }
}

export function renderNodeStatus(status: NodeStatus) {
  if (status.supported && status.eolDate) {
    ok(`Your node version (${status.version}) is supported until ${status.eolDate}.`)
  }
  else if (status.supported && !status.eolDate) {
    // Version is higher than the latest known release
    warn(`Your node version (${status.version}) is higher than the latest version ${status.latestVersion}. Please update 'npm-deprecated-check'.`)
  }
  else if (status.eol) {
    warn(`Your node version (${status.version}) is no longer supported since ${status.eolDate}.`)
  }
  else {
    warn(`Your node version (${status.version}) can't be found in the release schedule. Please update 'npm-deprecated-check'.`)
  }
}
```

- [ ] **Step 3: Refactor `src/io/node.ts`**

Replace the entire file with:

```typescript
import type { NodeStatus } from '../types'
import process from 'node:process'
import { coerce, gt, major } from 'semver'
import nodeReleases from '../schedule.json' assert { type: 'json' }
import { renderNodeStatus } from '../render'

interface VersionInfo {
  start: string
  lts?: string
  maintenance?: string
  end: string
  codename?: string
}

function getLatestNodeVersion(releases: Record<string, VersionInfo>) {
  const versions = Object.keys(releases)
  const latestVersion = versions.reduce((_prev, _curr) => {
    const prev = coerce(_prev)!
    const curr = coerce(_curr)!
    return gt(curr, prev) ? _curr : _prev
  })
  return latestVersion
}

export function getNodeStatus(): NodeStatus {
  const nodeVersion = coerce(process.version)!
  const latestNodeVersion = coerce(getLatestNodeVersion(nodeReleases))!
  const nodeVersionData = nodeReleases[`v${major(nodeVersion)}` as keyof typeof nodeReleases]

  if (nodeVersionData) {
    const endDate = new Date(nodeVersionData.end)
    const currentDate = new Date()
    const isSupported = currentDate < endDate

    return {
      version: nodeVersion.version,
      majorVersion: major(nodeVersion),
      eol: !isSupported,
      eolDate: nodeVersionData.end,
      codename: nodeVersionData.codename || null,
      supported: isSupported,
      latestVersion: latestNodeVersion.version,
    }
  }
  else if (gt(nodeVersion, latestNodeVersion)) {
    return {
      version: nodeVersion.version,
      majorVersion: major(nodeVersion),
      eol: false,
      eolDate: null,
      codename: null,
      supported: true,
      latestVersion: latestNodeVersion.version,
    }
  }
  else {
    return {
      version: nodeVersion.version,
      majorVersion: major(nodeVersion),
      eol: false,
      eolDate: null,
      codename: null,
      supported: false,
      latestVersion: latestNodeVersion.version,
    }
  }
}

export default function checkNode() {
  const status = getNodeStatus()
  renderNodeStatus(status)
  return status
}
```

- [ ] **Step 4: Update `src/io/current.ts`**

Replace the file with:

```typescript
import type { CurrentOption, VersionOrRange } from '../types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { checkDependencies } from '../check'
import { isGitPackage, isLocalPackage, isURLPackage } from '../filter'
import { getDependenciesOfLockfile } from '../packages/lockfiles'
import { getDependenciesOfPackageJson } from '../packages/package_json'
import { renderCheckResult } from '../render'
import { error, log } from '../utils/console'

export default async function checkCurrent(options: CurrentOption) {
  const currentPath = process.cwd()
  const pkgPaths = options.deep ? findPackageJsonDirs(currentPath) : [currentPath]
  for (const pkgPath of pkgPaths) {
    if (options.deep) {
      log(`> ${pkgPath}`)
    }
    await checkCurrentPackageJson(pkgPath, options)
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

async function checkCurrentPackageJson(pkgPath: string, options: CurrentOption) {
  const packageJsonPath = join(pkgPath, 'package.json')
  const dependenciesOfPackageJson = getDependenciesOfPackageJson(packageJsonPath)

  if (!dependenciesOfPackageJson)
    return

  let projectEnginesNode: string | undefined
  try {
    const packageJsonContent = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    projectEnginesNode = packageJsonContent.engines?.node
  }
  catch {
  }

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

    const result = await checkDependencies(dependencies, options, {
      dependencyTypes,
      projectEnginesNode,
    })
    renderCheckResult(result, { verbose: options.verbose, failfast: options.failfast })
    return result
  }
  catch (e: any) {
    error(e.message)
  }
}
```

- [ ] **Step 5: Update `src/io/global.ts`**

Replace the file with:

```typescript
import type { GlobalOption } from '../types'
import { checkDependencies } from '../check'
import { isLocalPackage } from '../filter'
import { renderCheckResult } from '../render'
import { error } from '../utils/console'
import { execCommand } from '../utils/exec'

const yarnRegexp = /"((?:@[a-z][a-z0-9-_.]*\/)?[a-z][a-z0-9-_.]*)@(\d+\.\d+\.\d+(?:-[a-z0-9-]+(?:\.[a-z0-9-]+)*)?)"/g

export default async function checkGlobal(options: GlobalOption) {
  const { manager, ignore, ...checkOptions } = options
  try {
    let dependencies: Record<string, { version: string }> = {}
    if (manager === 'pnpm') {
      const result = JSON.parse(execCommand('pnpm list -g --depth=0 --json'))
      dependencies = result
        .map((ele: { dependencies?: object }) => ele.dependencies)
        .reduce((previousValue: object, currentValue?: object) => Object.assign(previousValue, currentValue), {})
    }
    else if (manager === 'yarn') {
      const result = execCommand('yarn global list --depth=0')
      const iterator = Array.from(result.matchAll(yarnRegexp), (m: string[]) => [m[1], m[2]])
      for (const dependency of iterator) {
        const [packageName, version] = dependency
        dependencies[packageName] = { version }
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

    const result = await checkDependencies(filteredDeps, checkOptions)
    renderCheckResult(result, { failfast: checkOptions.failfast })
    return result
  }
  catch (e: any) {
    error(e.message)
  }
}
```

- [ ] **Step 6: Update `src/io/package.ts`**

Replace the file with:

```typescript
import type { PackageOption } from '../types'
import { checkDependencies } from '../check'
import { renderCheckResult } from '../render'

export default async function checkSpecified(options: PackageOption) {
  const { packageName, range, ...checkOptions } = options
  const result = await checkDependencies({ [packageName]: { range } }, checkOptions)
  renderCheckResult(result, { failfast: checkOptions.failfast })
  return result
}
```

- [ ] **Step 7: Run tests and typecheck**

```bash
node --run typecheck && node --run test
```

Expected: Type checking passes. All tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: separate check.ts into data layer + render layer"
```

---

### Task 3: Refactor io/node.ts — Extract Pure Data Function

This was already done in Task 2 Step 3. This task is a verification step.

- [ ] **Step 1: Verify `getNodeStatus()` is exported and works**

Run a quick check:
```bash
npx tsx -e "import { getNodeStatus } from './src/io/node'; console.log(JSON.stringify(getNodeStatus(), null, 2))"
```

Expected: Prints a JSON object with `version`, `majorVersion`, `eol`, `eolDate`, `codename`, `supported`, `latestVersion` fields.

- [ ] **Step 2: Verify CLI node command still works**

```bash
npx tsx src/cli.ts node
```

Expected: Prints colored node version status message (e.g., "Your node version (X.X.X) is supported until YYYY-MM-DD.").

---

### Task 4: Add MCP Server

**Files:**
- Create: `src/mcp.ts`
- Modify: `src/cli.ts`
- Modify: `package.json`

- [ ] **Step 1: Install `@modelcontextprotocol/sdk` and `zod`**

```bash
pnpm add @modelcontextprotocol/sdk zod
```

Note: `zod` is used by MCP SDK's `server.tool()` for input schema validation.

- [ ] **Step 2: Create `src/mcp.ts`**

```typescript
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

  // Tool 1: check_package
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
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(pkg, null, 2) }],
      }
    },
  )

  // Tool 2: check_current_project
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
      const process = await import('node:process')
      const { isGitPackage, isLocalPackage, isURLPackage } = await import('./filter')
      const { getDependenciesOfLockfile } = await import('./packages/lockfiles')
      const { getDependenciesOfPackageJson } = await import('./packages/package_json')

      const currentPath = process.cwd()
      const pkgPaths = deep ? findPackageJsonDirs(currentPath) : [currentPath]
      const allResults: any[] = []

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
        const npmDependencies: Record<string, any> = {}
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

      // Merge results if multiple paths (monorepo)
      if (allResults.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ packages: [], nodeVersionSummary: null, summary: { total: 0, deprecated: 0, nodeIncompatible: 0, errors: 0 } }, null, 2) }] }
      }

      if (allResults.length === 1) {
        return { content: [{ type: 'text' as const, text: JSON.stringify(allResults[0], null, 2) }] }
      }

      // Merge multiple results for monorepo
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

  // Tool 3: check_global
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

  // Tool 4: check_node
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
```

- [ ] **Step 3: Add `--mcp` flag handling in `src/cli.ts`**

At the top of the file, before `program.parse(process.argv)` (which is at the end), add:

```typescript
if (process.argv.includes('--mcp')) {
  import('./mcp').then(m => m.startServer())
}
else {
  program.parse(process.argv)
}
```

And remove the existing `program.parse(process.argv)` at line 102.

- [ ] **Step 4: Update `package.json` keywords**

Add `"mcp"` and `"mcp-server"` to the keywords array. The keywords should become:
```json
"keywords": [
  "cli",
  "cli-tool",
  "dependencies",
  "deprecated",
  "mcp",
  "mcp-server"
]
```

- [ ] **Step 5: Run typecheck**

```bash
node --run typecheck
```

Expected: No type errors.

- [ ] **Step 6: Build and verify**

```bash
node --run build
```

Expected: Build succeeds.

- [ ] **Step 7: Test MCP server starts**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npx tsx src/cli.ts --mcp
```

Expected: Returns a JSON-RPC response with server info (name: "npm-deprecated-check").

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add MCP Server with stdio transport and 4 tools"
```

---

### Task 5: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite README.md**

Replace the entire file with:

```markdown
<h1 align="center">npm-deprecated-check</h1>
<p align="center">Check for deprecated packages</p>

## Preview

<p align="center"><img src="./assets/preview.png" /></p>

## Requirements

Since version 1.4.0, `npm-deprecated-check` requires Node.js 18 or higher.

## Install

```bash
npm install -g npm-deprecated-check
```

## Features

- Check the packages of current project, global or specified is deprecated.
- According to the version range of lockfile and package.json.
- Additionally checks if the running node version reached End Of Life.
- Return the minimum upgradable version.
- Check if the current environment meets the Node.js version range required for dependency operation.
- Calculate the minimum Node.js version required across all dependencies.
- Suggest compatible dependency versions when Node.js version requirements are not met.
- MCP Server support: expose tools for external AI agents to consume deprecation data.

## Node.js Version Compatibility

The tool automatically analyzes Node.js version requirements across all dependencies and provides helpful information.

### Default Output

By default, you get a concise summary showing the recommended engines.node value:

```
Node Version Summary:
Minimum engines.node: >=20.0.0

Recommendation: Update package.json engines.node to ">=20.0.0"
   Current: >=18.12
```

### Detailed Output (--verbose)

Use the `--verbose` flag for detailed information:

```bash
ndc current --verbose
```

```
Node Version Summary (detailed):
Minimum Node version (production): 20.0.0
  Determined by: eslint@9.35.0
Minimum Node version (development): 20.17.0
  Determined by: typescript@5.7.2
Current Node version: v25.4.0
Project engines.node: >=18.12

Production dependencies require Node >=20.0.0, but package.json allows >=18.12
   Consider updating engines.node to ">=20.0.0"
```

### Compatible Version Suggestions

When a dependency requires a newer Node.js version than you're currently running, the tool suggests a compatible alternative version:

```
WARN  eslint@9.35.0: 2024-10-05T18:45:12.345Z
Required node: ^18.18.0 || ^20.9.0 || >=21.1.0
Compatible version for current Node: 8.57.1
```

## Usage

```bash
Usage: ndc <command> [options]

Options:
  -V, --version                    output the version number
  -h, --help                       display help for command

Commands:
  current [options]                check the packages of the current project
  global [options]                 check global packages, default: npm
  package [options] <packageName>  check for specified package
  node                             check if used node version is deprecated (reached End Of Life)
  config [options]                 inspect and modify the config
  help [command]                   display help for command
```

For `current`:

```bash
Options:
  --registry <value>        specify registry URL, default: https://registry.npmjs.org/
  --ignore <value>          ignore specific packages, example: request,tslint
  --failfast                exit the program if it has been deprecated
  --deep                    deep inspection for monorepo projects
  --verbose                 show detailed Node version compatibility information
```

For `global`:

```bash
Options:
  -m, --manager <value>      check specified package manager (choices: "npm", "yarn", "pnpm")
  --registry <value>        specify registry URL, default: https://registry.npmjs.org/
  --ignore <value>          ignore specific packages, example: request,tslint
  --failfast                exit the program if it has been deprecated
```

For `package`:

```bash
Options:
  -r, --range <value>       check specified versions
  --registry <value>        specify registry URL, default: https://registry.npmjs.org/
  --failfast                exit the program if it has been deprecated
```

You can also save options to global configuration:

```bash
Usage: ndc config [options]

inspect and modify the config

Options:
  -g, --get <path>          get value from option
  -s, --set <path> <value>  set option value
  -d, --delete <path>       delete option from config
  -l, --list                list all options
```

## MCP Server

`npm-deprecated-check` can run as an MCP (Model Context Protocol) Server, exposing its checking capabilities as tools for AI agents.

### Start the MCP Server

```bash
npx npm-deprecated-check --mcp
```

### Client Configuration

**Claude Desktop / OpenCode:**

```json
{
  "mcpServers": {
    "npm-deprecated-check": {
      "command": "npx",
      "args": ["npm-deprecated-check", "--mcp"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `check_package` | Check if a specific npm package is deprecated |
| `check_current_project` | Check all dependencies of the current project |
| `check_global` | Check globally installed packages |
| `check_node` | Check if the current Node.js version has reached EOL |

All tools return structured JSON data. The AI agent can use this data to provide recommendations, suggest alternatives, or generate reports.

### Tool Parameters

**check_package:**
- `packageName` (required) — npm package name
- `range` (optional) — version range, e.g. `"^1.0.0"`
- `registry` (optional) — custom npm registry URL

**check_current_project:**
- `ignore` (optional) — comma-separated package names to ignore
- `deep` (optional) — deep inspection for monorepo projects
- `registry` (optional) — custom npm registry URL

**check_global:**
- `manager` (optional) — package manager: `"npm"`, `"yarn"`, or `"pnpm"` (default: `"npm"`)
- `ignore` (optional) — comma-separated package names to ignore
- `registry` (optional) — custom npm registry URL

**check_node:** No parameters.

## Credits

`npm-deprecated-check` is inspired by [`check-is-deprecated`](https://github.com/awesome-cli/check-is-deprecated).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README - remove OpenAI docs, add MCP Server docs"
```

---

### Task 6: Run Full Test Suite and Build

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

```bash
node --run typecheck
```

Expected: No errors.

- [ ] **Step 2: Run tests**

```bash
node --run test
```

Expected: All tests pass.

- [ ] **Step 3: Run build**

```bash
node --run build
```

Expected: Build completes successfully.

- [ ] **Step 4: Verify built CLI works**

```bash
node dist/cli.mjs node
```

Expected: Prints node version support status.

- [ ] **Step 5: Verify built MCP starts**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/cli.mjs --mcp
```

Expected: Returns JSON-RPC initialize response.

- [ ] **Step 6: Fix any issues found**

If any step above fails, fix the issue and re-run.

- [ ] **Step 7: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
