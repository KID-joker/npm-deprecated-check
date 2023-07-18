import { version } from '../package.json'
import checkCurrent from './io/current';
import checkGlobal from './io/global';
import checkSpecified from './io/package';
import { GlobalOption, PackageOption } from './types';

type Command = 'current' | 'global' | 'package' | 'version' | 'help'
interface CliArgs {
  command: Command
  options?: PackageOption | GlobalOption
}

const help = `
ndc [args]

command:
  ndc current                Check the packages of the current project
  ndc global                 Check global packages, default: npm
  ndc package <packageName>  Check for specified package
  ndc version                Show version
  ndc                        * Check the packages of the current project

option:
  for command global:
    -m, --manger             Check global packages of the package manager, choices: ['npm', 'yarn', 'pnpm']
  for command package:
    -r, --range              Check the specify versions
`

const commandFuncs: Record<Command, Function> = {
  current: () => checkCurrent(),
  global: (args: GlobalOption) => checkGlobal(args),
  package: (args: PackageOption) => checkSpecified(args),
  version: () => console.log(version),
  help: () => console.log(help)
}

function runCli(args: CliArgs) {
  const { command, options } = args;

  commandFuncs[command](options);
}

function parseArgs() {
  const args = process.argv.slice(2);

  let command: string = args[0] || 'current';
  let realCommand: Command;

  let options: undefined | PackageOption | GlobalOption = undefined;

  switch(command) {
    case 'current':
    case 'version':
    case 'help':
      realCommand = command;
      break;
    case 'global':
      realCommand = command;
      const managerOption = args.slice(1).find(ele => ele.startsWith('-m') || ele.startsWith('--manger'));
      if(managerOption) {
        options = {
          manager: managerOption.match(/^(-m|--manger)=(.+)$/)![2]
        }
      }
      break;
    case 'package':
      realCommand = command;
      if(!args[1]) {
        console.error('Please enter the package name!');
        process.exit(0);
      }

      const packageOption = args.slice(1).find(ele => ele.startsWith('-r') || ele.startsWith('--range'));
      let range = '';
      if(packageOption) {
        range = packageOption.match(/^(-r|--range)=(.+)$/)![2];
      }
      options = {
        packageName: args[1],
        range
      };
      break;
    default:
      realCommand = 'help';
      console.error('Run `ndc help` for usage information');
  }

  return Promise.resolve({
    command: realCommand,
    options
  })
}

parseArgs().then(res => {
  runCli(res);
})