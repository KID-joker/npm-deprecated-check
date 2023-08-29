import { Option, program } from 'commander';
import { version } from '../package.json'
import checkCurrent from './io/current'
import checkGlobal from './io/global'
import checkPackage from './io/package'
import type { GlobalOption, PackageOption } from './types'

program
  .version(`npm-deprecated-check ${version}`)
  .usage('<command> [options]')

program
  .command('current')
  .description('check the packages of the current project')
  .action(() => {
    checkCurrent();
  })

program
  .command('global')
  .description('check global packages, default: npm')
  .addOption(new Option('-m, --manger <value>', 'check specified package manger, choices: [npm, yarn, pnpm]').choices(['npm', 'yarn', 'pnpm']).default('npm'))
  .action((option: GlobalOption) => {
    checkGlobal(option);
  })

program
  .command('package <packageName>')
  .description('check for specified package')
  .option('-r, --range <value>', 'check specified versions')
  .action((packageName: string, option: { range?: string }) => {
    const options: PackageOption = {
      packageName,
      ...option
    }
    checkPackage(options)
  })

program.parse(process.argv)
