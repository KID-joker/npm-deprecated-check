import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import fetch from 'node-fetch'

const scheduleURL = 'https://raw.githubusercontent.com/nodejs/Release/master/schedule.json'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const filePath = path.resolve(__dirname, '../src/schedule.json')

fetch(scheduleURL).then(res => res.json()).then((schedule) => {
  fs.writeJSONSync(filePath, schedule, { spaces: 2 })
})
