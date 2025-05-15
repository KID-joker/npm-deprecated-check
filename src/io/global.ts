import type { GlobalOption } from '../types'
import { checkDependencies } from '../check'
import { isLocalPackage } from '../filter'
import { error } from '../utils/console'
import { execCommand } from '../utils/exec'

const yarnRegexp = /"((?:@[a-z][a-z0-9-_.]*\/)?[a-z][a-z0-9-_.]*)@(\d+\.\d+\.\d+(?:-[a-z0-9-]+(?:\.[a-z0-9-]+)*)?)"/g

export default function checkGlobal(options: GlobalOption) {
  const { manager, ...openaiOptions } = options
  try {
    let dependencies: Record<string, { version: string }> = {}
    if (manager === 'pnpm') {
      const result = JSON.parse(execCommand('pnpm list -g --depth=0 --json'))
      dependencies = result
        .map((ele: { dependencies?: object }) => ele.dependencies)
        .reduce((previousValue: object, currentValue?: object) => Object.assign(previousValue, currentValue), {})
    }
    else if (manager === 'yarn') {
      const result = execCommand('yarn global list --depth=0')
      const iterator = Array.from(result.matchAll(yarnRegexp), (m: string[]) => [m[1], m[2]])
      for (const dependency of iterator) {
        const [packageName, version] = dependency
        dependencies[packageName] = { version }
      }
    }
    else {
      const result = JSON.parse(execCommand('npm ls -g --depth=0 --json'))
      dependencies = result.dependencies
    }

    const ignores = options.ignore?.split(',') || []

    return checkDependencies(Object.fromEntries(Object.entries(dependencies).filter(([key, { version }]) => !ignores.includes(key) && !isLocalPackage(version))), openaiOptions)
  }
  catch (e: any) {
    error(e.message)
  }
}
