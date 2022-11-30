<h1 align="center">🐦 npm-deprecated-check</h1>
<p align="center">Check for deprecated packages</p>

## Install

```bash
$ npm install -g npm-deprecated-check
```

## Features

- Check the packages of current project, global or specified is deprecated.
- According to the version range of lockfile and package.json.

## Todo

- Do a deep inspection of the dependency tree.

## Usage

```bash
ndc [args]

command：
  ndc current                Check the packages of the current project
  ndc global                 Check global packages
  ndc package <packageName>  Check for specified package
  ndc version                Show version
  ndc                        * Check the packages of the current project

option：
  -h, --help
```

For `current` and `global`, you can view all dependency checks.

```bash
option:
  -a, --all   show all packages info
```

And `package`, a version range can be specified.

```bash
option:
  -r, --range  check the specify versions
```

See `ndc --help` for more details.

## Credits

`npm-deprecated-check` is inspired by [`check-is-deprecated`](https://github.com/awesome-cli/check-is-deprecated) and [`taze`](https://github.com/antfu/taze)
