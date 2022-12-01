
import chalk from 'chalk';
import got from 'got';
import semver from 'semver';
// import cache from './cache';
import { PackageInfo, RegistryResult, VersionOrRange } from './types';
import { execCommand } from './utils/exec';
import { startSpinner, stopSpinner } from './utils/spinner';

export async function checkPackage(packageName: string, options: VersionOrRange, all: boolean) {
  startSpinner();
  try {
    const result = await getPackageInfo(packageName, options);

    stopSpinner();
    
    if(result.deprecated) {
      console.log(chalk.yellow(`${packageName}@${result.version}: `) + result.time);
      console.log(chalk.red(`deprecated: ${result.deprecated}`))
    } else if(all) {
      console.log(chalk.green(`${packageName}@${result.version}: `) + result.time);
    }

    return result;
  } catch(e) {
    stopSpinner();

    throw e;
  }
}

async function getPackageInfo(packageName: string, options: VersionOrRange) {
  // const cachedPackageInfo = cache.getIfPresent(`${packageName}@${range}`) as PackageInfo;
  // if(cachedPackageInfo) {
  //   return cachedPackageInfo;
  // }

  const registry = execCommand('npm config get registry');

  const packageInfo = await got.get(registry + packageName).json() as RegistryResult;

  let version: string | undefined | null = options.version;

  if(!version) {
    const versions = Object.keys(packageInfo.versions);
    version = semver.maxSatisfying(versions, options.range as string);
  }

  if(!version) {
    throw new Error('Please enter the correct range!');
  }

  const cacheInfo: PackageInfo = {
    version,
    time: packageInfo.time[version],
    deprecated: packageInfo.versions[version].deprecated,
    dependencies: packageInfo.versions[version].dependencies || {}
  }

  // cache.set(`${packageName}@${range}`, cacheInfo);

  return cacheInfo
}