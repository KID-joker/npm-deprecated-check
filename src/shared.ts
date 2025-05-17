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

export const openaiModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-4o']

export const openaiBaseURL = 'https://api.openai.com/v1'
