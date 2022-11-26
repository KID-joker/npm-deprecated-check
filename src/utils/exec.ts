import { execaCommandSync } from 'execa';

export function execCommand(command: string) {
  try {
    const { stdout } = execaCommandSync(command);
    return stdout;
  } catch(error: any) {
    console.error(error?.shortMessage);
    console.log(error?.stdout);
    return error;
  }
}