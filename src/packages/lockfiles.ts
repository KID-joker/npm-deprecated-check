import type { VersionOrRange } from '../types'
import fs from 'node:fs'
import { resolve } from 'node:path'
import { readWantedLockfile } from '@pnpm/lockfile-file'
import { parseSyml } from '@yarnpkg/parsers'

const npmLockPath = resolve('./package-lock.json')
const yarnLockPath = resolve('./yarn.lock')
const pnpmLockPath = resolve('./pnpm-lock.yaml')

export function getDependenciesOfLockfile(packages: { [k: string]: VersionOrRange }) {
  const npmLock = {
    path: npmLockPath,
    read() {
      const lockfileContent = JSON.parse(fs.readFileSync(this.path, 'utf-8'))
      let dependencies = lockfileContent.dependencies
      let packageNamePrefix = ''
      if (lockfileContent.lockfileVersion > 1) {
        dependencies = lockfileContent.packages
        packageNamePrefix = 'node_modules/'
      }
      const result: Record<string, VersionOrRange> = {}
      for (const packageName in packages) {
        const dependencyKey = packageNamePrefix + packageName
        if (dependencies[dependencyKey])
          result[packageName] = { version: dependencies[dependencyKey].version }
      }

      return result
    },
  }
  const yarnLock = {
    path: yarnLockPath,
    read() {
      const content = fs.readFileSync(this.path, 'utf-8')
      const json = parseSyml(content)
      const result: Record<string, VersionOrRange> = {}
      for (const packageName in packages)
        json[`${packageName}@${packages[packageName].range}`] && (result[packageName] = { version: json[`${packageName}@${packages[packageName].range}`].version })

      return result
    },
  }
  const pnpmLock = {
    path: pnpmLockPath,
    async read() {
      const content = await readWantedLockfile(resolve(this.path, '..'), { ignoreIncompatible: false })
      if (content && content.packages) {
        const packageNames = Object.keys(packages)
        const result: Record<string, VersionOrRange> = {}
        for (const depPath in content.packages) {
          const info = (content.packages as Record<string, any>)[depPath]
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
