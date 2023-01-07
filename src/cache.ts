import { PackageVersions } from './types';

const cacheMap: Map<string, PackageVersions> = new Map();

export function getCacheFromMap(name: string) {
  return cacheMap.get(name);
}

export function setCacheToMap(name: string, packageVersions: PackageVersions) {
  cacheMap.set(name, packageVersions);
}