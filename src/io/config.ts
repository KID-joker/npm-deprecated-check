/* eslint-disable no-console */
import type { ConfigOption } from '../types'
import process from 'node:process'
import fs from 'fs-extra'
import { version } from '../../package.json'
import { openaiModels, rcPath } from '../shared'
import { get, set, unset } from '../utils/object'

export default function configure(options: ConfigOption) {
  if (!fs.existsSync(rcPath))
    fs.writeFileSync(rcPath, JSON.stringify({ latestVersion: version, lastChecked: Date.now() }, null, 2), 'utf-8')

  let config: Record<string, any> = {}
  try {
    config = fs.readJsonSync(rcPath)
  }
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (e: any) {}

  if (options.get) {
    const value = get(config, options.get)
    console.log(value)
  }

  if (options.set) {
    const [path, value] = options.set

    if (path === 'openaiModel' && !openaiModels.includes(value)) {
      console.error(`error: option '--openaiModel <value>' argument '${value}' is invalid. Allowed choices are ${openaiModels.join(', ')}.`)
      process.exit(1)
    }

    let formatValue: any
    if (!Number.isNaN(Number.parseInt(value)))
      formatValue = Number.parseInt(value)
    else if (value === 'true')
      formatValue = true
    else if (value === 'false')
      formatValue = false
    else
      formatValue = value

    set(config, path, formatValue)

    fs.writeFileSync(rcPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  if (options.delete) {
    unset(config, options.delete)
    fs.writeFileSync(rcPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  if (options.list)
    console.log(JSON.stringify(config, null, 2))
}
