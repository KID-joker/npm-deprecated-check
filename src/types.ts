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
  time: string,
  deprecated?: string,
  dependencies: Record<string, VersionOrRange> | undefined
}

export interface PackageVersions {
  name: string,
  time: Record<string, string>,
  versions: {
    [version: string]: {
      name: string,
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