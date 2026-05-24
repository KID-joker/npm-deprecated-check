import { execSync } from 'node:child_process'
import process from 'node:process'

export function execCommand(command: string) {
  return execSync(command, { env: { ...process.env } }).toString()
}

const commandPathCache = new Map<string, string | null>()

export function resolveCommand(command: string): string | null {
  if (commandPathCache.has(command))
    return commandPathCache.get(command)!

  try {
    const platform = process.platform
    const whichCmd = platform === 'win32' ? 'where' : 'which'
    const result = execSync(`${whichCmd} ${command}`, { encoding: 'utf-8', env: { ...process.env } }).trim()
    const resolved = result.split('\n')[0].trim()
    commandPathCache.set(command, resolved || null)
    return resolved || null
  }
  catch {
    commandPathCache.set(command, null)
    return null
  }
}

let registry = ''
export function getRegistry() {
  if (registry)
    return registry

  try {
    const npmPath = resolveCommand('npm')
    const cmd = npmPath ? `"${npmPath}" config get registry` : 'npm config get registry'
    registry = execCommand(cmd).trim()
  }
  catch {
    registry = 'https://registry.npmjs.org/'
  }

  return registry
}
