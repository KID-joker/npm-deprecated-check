import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const homedir = os.homedir()

export const rcPath = path.resolve(homedir, '.ndcrc')

export function getGlobalConfig() {
  try {
    const data = readFileSync(rcPath, 'utf-8')
    return JSON.parse(data) || {}
  }
  catch {
    return {}
  }
}
