/* eslint-disable no-console */
import fs from 'fs-extra'
import type { ConfigOption } from '../types'
import { get, set, unset } from '../utils/object'
import { rcPath } from '../shared'
import { version } from '../../package.json'

export default async function configure(options: ConfigOption) {
  if (!fs.existsSync(rcPath))
    fs.writeFile(rcPath, JSON.stringify({ latestVersion: version, lastChecked: Date.now() }, null, 2), 'utf-8')

  const config = await fs.readJson(rcPath)

  if (options.get) {
    const value = get(config, options.get)
    console.log(value)
  }

  if (options.set) {
    const [path, value] = options.set

    let formatValue: any
    if (value.match('[0-9]'))
      formatValue = parseInt(value)
    else if (value === 'true')
      formatValue = true
    else if (value === 'false')
      formatValue = false
    else
      formatValue = value

    set(config, path, formatValue)

    await fs.writeFile(rcPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  if (options.delete) {
    unset(config, options.delete)
    await fs.writeFile(rcPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  if (options.list)
    console.log(JSON.stringify(config, null, 2))
}
