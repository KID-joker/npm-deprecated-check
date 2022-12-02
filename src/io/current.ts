import chalk from "chalk";
import { ArgumentsCamelCase } from "yargs";
import { checkPackage } from "../check";
import { isGitPackage, isLocalPackage, isURLPackage } from "../filter";
import { getDependenciesOfLockfile } from "../packages/lockfiles";
import { getDependenciesOfPackageJson } from "../packages/package_json";
import { CommonOption } from "../types";

export default async function checkCurrent(options: ArgumentsCamelCase<CommonOption>) {
  const { deep, all } = options;
  try {
    const dependenciesOfPackageJson = getDependenciesOfPackageJson();

    if(!dependenciesOfPackageJson) {
      return;
    }

    const entries = Object.entries(dependenciesOfPackageJson)
                          .filter(ele => !isLocalPackage(ele[1].range as string) && !isURLPackage(ele[1].range as string) && !isGitPackage(ele[1].range as string));

    const npmDependencies = Object.fromEntries(entries);

    const dependenciesOfLockfile = await getDependenciesOfLockfile(npmDependencies);

    const dependencies = Object.assign(npmDependencies, dependenciesOfLockfile);

    let healthy = true;

    for(const packageName in dependencies) {
      const result = await checkPackage(packageName, dependencies[packageName], all);

      if(!result) {
        continue;
      }

      if(result.deprecated) {
        healthy = false;
      }
    }

    if(healthy && !all) {
      console.log(chalk.green('All packages are healthy.'));
    }
  } catch(e: any) {
    console.error(e.message);
  }
}