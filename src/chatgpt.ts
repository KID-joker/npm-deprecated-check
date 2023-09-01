/* eslint-disable no-console */
import fetch from 'node-fetch'
import chalk from 'chalk'
import { getGlobalConfig, openaiModels } from './shared'
import type { OpenaiOption } from './types'

export async function recommendDependencies(packageName: string, openaiOptions: OpenaiOption) {
  const config = Object.assign(getGlobalConfig(), openaiOptions)

  if (!config.openaiKey)
    return null

  for (let i = openaiModels.indexOf(config.openaiModel); i > -1; i--) {
    const openaiModel = openaiModels[i]
    const { url, req } = buildRequest(packageName, config.openaiKey, openaiModel)

    try {
      const response = await fetch(url, req)
      const suggestList: Array<string> = await response.json() as Array<string>
      return suggestList.length === 0 ? null : suggestList
    }
    catch (e: any) {
      console.log(chalk.yellow(`error: ${e}`))
      console.log()
    }
  }

  return null
}

function buildRequest(packageName: string, openaiModel: string, openaiKey: string) {
  const url = 'https://api.openai.com/v1/chat/completions'
  const req = {
    method: 'post',
    body: JSON.stringify({
      message: [{ role: 'user', content: `The npm package - ${packageName} is deprecated, please suggest some alternative packages, return an array of the package names.` }],
      model: openaiModel,
    }),
    headers: {
      Authorization: `Bearer ${openaiKey}`,
    },
  }
  return {
    url,
    req,
  }
}
