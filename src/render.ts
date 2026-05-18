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
    warn(`Your node version (${status.version}) is higher than the latest version ${status.latestVersion}. Please update 'npm-deprecated-check'.`)
  }
  else if (status.eol) {
    warn(`Your node version (${status.version}) is no longer supported since ${status.eolDate}.`)
  }
  else {
    warn(`Your node version (${status.version}) can't be found in the release schedule. Please update 'npm-deprecated-check'.`)
  }
}
