export interface PackageOption {
  packageName: string
  range?: string
}

export interface GlobalOption {
  manager?: string
}

export interface ConfigOption {
  get?: string
  set?: Array<string>
  delete?: string
  list?: boolean
}

export interface PackageInfo {
  name: string
  version: string
  time: string
  deprecated?: string
}

export interface PackageVersions {
  name: string
  time: Record<string, string>
  versions: {
    [version: string]: {
      name: string
      version: string
      deprecated?: string
    }
  }
}

export interface VersionOrRange {
  version?: string
  range?: string
}
