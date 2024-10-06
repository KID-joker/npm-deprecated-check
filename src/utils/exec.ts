import { execSync } from 'child_process'

export function execCommand(command: string) {
  return execSync(command).toString()
}

let registry = ''
export function getRegistry() {
  if (registry)
    return registry

  try {
    registry = execCommand('npm config get registry').trim()
  }
  catch {
    registry = 'https://registry.npmjs.org/'
  }

  return registry
}
