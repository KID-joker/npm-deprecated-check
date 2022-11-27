import { ArgumentsCamelCase } from "yargs";
import { checkPackage } from "../check";
import { DeepOption } from "../types";
import { execCommand } from "../utils/exec";

export default async function checkGlobal(options: ArgumentsCamelCase<DeepOption>) {
  const { dependencies } = JSON.parse(execCommand('npm ls -g --depth=0 --json'));

  for(const packageName in dependencies) {
    await checkPackage(packageName, dependencies[packageName].version);
  }
}