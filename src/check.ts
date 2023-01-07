
import chalk from 'chalk';
import got from 'got';
import semver from 'semver';
import { getCacheFromMap, setCacheToMap } from './cache';
import { PackageInfo, PackageVersions, VersionOrRange } from './types';
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
  let packageVersions = getCacheFromMap(packageName);

  if(!packageVersions) {
    const registry = execCommand('npm config get registry');
  
    try {
      const packageRes = await got.get(registry + packageName).json() as PackageVersions;

      if(packageRes) {
        packageVersions = packageRes;
        setCacheToMap(packageName, packageRes);
      } else {
        stopSpinner();
        return console.error(`${packageName}: Could not find the package!`);
      }

    } catch(e: any) {
      stopSpinner();
      return console.error(`${packageName}: ${e.message}`);
    }
  }

  let version: string | undefined | null = options.version;

  if(!version) {
    const versions = Object.keys(packageVersions.versions);
    version = semver.maxSatisfying(versions, options.range as string);
  }

  if(!version || !packageVersions.versions[version]) {
    stopSpinner();
    return console.error(`${packageName}: Please enter the correct range!`);
  }

  const packageInfo: PackageInfo = {
    version,
    time: packageVersions.time[version],
    deprecated: packageVersions.versions[version].deprecated,
    dependencies: packageVersions.versions[version].dependencies || {}
  }

  stopSpinner();
  return packageInfo;
}