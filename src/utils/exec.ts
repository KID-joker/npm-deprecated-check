import { execSync } from 'child_process'

export function execCommand(command: string) {
  return execSync(command).toString()
}

export const registry = 'https://registry.npmjs.org/'
