import { ArgumentsCamelCase } from "yargs";
import { checkDependencies } from "../check";
import { GlobalOption } from "../types";
import { execCommand } from "../utils/exec";

const yarnRegexp = /info "(.+)" has binaries/g;

export default function checkGlobal(options: ArgumentsCamelCase<GlobalOption>) {
  const { manager } = options;
  try {
    let dependencies: Record<string, { version: string }> = {};
    if(manager == 'pnpm') {
      const result = JSON.parse(execCommand('pnpm list -g --depth=0 --json'));
      dependencies = result
                      .map((ele: { dependencies?: object }) => ele.dependencies)
                      .reduce((previousValue: object, currentValue?: object) => Object.assign(previousValue, currentValue), {});
    } else if(manager == 'yarn') {
      const result = execCommand('yarn global list --depth=0');
      const iterator = Array.from(result.matchAll(yarnRegexp), (m: string[]) => m[1]);
      for(const dependency of iterator) {
        const index = dependency.lastIndexOf('@');
        const packageName = dependency.slice(0, index), version = dependency.slice(index + 1);
        dependencies[packageName] = { version };
      }
    } else {
      const result = JSON.parse(execCommand('npm ls -g --depth=0 --json'));
      dependencies = result.dependencies;
    }
  
    checkDependencies(dependencies, options);
  } catch(e: any) {
    console.error(e.message);
  }
}