import fetch from 'node-fetch'
import { getGlobalConfig } from './shared'
import type { OpenaiOption } from './types'

export async function recommendDependencies(packageName: string, openaiOptions: OpenaiOption) {
  const config = Object.assign(getGlobalConfig(), openaiOptions)

  if (!config.openaiKey)
    return null

  const url = 'https://api.openai.com/v1/chat/completions'
  const req = {
    method: 'post',
    body: JSON.stringify({
      message: [{ role: 'user', content: `The npm package - ${packageName} is deprecated, please suggest some alternative packages, return an array of the package names.` }],
      model: config.openaiModel === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
    }),
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
    },
  }

  try {
    const response = await fetch(url, req)
    const suggestList: Array<string> = await response.json() as Array<string>
    return suggestList.length === 0 ? null : suggestList
  }
  catch (e: any) {
    return null
  }
}
