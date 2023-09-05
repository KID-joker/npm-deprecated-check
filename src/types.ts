export interface OpenaiOption {
  openaiKey?: string
  openaiModel?: string
  openaiBaseURL?: string
}

export interface GlobalOption extends OpenaiOption {
  manager: string
}

export interface PackageOption extends OpenaiOption {
  packageName: string
  range?: string
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
  deprecated: string | undefined
  recommend: Array<string> | string | null
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
