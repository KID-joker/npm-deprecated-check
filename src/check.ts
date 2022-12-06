
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

    if(!result) {
      return;
    }
    
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

  let packageInfo;
  try {
    packageInfo = await got.get(registry + packageName).json() as RegistryResult;
  } catch(e: any) {
    stopSpinner();
    return console.error(`${packageName}: ${e.message}`);
  }

  if(!packageInfo) {
    stopSpinner();
    return console.error(`${packageName}: Could not find the package!`);
  }

  let version: string | undefined | null = options.version;

  if(!version) {
    const versions = Object.keys(packageInfo.versions);
    version = semver.maxSatisfying(versions, options.range as string);
  }

  if(!version || !packageInfo.versions[version]) {
    stopSpinner();
    return console.error(`${packageName}: Please enter the correct range!`);
  }

  const cacheInfo: PackageInfo = {
    version,
    time: packageInfo.time[version],
    deprecated: packageInfo.versions[version].deprecated,
    dependencies: packageInfo.versions[version].dependencies || {}
  }

  // cache.set(`${packageName}@${range}`, cacheInfo);

  stopSpinner();
  return cacheInfo
}