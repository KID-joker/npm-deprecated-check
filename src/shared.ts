import path from 'path'
import os from 'os'

const homedir = os.homedir()

export const rcPath = path.resolve(homedir, '.ndcrc')
