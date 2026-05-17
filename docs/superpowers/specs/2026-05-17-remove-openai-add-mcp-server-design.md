# Design: Remove OpenAI Integration, Add MCP Server

**Date:** 2026-05-17
**Status:** Approved

## Overview

Replace the built-in OpenAI/ChatGPT recommendation feature with MCP (Model Context Protocol) Server capability. The CLI retains all core deprecation-checking functionality but no longer calls OpenAI directly. Instead, ndc exposes structured data via MCP tools, allowing external agents (Claude Desktop, OpenCode, etc.) to consume the data and provide their own recommendations.

## Motivation

- The current OpenAI integration is tightly coupled: hardcoded model list, fixed prompt, API key management burden on users.
- MCP is a better architectural fit: ndc provides factual data (what's deprecated, what versions exist), and the agent decides how to advise the user.
- Removes the dependency on a specific AI provider, making ndc a neutral data source.

## Scope

### In scope

1. Remove all OpenAI-related code, types, CLI options, config validation, and documentation.
2. Refactor `check.ts` and `io/node.ts` to separate data logic from terminal output.
3. Add MCP Server with stdio transport, exposing 4 tools.
4. Update `package.json` (dependencies, keywords) and `README.md`.

### Out of scope

- HTTP SSE transport (can be added later).
- MCP resources or prompts (only tools).
- Version bump decision (left to maintainer).

## Part 1: Remove OpenAI Code

### Files to delete

| File | Reason |
|------|--------|
| `src/chatgpt.ts` | Entire file is OpenAI request logic |

### Files to modify

| File | Change |
|------|--------|
| `src/shared.ts` | Remove `openaiModels` and `openaiBaseURL` exports. Keep `rcPath` and `getGlobalConfig`. |
| `src/types.ts` | Remove `OpenaiOption` interface. `CommonOption` no longer extends it. Remove `recommend` field from `PackageInfo`. |
| `src/cli.ts` | Remove `gptOption`, `gptModelOption`, `gptBaseURL` option definitions and all `.addOption()` calls for them. Remove `openaiModels` import. |
| `src/check.ts` | Remove `import { recommendDependencies }` and its call site (line 185). Remove `result.recommend` output block (lines 55-64). |
| `src/io/config.ts` | Remove `openaiModels` import and `openaiModel` validation logic (lines 28-31). |
| `src/io/package.ts` | Simplify destructuring — no longer need to separate openai options. |
| `src/io/global.ts` | Same simplification as `package.ts`. |
| `package.json` | Remove `"OpenAI"` and `"ai-recommend"` from keywords. |
| `README.md` | Remove all OpenAI/ChatGPT documentation sections. |

## Part 2: Refactor — Separate Data Logic from Display

### Problem

`check.ts` currently mixes data fetching with terminal output (ansis colors, spinner, console.log). MCP needs the same data but as structured JSON, not terminal text.

### Solution

Split into two layers:

- **`src/check.ts`** — Pure data layer. `checkDependencies()` returns structured results without any console/spinner side effects.
- **`src/render.ts`** — New file. CLI display layer. Takes the structured results and renders them to terminal with colors, spinner, formatting.

**Call chain after refactor:**

```
CLI path:  io/current.ts → check.ts (data) → render.ts (display)
MCP path:  mcp.ts → check.ts (data) → JSON serialization
```

### check.ts changes

- Remove imports: `ansis`, `./utils/console`, `./utils/spinner`
- `checkDependencies()` returns:

```typescript
interface CheckResult {
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
```

The `summary` field is computed inside `checkDependencies()` from the result list, so both CLI and MCP consumers have access to it.

- Remove all `log()`, `warn()`, `ok()`, `error()`, `startSpinner()`, `stopSpinner()` calls.
- Remove `process.exit(1)` for failfast — return a flag instead, let caller decide.

### render.ts (new file)

- Exports `renderCheckResult(result: CheckResult, options: { verbose?: boolean, failfast?: boolean })`.
- Contains all the ansis-colored output logic extracted from `check.ts`.
- Spinner remains inside `checkDependencies()` (it runs per-package in the loop, not once for the entire check). To avoid spinner output in MCP mode, `checkDependencies()` accepts an optional `silent?: boolean` parameter. When `silent` is true, spinner calls are skipped. CLI callers pass `silent: false` (default), MCP callers pass `silent: true`.

### io/node.ts changes

Same pattern: extract `getNodeStatus()` as a pure data function.

```typescript
interface NodeStatus {
  version: string
  majorVersion: number
  eol: boolean
  eolDate: string | null
  codename: string | null
  supported: boolean
  latestVersion: string
}
```

`render.ts` gains `renderNodeStatus(status: NodeStatus)` for CLI output.

## Part 3: MCP Server

### Entry point

`src/mcp.ts` — MCP Server implementation using `@modelcontextprotocol/sdk`.

### Startup mechanism

A `--mcp` flag on the CLI entry (`src/cli.ts`). When detected, bypass commander parsing and start the MCP Server over stdio.

```typescript
// In src/cli.ts, before program.parse():
if (process.argv.includes('--mcp')) {
  import('./mcp').then(m => m.startServer())
  // Do not call program.parse()
}
```

### Client configuration example

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

### Transport

stdio only (via `StdioServerTransport` from the SDK).

### Dependency

Add `@modelcontextprotocol/sdk` to `dependencies` in `package.json`.

### Build

No change to `build.config.ts`. The MCP code is reached through the existing `src/cli` entry via dynamic import.

## Part 4: MCP Tool Definitions

### Tool 1: `check_package`

Check if a specific npm package is deprecated.

**Input schema:**

```json
{
  "type": "object",
  "properties": {
    "packageName": { "type": "string", "description": "npm package name" },
    "range": { "type": "string", "description": "Version range, e.g. '^1.0.0'" },
    "registry": { "type": "string", "description": "Custom npm registry URL" }
  },
  "required": ["packageName"]
}
```

**Output:** Single `PackageInfo` object as JSON.

```json
{
  "name": "request",
  "version": "2.88.2",
  "time": "2020-02-11T21:48:40.285Z",
  "deprecated": "request has been deprecated, see https://github.com/request/request/issues/3142",
  "minimumUpgradeVersion": null,
  "nodeRequirement": null,
  "compatibleVersion": null
}
```

### Tool 2: `check_current_project`

Check all dependencies of the current project (reads package.json + lockfile from cwd).

**Input schema:**

```json
{
  "type": "object",
  "properties": {
    "ignore": { "type": "string", "description": "Comma-separated package names to ignore" },
    "deep": { "type": "boolean", "description": "Deep inspection for monorepo projects" },
    "registry": { "type": "string", "description": "Custom npm registry URL" }
  }
}
```

**Output:**

```json
{
  "packages": [
    {
      "name": "foo",
      "version": "1.0.0",
      "time": "2023-01-01T00:00:00.000Z",
      "deprecated": null,
      "minimumUpgradeVersion": null,
      "nodeRequirement": null,
      "compatibleVersion": null,
      "dependencyType": "production"
    }
  ],
  "nodeVersionSummary": {
    "currentNode": "v20.11.0",
    "minimumRequired": {
      "production": "18.0.0",
      "development": "16.0.0",
      "productionPackage": "foo@1.0.0",
      "developmentPackage": "bar@2.0.0"
    },
    "projectEnginesNode": ">=18"
  },
  "summary": {
    "total": 42,
    "deprecated": 2,
    "nodeIncompatible": 1,
    "errors": 0
  }
}
```

### Tool 3: `check_global`

Check globally installed packages.

**Input schema:**

```json
{
  "type": "object",
  "properties": {
    "manager": { "type": "string", "enum": ["npm", "yarn", "pnpm"], "description": "Package manager (default: npm)" },
    "ignore": { "type": "string", "description": "Comma-separated package names to ignore" },
    "registry": { "type": "string", "description": "Custom npm registry URL" }
  }
}
```

**Output:** Same structure as `check_current_project`. The `nodeVersionSummary` is included (global packages still have engine requirements), but `projectEnginesNode` will be `null` since there is no project-level `package.json`.

### Tool 4: `check_node`

Check if the current Node.js version has reached End of Life.

**Input schema:**

```json
{
  "type": "object",
  "properties": {}
}
```

**Output:**

```json
{
  "version": "20.11.0",
  "majorVersion": 20,
  "eol": false,
  "eolDate": "2026-04-30",
  "codename": "Iron",
  "supported": true,
  "latestVersion": "22.0.0"
}
```

## Part 5: Package and Documentation Updates

### package.json

- Add dependency: `@modelcontextprotocol/sdk`
- Update keywords: remove `"OpenAI"`, `"ai-recommend"`; add `"mcp"`, `"mcp-server"`
- Consider updating `description` to mention MCP support

### README.md

- Remove all OpenAI/ChatGPT sections (configuration, usage, CLI options)
- Add MCP Server section:
  - How to start: `npx npm-deprecated-check --mcp`
  - Client configuration examples (Claude Desktop, OpenCode)
  - Tool list with parameter descriptions
- Update CLI usage section to remove `--openaiKey`, `--openaiModel`, `--openaiBaseURL` options

## File Change Summary

| File | Action |
|------|--------|
| `src/chatgpt.ts` | Delete |
| `src/shared.ts` | Modify (remove openai constants) |
| `src/types.ts` | Modify (remove OpenaiOption, recommend field) |
| `src/cli.ts` | Modify (remove openai options, add --mcp flag) |
| `src/check.ts` | Modify (extract display logic, pure data return) |
| `src/render.ts` | Create (CLI display layer) |
| `src/mcp.ts` | Create (MCP Server) |
| `src/io/node.ts` | Modify (extract pure data function) |
| `src/io/config.ts` | Modify (remove openai validation) |
| `src/io/package.ts` | Modify (simplify params) |
| `src/io/global.ts` | Modify (simplify params) |
| `src/io/current.ts` | Modify (use render layer) |
| `package.json` | Modify (deps, keywords) |
| `README.md` | Modify (remove openai docs, add mcp docs) |
| `build.config.ts` | No change |
