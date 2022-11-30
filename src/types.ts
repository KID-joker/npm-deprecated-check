export interface CommonOption {
  deep?: boolean,
  all: boolean
}

export interface PackageOption extends CommonOption {
  packageName: string,
  range: string
}

export interface GlobalOption extends CommonOption {
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

export interface VersionOrRange {
  version?: string,
  range?: string
}