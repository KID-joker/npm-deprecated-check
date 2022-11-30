import fs from "fs-extra";
import { resolve } from 'path'
import { VersionOrRange } from "../types";

const packageJsonPath = resolve('./package.json');

export function getDependenciesOfPackageJson() {
  if(!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json does not exist in the current path, please execute it under the correct project path.');
  }

  const { dependencies, devDependencies } = fs.readJsonSync(packageJsonPath);

  return {
    ...formatDependencies(dependencies),
    ...formatDependencies(devDependencies)
  }
}

function formatDependencies(dependencies: Record<string, string>) {
  const newDependencies: Record<string, VersionOrRange> = {}
  for(const packageName in dependencies) {
    newDependencies[packageName] = {
      range: dependencies[packageName]
    }
  }
  return newDependencies;
}