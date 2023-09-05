/* eslint-disable no-console */
import { stopSpinner } from './spinner'

export function error(text?: string) {
  stopSpinner()
  console.error(text ?? '')
}

export function log(text?: string) {
  stopSpinner()
  console.log(text ?? '')
}
