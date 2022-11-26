
import got from 'got';
import semverMaxSatisfying from 'semver/ranges/max-satisfying';
// import cache from './cache';
import { PackageInfo, registryResult } from './types';
import { execCommand } from './utils/exec';

export async function getPackageInfo(packageName: string, range: string) {
  // const cachedPackageInfo = cache.getIfPresent(`${packageName}@${range}`) as PackageInfo;
  // if(cachedPackageInfo) {
  //   return cachedPackageInfo;
  // }

  const registry = execCommand('npm config get registry');

  const packageInfo = await got.get(registry + packageName).json() as registryResult;

  const versions = Object.keys(packageInfo.versions);
  
  const version = semverMaxSatisfying(versions, range);
  if(!version) {
    throw new Error('Please enter the correct range!');
  }

  const cacheInfo: PackageInfo = {
    version,
    description: packageInfo.description,
    deprecated: packageInfo.versions[version].deprecated,
    dependencies: packageInfo.versions[version].dependencies || {}
  }

  // cache.set(`${packageName}@${range}`, cacheInfo);

  return cacheInfo
}