import type { OpenaiOption } from './types'
import { getGlobalConfig, openaiBaseURL, openaiModels } from './shared'
import { log, warn } from './utils/console'
import { safeJSON } from './utils/object'

const defaultConfig = {
  openaiModel: openaiModels[0],
  openaiBaseURL,
}
const globalConfig = getGlobalConfig()

export async function recommendDependencies(packageName: string, openaiOptions: OpenaiOption) {
  const config = Object.assign(defaultConfig, globalConfig, openaiOptions)

  if (!config.openaiKey)
    return null

  for (let i = openaiModels.indexOf(config.openaiModel); i > -1; i--) {
    const openaiModel = openaiModels[i]
    const { url, req } = buildRequest(packageName, config.openaiKey, openaiModel, config.openaiBaseURL)

    try {
      const response = await fetch(url, req)

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown')
        const errJSON = safeJSON(errText)
        const errMessage = errJSON ? undefined : errText
        throw new Error(errJSON?.error?.message ? errJSON?.error?.message : errMessage || 'Unknown error occurred')
      }

      const resJSON: Record<string, any> = await response.json().catch(() => null) as Record<string, any>

      const content = resJSON.choices[0]?.message?.content
      const recommendedList = safeJSON(content) || content

      return recommendedList?.length ? recommendedList : null
    }
    catch (e: any) {
      log()
      warn(e)
      log()
    }
  }

  return null
}

function buildRequest(packageName: string, openaiKey: string | undefined, openaiModel: string, openaiBaseURL: string) {
  const url = `${openaiBaseURL}/chat/completions`
  const req = {
    method: 'post',
    body: JSON.stringify({
      messages: [{ role: 'user', content: `The npm package - ${packageName} is deprecated, please suggest some alternative packages, only return an array of the package names.` }],
      model: openaiModel,
    }, null, 2),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
  }
  return {
    url,
    req,
  }
}
