
import chalk from 'chalk';
import got from 'got';
import semver from 'semver';
import { getCacheFromMap, setCacheToMap } from './cache';
import { CommonOption, PackageInfo, PackageVersions, VersionOrRange } from './types';
import { execCommand } from './utils/exec';
import { formatDependencies } from './utils/format';
import { startSpinner, stopSpinner } from './utils/spinner';

let healthy = true;
export async function checkDependencies(dependencies: Record<string, VersionOrRange>, options: CommonOption) {
  const { all } = options;

  healthy = true;

  await checkDeepDependencies(dependencies, options);

  if(healthy && !all) {
    console.log(chalk.green('All packages are healthy.'));
  }
}

async function checkDeepDependencies(dependencies: Record<string, VersionOrRange>, options: CommonOption) {
  const { deep, all } = options;

  for(const packageName in dependencies) {
    const result = await getPackageInfo(packageName, dependencies[packageName]);

    if(!result) {
      continue;
    }

    if(result.deprecated) {
      healthy = false;

      console.log(chalk.yellow(`${packageName}@${result.version}: `) + result.time);
      console.log(chalk.red(`deprecated: ${result.deprecated}`))
    } else if(all) {
      console.log(chalk.green(`${packageName}@${result.version}: `) + result.time);
    }

    if(deep && result.dependencies) {
      await checkDeepDependencies(result.dependencies, options);
    }
  }
}

const packageCheckSet = new Set();
const packageResultSet = new Set();

async function getPackageInfo(packageName: string, versionOrRange: VersionOrRange) {
  const check = `${packageName}@${JSON.stringify(versionOrRange)}`;
  if(packageCheckSet.has(check)) {
    return;
  }
  packageCheckSet.add(check);
  startSpinner();

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

  let version: string | undefined | null = versionOrRange.version;

  if(!version) {
    const versions = Object.keys(packageVersions.versions);
    version = semver.maxSatisfying(versions, versionOrRange.range as string);
  }

  if(!version || !packageVersions.versions[version]) {
    stopSpinner();
    console.log(packageName, versionOrRange);
    return console.error(`${packageName}: Please enter the correct range!`);
  }

  if(packageResultSet.has(`${packageName}@${version}`)) {
    return;
  }
  packageResultSet.add(`${packageName}@${version}`);

  const packageInfo: PackageInfo = {
    version,
    time: packageVersions.time[version],
    deprecated: packageVersions.versions[version].deprecated,
    dependencies: packageVersions.versions[version].dependencies ? formatDependencies(packageVersions.versions[version].dependencies as Record<string, string>) : undefined
  }

  stopSpinner();
  return packageInfo;
}