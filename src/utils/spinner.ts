import ora from 'ora';

const spinner = ora('Checking');
let timer: NodeJS.Timeout;

export function startSpinner() {
  spinner.start();
  timer = setTimeout(() => {
    spinner.color = 'yellow';

    timer = setTimeout(() => {
      spinner.color = 'red';
    }, 30000);
  }, 30000);
}

export function stopSpinner() {
  clearTimeout(timer);
  spinner.stop();
}