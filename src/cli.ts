import chalk from 'chalk';
import yargs, { ArgumentsCamelCase, Argv } from 'yargs'
import { hideBin } from 'yargs/helpers'
import { version } from '../package.json'
import checkCurrent from './io/current';
import checkGlobal from './io/global';
import checkSpecified from './io/package';
import { DeepOption, GlobalOption, PackageOption } from './types';

function deepOption(args: Argv<{}>): Argv<DeepOption> {
  return args
    // .option('deep', {
    //   alias: 'd',
    //   default: false,
    //   type: 'boolean',
    //   describe: 'Deep check the dependencies of packages'
    // })
}

// eslint-disable-next-line no-unused-expressions
yargs(hideBin(process.argv))
  .scriptName('ndc')
  .usage('$0 [args]')
  .command(
    "current",
    "Check the packages of the current project",
    (args) => deepOption(args).help(),
    (args) => checkCurrent(args as ArgumentsCamelCase<DeepOption>)
  )
  .command(
    "global",
    "Check global packages",
    (args) => 
      deepOption(args)
        .option('manager', {
          alias: 'm',
          type: 'string',
          default: 'npm',
          choices: ['npm', 'yarn', 'pnpm'],
          describe: 'Check global packages of the package manager'
        })
        .help(),
    (args) => checkGlobal(args as ArgumentsCamelCase<GlobalOption>)
  )
  .command(
    "package <packageName>",
    "Check for specified package",
    (args) => 
      deepOption(args)
        .option('range', {
          alias: 'r',
          type: 'string',
          default: '',
          describe: 'check the specify versions'
        })
        .help(),
    args => checkSpecified(args as ArgumentsCamelCase<PackageOption>)
  )
  .command(
    "version",
    "Show version",
    () => {
      console.log(chalk.green(version))
    }
  )
  .command(
    "*",
    "* Check the packages of the current project",
    () => {},
    (args) => checkCurrent(args as ArgumentsCamelCase<DeepOption>)
  )
  .version(false)
  .showHelpOnFail(false, 'Specify --help for available options')
  .alias('h', 'help')
  .help()
  .strict()
  .argv;