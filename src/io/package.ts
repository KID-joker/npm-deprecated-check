import chalk from "chalk";
import validate from "validate-npm-package-name";
import { ArgumentsCamelCase } from "yargs";
import { checkDependencies } from "../check";
import { PackageOption } from "../types";

export default function checkSpecified(options: ArgumentsCamelCase<PackageOption>) {
  const { packageName, deep, range } = options;
  const { validForNewPackages, validForOldPackages } = validate(packageName);
  if(!validForNewPackages && !validForOldPackages) {
    return console.log(chalk.red('Please enter the correct packageName!'));
  }

  checkDependencies({ [packageName]: { range } }, { all: true, deep });
}