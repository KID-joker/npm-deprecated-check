# `compat` Command Design

## Overview

Add a new `compat` command to `npm-deprecated-check` that queries Node.js version compatibility for a project or a specific package based on `engines.node`. This helps users determine whether their dependencies are compatible when upgrading or downgrading to a target Node version.

## CLI Interface

```
ndc compat [--node <version>] [packageName] [--deep] [--ignore <value>] [--registry <value>]
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `[packageName]` | Optional package name. If omitted, checks the current project. | — |
| `--node <version>` | Target Node.js version (e.g. `18`, `20.11.0`). If omitted, uses the current Node version (`process.version`). | `process.version` |
| `--deep` | Deep inspection for monorepo projects (project mode only). | `false` |
| `--ignore <value>` | Comma-separated package names to ignore. | — |
| `--registry <value>` | Custom npm registry URL. | — |

### Usage Examples

```bash
# Check current project against current Node version
ndc compat

# Check current project against Node 18
ndc compat --node 18

# Check specific package against Node 20
ndc compat esbuild --node 20

# Deep check monorepo against Node 18
ndc compat --node 18 --deep

# Check specific package with current Node version
ndc compat lodash
```

## Two Modes

### Project Mode (no packageName)

When no package name is provided, the command checks all dependencies of the current project against the target Node version.

- Collects dependencies from `package.json` (same logic as `current` command)
- Resolves lockfile dependencies (npm/yarn/pnpm)
- Supports `--deep` for monorepo projects (recursively finds all `package.json` files)
- Supports `--ignore` to skip specific packages
- Reports compatible/incompatible status and compatible version ranges for each dependency
- Does NOT output deprecation information (checkDependencies still computes it, but renderCompatResult skips it)

### Package Mode (with packageName)

When a package name is provided, the command checks that specific package.

- **Without `--node`**: Checks the package's current version compatibility with the current Node version (similar to `package` command but focused on compatibility).
- **With `--node`**: Queries all versions of the package and reports the version range compatible with the target Node version.

## Core Changes

### 1. Parameterize `checkDependencies` in `check.ts`

Currently, `currentNode` is a module-level constant derived from `process.version`. The `getPackageInfo` and `findCompatibleVersion` functions implicitly use it for compatibility checks.

**Change**: Add an optional `targetNodeVersion` parameter to `checkDependencies` and propagate it to `getPackageInfo` and `findCompatibleVersion`. When not provided, fall back to `process.version` for backward compatibility.

```typescript
// Before
const currentNode = coerce(process.version)!

export async function checkDependencies(
  dependencies: Record<string, VersionOrRange>,
  config: CommonOption,
  options?: {
    dependencyTypes?: Record<string, 'production' | 'development'>
    projectEnginesNode?: string
    silent?: boolean
  },
): Promise<CheckResult>

// After
export async function checkDependencies(
  dependencies: Record<string, VersionOrRange>,
  config: CommonOption,
  options?: {
    dependencyTypes?: Record<string, 'production' | 'development'>
    projectEnginesNode?: string
    silent?: boolean
    targetNodeVersion?: string
  },
): Promise<CheckResult>
```

Inside `getPackageInfo` and `findCompatibleVersion`, replace `currentNode` with:
```typescript
const effectiveNode = coerce(options?.targetNodeVersion) || coerce(process.version)!
```

### 2. New Type: `CompatOption`

Add to `types.ts`:

```typescript
export interface CompatOption extends CommonOption {
  packageName?: string
  node?: string
  deep: boolean
  ignore: string
}
```

### 3. New File: `src/io/compat.ts`

Two internal functions:

- `checkProjectCompat(options)`: Collects project dependencies (reusing logic from `current.ts`) and calls `checkDependencies` with `targetNodeVersion`.
- `checkPackageCompat(options)`: Calls `checkDependencies` for the specified package with `targetNodeVersion`.

Both delegate rendering to `renderCompatResult`.

### 4. New Render Function: `renderCompatResult` in `render.ts`

Dedicated render function for compatibility output. Follows the same output conventions as `renderCheckResult` (using `warn`, `log`, `ok`, `error` from `../utils/console` and `ansis` for coloring). Does NOT output deprecation information.

**Project mode output** (follows existing renderCheckResult style):
```
 WARN  esbuild@0.20.0: 2024-01-15T12:00:00.000Z
Required node: >=18
Compatible version for Node v16.0.0: esbuild@0.19.12

  OK    All dependencies are compatible with Node v20.11.0.

📊 Node Version Summary:
Minimum engines.node: >=18
Target Node version: v16.0.0
 WARN  Target Node version is below the minimum requirement!
```

**Package mode**:
```
 WARN  lodash@4.17.21: 2021-02-20T12:00:00.000Z
Compatible with Node v20.11.0 (engines.node: >=6)
```

Or when incompatible:
```
 WARN  esbuild@0.20.0: 2024-01-15T12:00:00.000Z
Required node: >=18
Compatible version for Node v16.0.0: esbuild@0.19.12
```

### 5. CLI Registration in `cli.ts`

```typescript
program
  .command('compat [packageName]')
  .description('check Node.js version compatibility for project or package')
  .addOption(new Option('--node <version>', 'target Node.js version'))
  .addOption(new Option('--deep', 'deep inspection for monorepo projects'))
  .addOption(new Option('--ignore <value>', 'ignore specific packages'))
  .addOption(registryOption)
  .action((packageName?: string, option: CompatOption) => {
    checkCompat({ ...option, packageName })
  })
```

### 6. MCP Tool: `check_compat`

Add a new MCP tool to `src/mcp.ts`:

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
    // Validate inputs
    // If packageName: call checkDependencies with targetNodeVersion
    // If no packageName: collect project deps, call checkDependencies with targetNodeVersion
    // Return JSON result
  }
)
```

## Files to Modify

| File | Change |
|------|--------|
| `src/types.ts` | Add `CompatOption` interface |
| `src/check.ts` | Add `targetNodeVersion` parameter to `checkDependencies`, `getPackageInfo`, `findCompatibleVersion` |
| `src/render.ts` | Add `renderCompatResult` function |
| `src/cli.ts` | Register `compat` command |
| `src/mcp.ts` | Add `check_compat` MCP tool |

## Files to Create

| File | Purpose |
|------|---------|
| `src/io/compat.ts` | Compat command entry point (project mode + package mode) |

## Backward Compatibility

- `checkDependencies` defaults `targetNodeVersion` to `undefined`, falling back to `process.version`. All existing callers work without changes.
- The `current`, `global`, `package`, and `node` commands are unaffected.
- The MCP tools `check_package`, `check_current_project`, `check_global`, and `check_node` are unaffected.

## Edge Cases

- **Invalid Node version**: If `--node` receives an unparseable value (e.g. `--node abc`), coerce returns `null` and we fall back to `process.version` with a warning.
- **Package with no `engines.node`**: Treated as compatible with any Node version (existing behavior).
- **Package not found**: Return error message (existing behavior from `getPackageInfo`).
- **No `package.json` in current directory**: Return error message (existing behavior from `getDependenciesOfPackageJson`).
