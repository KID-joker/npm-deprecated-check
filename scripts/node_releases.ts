import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scheduleURL = 'https://raw.githubusercontent.com/nodejs/Release/master/schedule.json'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const filePath = path.resolve(__dirname, '../src/schedule.json')

async function fetchAndSaveSchedule() {
  const res = await fetch(scheduleURL)
  const schedule = await res.json()
  writeFileSync(filePath, `${JSON.stringify(schedule, null, 2)}\n`, 'utf-8')
}

fetchAndSaveSchedule().catch((error) => {
  console.error('Error fetching and saving node.js release schedule:', error)
})
