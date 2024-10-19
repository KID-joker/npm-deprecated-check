import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'

const homedir = os.homedir()

export const rcPath = path.resolve(homedir, '.ndcrc')

export const getGlobalConfig = function () {
  try {
    return fs.readJSONSync(rcPath) || {}
  }
  catch {
    return {}
  }
}

export const openaiModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-4o']

export const openaiBaseURL = 'https://api.openai.com/v1'
