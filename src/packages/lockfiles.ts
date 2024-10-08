import { resolve } from 'path'
import { readWantedLockfile } from '@pnpm/lockfile-file'
import lockfile from '@yarnpkg/lockfile'
import fs from 'fs-extra'
import type { VersionOrRange } from '../types'

const npmLockPath = resolve('./package-lock.json')
const yarnLockPath = resolve('./yarn.lock')
const pnpmLockPath = resolve('./pnpm-lock.yaml')

export function getDependenciesOfLockfile(packages: { [k: string]: VersionOrRange }) {
  const npmLock = {
    path: npmLockPath,
    read() {
      const { dependencies } = fs.readJsonSync(this.path)
      const result: Record<string, VersionOrRange> = {}
      for (const packageName in packages)
        dependencies[packageName] && (result[packageName] = { version: dependencies[packageName].version })

      return result
    },
  }; const yarnLock = {
    path: yarnLockPath,
    read() {
      const content = fs.readFileSync(this.path).toString('utf-8')
      const json = lockfile.parse(content)
      const result: Record<string, VersionOrRange> = {}
      for (const packageName in packages)
        json.object[`${packageName}@${packages[packageName].range}`] && (result[packageName] = { version: json.object[`${packageName}@${packages[packageName].range}`].version })

      return result
    },
  }; const pnpmLock = {
    path: pnpmLockPath,
    async read() {
      const content = await readWantedLockfile(resolve(this.path, '..'), { ignoreIncompatible: false })
      if (content && content.packages) {
        const packageNames = Object.keys(packages)
        const result: Record<string, VersionOrRange> = {}
        for (const depPath in content.packages) {
          const info = content.packages[depPath]
          packageNames.includes(info.name as string) && (result[info.name as string] = { version: info.version })
        }
        return result
      }
      else {
        return {}
      }
    },
  }

  const existsLock = [npmLock, yarnLock, pnpmLock]
    .filter(ele => fs.existsSync(ele.path))
    .sort((a, b) => fs.lstatSync(b.path).mtimeMs - fs.lstatSync(a.path).mtimeMs)

  return existsLock.length > 0 ? existsLock[0].read() : {}
}
