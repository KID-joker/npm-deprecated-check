import type { Command } from 'commander'
import type { CommonOption, ConfigOption, CurrentOption, GlobalOption, PackageOption } from './types'
import process from 'node:process'
import { Option, program } from 'commander'
import { version } from '../package.json'
import checkConfig from './io/config'
import checkCurrent from './io/current'
import checkGlobal from './io/global'
import checkNode from './io/node'
import checkPackage from './io/package'
import { openaiModels } from './shared'

export { checkCurrent, checkGlobal, checkNode, checkPackage }

const registryOption = new Option('--registry <value>', 'specify registry URL')
const gptOption = new Option('--openaiKey <value>', 'recommend alternative packages via ChatGPT')
const gptModelOption = new Option('--openaiModel <value>', 'ChatGPT model').choices(openaiModels)
const gptBaseURL = new Option('--openaiBaseURL <value>', 'override the default base URL for the API')

program
  .version(`npm-deprecated-check ${version}`)
  .usage('<command> [options]')

program
  .command('node')
  .description('check if used node version is deprecated (reached End Of Life)')
  .action(() => {
    checkNode()
  })

program
  .command('current')
  .description('check the packages of the current project')
  .addOption(new Option('--ignore <value>', 'ignore specific packages'))
  .addOption(new Option('--failfast', 'exit the program if it has been deprecated'))
  .addOption(registryOption)
  .addOption(gptOption)
  .addOption(gptModelOption)
  .addOption(gptBaseURL)
  .action((option: CurrentOption) => {
    checkNode()
    checkCurrent(option)
  })

program
  .command('global')
  .description('check global packages, default: npm')
  .addOption(new Option('-m, --manger <value>', 'check specified package manger').choices(['npm', 'yarn', 'pnpm']).default('npm'))
  .addOption(new Option('--ignore <value>', 'ignore specific packages'))
  .addOption(new Option('--failfast', 'exit the program if it has been deprecated'))
  .addOption(registryOption)
  .addOption(gptOption)
  .addOption(gptModelOption)
  .addOption(gptBaseURL)
  .action((globalOption: GlobalOption) => {
    checkNode()
    checkGlobal(globalOption)
  })

program
  .command('package <packageName>')
  .description('check for specified package')
  .addOption(new Option('-r, --range <value>', 'check specified versions'))
  .addOption(new Option('--failfast', 'exit the program if it has been deprecated'))
  .addOption(registryOption)
  .addOption(gptOption)
  .addOption(gptModelOption)
  .addOption(gptBaseURL)
  .action((packageName: string, option: { range?: string } & CommonOption) => {
    const packageOption: PackageOption = {
      packageName,
      ...option,
    }
    checkPackage(packageOption)
  })

program
  .command('config')
  .description('inspect and modify the config')
  .addOption(new Option('-g, --get <path>', 'get value from option'))
  .addOption(new Option('-s, --set <path> <value>', 'set option value'))
  .addOption(new Option('-d, --delete <path>', 'delete option from config'))
  .addOption(new Option('-l, --list', 'list all options'))
  .action((option: Record<string, any>, command: Command) => {
    if (Object.keys(option).length === 0) {
      command.outputHelp()
      process.exit(0)
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
