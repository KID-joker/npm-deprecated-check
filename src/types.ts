export interface DeepOption {
  deep?: boolean
}

export interface PackageOption extends DeepOption {
  packageName: string,
  range: string
}

export interface GlobalOption extends DeepOption {
  manager: string
}

export interface PackageInfo {
  version: string,
  description: string,
  deprecated?: string,
  dependencies: object
}

export interface RegistryResult {
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

interface VersionOption {
  version: string,
  range?: string
}

interface RangeOption {
  version?: string,
  range: string
}

export type VersionOrRange = VersionOption | RangeOption;