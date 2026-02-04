<h1 align="center">🐦 npm-deprecated-check</h1>
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
- Recommend alternative packages through OpenAI.
- Additionally checks if the running node version reached End Of Life.
- Return the minimum upgradable version.
- Check if the current environment meets the Node.js version range required for dependency operation.
- Calculate the minimum Node.js version required across all dependencies.
- Suggest compatible dependency versions when Node.js version requirements are not met.

## Node.js Version Compatibility

The tool automatically analyzes Node.js version requirements across all dependencies and provides helpful information.

### Default Output

By default, you get a concise summary showing the recommended engines.node value:

```
📊 Node Version Summary:
Minimum engines.node: >=20.0.0

⚠️  Recommendation: Update package.json engines.node to ">=20.0.0"
   Current: >=18.12
```

### Detailed Output (--verbose)

Use the `--verbose` flag for detailed information:

```bash
ndc current --verbose
```

```
📊 Node Version Summary (detailed):
Minimum Node version (production): 20.0.0
  Determined by: eslint@9.35.0
Minimum Node version (development): 20.17.0
  Determined by: typescript@5.7.2
Current Node version: v25.4.0
Project engines.node: >=18.12

⚠️  Production dependencies require Node >=20.0.0, but package.json allows >=18.12
   Consider updating engines.node to ">=20.0.0"
```

The detailed view shows:
- Separate production and development requirements
- **Which package determines each minimum version**
- Your current Node.js version
- The project's engines.node value
- Detailed validation messages

### Compatible Version Suggestions

When a dependency requires a newer Node.js version than you're currently running, the tool suggests a compatible alternative version (shown with `--verbose`):

```
 WARN  eslint@9.35.0: 2024-10-05T18:45:12.345Z
Required node: ^18.18.0 || ^20.9.0 || >=21.1.0
Compatible version for current Node: 8.57.1
```

This allows you to either upgrade your Node.js version or downgrade the dependency to a compatible version.

### Engines Validation

When checking a project with `ndc current`, the tool compares your `package.json` `engines.node` field against the actual requirements of your dependencies.

This helps you:
- Keep `engines.node` in sync with actual dependency requirements
- Prevent CI/CD failures due to incorrect Node version specifications
- Ensure contributors use compatible Node versions

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

`OpenAI` config:

```bash
Options:
  --openaiKey <value>       recommend alternative packages via ChatGPT
  --openaiModel <value>     ChatGPT model (choices: "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o-mini", "gpt-4o")
  --openaiBaseURL <value>   override the default base URL for the API
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
  -r, --range <value>       check specified versions
  --registry <value>        specify registry URL, default: https://registry.npmjs.org/
  --failfast                exit the program if it has been deprecated
```

You can also save them to global configuration:

```bash
Usage: ndc config [options]

inspect and modify the config

Options:
  -g, --get <path>          get value from option
  -s, --set <path> <value>  set option value
  -d, --delete <path>       delete option from config
  -l, --list                list all options
```

The path should be `openaiKey`, `openaiModel`, `openaiBaseURL`.

## Credits

`npm-deprecated-check` is inspired by [`check-is-deprecated`](https://github.com/awesome-cli/check-is-deprecated).
