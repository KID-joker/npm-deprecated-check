import { version } from "yargs"

export interface DeepOption {
  deep?: boolean
}

export interface PackageOption extends DeepOption {
  packageName: string,
  range?: string
}

export interface PackageInfo {
  version: string,
  description: string,
  deprecated?: string,
  dependencies: object
}

export interface registryResult {
  name: string,
  description: string,
  versions: {
    [version: string]: {
      name: string,
      description: string,
      version: string,
      deprecated?: string,
      dependencies?: object
    }
  }
}