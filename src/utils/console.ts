/* eslint-disable no-console */
import ansis from 'ansis'

export function error(text?: string) {
  console.error(`${ansis.bgRed(' ERROR ')} ${ansis.red(text ?? '')}`)
}

export function log(text?: string) {
  console.log(text ?? '')
}

export function ok(text?: string) {
  console.log(`${ansis.bgGreen('  OK  ')} ${text ?? ''}`)
}

export function warn(text?: string) {
  console.warn(`${ansis.bgYellowBright(' WARN ')} ${ansis.yellow(text ?? '')}`)
}
