import type { Command } from 'commander'
import { Option, program } from 'commander'
import { version } from '../package.json'
import checkCurrent from './io/current'
import checkGlobal from './io/global'
import checkPackage from './io/package'
import checkConfig from './io/config'
import type { ConfigOption, GlobalOption, PackageOption } from './types'

program
  .version(`npm-deprecated-check ${version}`)
  .usage('<command> [options]')

program
  .command('current')
  .description('check the packages of the current project')
  .action(() => {
    checkCurrent()
  })

program
  .command('global')
  .description('check global packages, default: npm')
  .addOption(new Option('-m, --manger <value>', 'check specified package manger, choices: [npm, yarn, pnpm]').choices(['npm', 'yarn', 'pnpm']).default('npm'))
  .action((globalOption: GlobalOption) => {
    checkGlobal(globalOption)
  })

program
  .command('package <packageName>')
  .description('check for specified package')
  .option('-r, --range <value>', 'check specified versions')
  .action((packageName: string, option: { range?: string }) => {
    const packageOption: PackageOption = {
      packageName,
      ...option,
    }
    checkPackage(packageOption)
  })

program
  .command('config')
  .description('inspect and modify the config')
  .option('-g, --get <path>', 'get value from option')
  .option('-s, --set <path> <value>', 'set option value')
  .option('-d, --delete <path>', 'delete option from config')
  .option('-l, --list', 'list all options')
  .action((option: Record<string, any>, command: Command) => {
    if (Object.keys(option).length === 0) {
      command.outputHelp()
      process.exit(1)
    }

    const configOption: ConfigOption = {}
    for (const key in option) {
      if (key === 'set')
        configOption.set = [option.set, command.args[0]]
      else
        configOption[key as keyof ConfigOption] = option[key]
    }
    checkConfig(configOption)
  })

program.parse(process.argv)
