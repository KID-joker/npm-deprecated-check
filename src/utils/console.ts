/* eslint-disable no-console */
import chalk from 'chalk'

export function error(text?: string) {
  console.error(`${chalk.bgRed(' ERROR ')} ${chalk.red(text ?? '')}`)
}

export function log(text?: string) {
  console.log(text ?? '')
}

export function ok(text?: string) {
  console.log(`${chalk.bgGreen('  OK  ')}  ${text ?? ''}`)
}

export function warn(text?: string) {
  console.log(`${chalk.bgYellowBright(' WARN ')} ${chalk.yellow(text ?? '')}`)
}
