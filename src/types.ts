export interface OpenaiOption {
  openaiKey?: string
  openaiModel?: string
  openaiBaseURL?: string
}

export interface CommonOption extends OpenaiOption {
  registry: string
}

export interface CurrentOption extends CommonOption {
  ignore: string
}

export interface GlobalOption extends CommonOption {
  manager: string
}

export interface PackageOption extends CommonOption {
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
  version?: string
  time?: string
  deprecated?: string | undefined
  recommend?: Array<string> | string | null
  error?: string
}

export interface PackageVersions {
  'name': string
  'time': Record<string, string>
  'dist-tags': Record<string, string>
  'versions': {
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
