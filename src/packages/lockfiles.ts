import { readWantedLockfile } from "@pnpm/lockfile-file";
import lockfile from '@yarnpkg/lockfile';
import dp from 'dependency-path';
import fs from "fs-extra";
import { resolve } from 'path';
import { VersionOrRange } from "../types";

const npmLockPath = resolve('./package-lock.json');
const yarnLockPath = resolve('./yarn.lock');
const pnpmLockPath = resolve('./pnpm-lock.yaml');

export function getDependenciesOfLockfile(packages: { [k: string]: VersionOrRange }) {
  const npmLock = {
    path: npmLockPath,
    read: function() {
      const { dependencies } = fs.readJsonSync(this.path);
      const result: Record<string, VersionOrRange> = {};
      for(const packageName in packages) {
        result[packageName] = { version: dependencies[packageName].version };
      }
      return result;
    }
  }, yarnLock = {
    path: yarnLockPath,
    read: function() {
      const content = fs.readFileSync(this.path).toString('utf-8');
      const json = lockfile.parse(content);
      const result: Record<string, VersionOrRange> = {};
      for(const packageName in packages) {
        result[packageName] = { version: json.object[`${packageName}@${packages[packageName].range}`].version }
      }
      return result;
    }
  }, pnpmLock = {
    path: pnpmLockPath,
    read: async function() {
      const content = await readWantedLockfile(resolve(this.path, '..'), { ignoreIncompatible: false });
      if(content && content.packages) {
        const packageNames = Object.keys(packages);
        const result: Record<string, VersionOrRange> = {};
        for(const depPath of Object.keys(content.packages)) {
          const info = dp.parse(depPath);
          if(packageNames.includes(info.name as string)) {
            result[info.name as string] = { version: info.version };
          }
        }
        return result;
      } else {
        return {};
      }
    }
  }

  const result = [npmLock, yarnLock, pnpmLock]
    .filter(ele => fs.existsSync(ele.path))
    .sort((a, b) => fs.lstatSync(a.path).mtimeMs - fs.lstatSync(b.path).mtimeMs)
    .reduce(async (total, current) => Object.assign(total, await current.read()), {});

  return Promise.resolve(result);
}