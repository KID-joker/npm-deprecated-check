import path from 'path'
import os from 'os'
import fs from 'fs-extra'

const homedir = os.homedir()

export const rcPath = path.resolve(homedir, '.ndcrc')

let config: Record<string, any>
export const getGlobalConfig = function () {
  if (config)
    return config

  try {
    config = fs.readJSONSync(rcPath) || {}
  }
  catch (e: any) {
    config = {}
  }
  return config
}

export const openaiModels = ['gpt-3.5-turbo', 'gpt-4']
