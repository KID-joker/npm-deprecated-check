export interface CommonOption {
  registry: string
  failfast: boolean
}

export interface CurrentOption extends CommonOption {
  ignore: string
  deep: boolean
  verbose: boolean
}

export interface GlobalOption extends CommonOption {
  manager: string
  ignore: string
}

export interface PackageOption extends Omit<CommonOption, 'failfast'> {
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
  error?: string
  minimumUpgradeVersion?: string | null
  requiredNode?: string
  compatibleVersion?: string | null
  nodeRequirement?: string
  dependencyType?: 'production' | 'development'
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
      engines?: {
        node?: string
      }
    }
  }
}

export interface VersionOrRange {
  version?: string
  range?: string
}

export interface CheckResult {
  packages: PackageInfo[]
  hasDeprecated: boolean
  hasErrors: boolean
  interrupted: boolean
  nodeVersionSummary: {
    currentNode: string
    minimumRequired: {
      production: string | null
      development: string | null
      productionPackage: string | null
      developmentPackage: string | null
    }
    projectEnginesNode?: string
  } | null
  summary: {
    total: number
    deprecated: number
    nodeIncompatible: number
    errors: number
  }
}

export interface NodeStatus {
  version: string
  majorVersion: number
  eol: boolean
  eolDate: string | null
  codename: string | null
  supported: boolean
  latestVersion: string
}
