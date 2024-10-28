import yoctoSpinner from 'yocto-spinner'

const spinner = yoctoSpinner({ text: 'Checking…' })
let timer: NodeJS.Timeout

export function startSpinner() {
  spinner.color = 'green'
  spinner.start()
  timer = setTimeout(() => {
    spinner.color = 'yellow'

    timer = setTimeout(() => {
      spinner.color = 'red'
    }, 30000)
  }, 30000)
}

export function stopSpinner() {
  clearTimeout(timer)
  spinner.stop()
}
