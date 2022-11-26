import chalk from "chalk";
import validate from "validate-npm-package-name";
import { ArgumentsCamelCase } from "yargs";
import { getPackageInfo } from "../check";
import { PackageOption } from "../types";
import { startSpinner, stopSpinner } from "../utils/spinner";

export async function checkPackage(options: ArgumentsCamelCase<PackageOption>) {
  startSpinner();
  const { packageName, deep, range } = options;
  const { validForNewPackages, validForOldPackages } = validate(packageName);
  if(!validForNewPackages && !validForOldPackages) {
    return console.log(chalk.red('Please enter the correct packageName!'));
  }

  try {
    const result = await getPackageInfo(packageName, range || '');

    stopSpinner();

    if(result.deprecated) {
      console.log(chalk.yellow(`${packageName}@${result.version}: `) + result.description);
      console.log(chalk.red(`deprecated: ${result.deprecated}`))
    } else {
      console.log(chalk.green(`${packageName}@${result.version}: `) + result.description);
    }
  } catch(e: any) {
    stopSpinner();

    console.error(e.message);
  }
}