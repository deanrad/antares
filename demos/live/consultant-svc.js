const { spawn } = require("child_process")
const { Observable } = require("rxjs")
const {} = require("rxjs/operators")

const bizConsultant = new Observable(notify => {
  // the logic to start the function
  const serverProc = spawn("node", [__dirname + "/biz-consultant.js"])

  // the call to pass observations up
  serverProc.stdout.on("data", data => {
    notify.next(data)
  })

  serverProc.on("close", code => {
    if (code !== 0) {
      notify.error(code)
    } else {
      notify.complete()
    }
  })

  // the cleanup function to call upon unsubscribe
  return () => serverProc.kill("SIGINT")
})

module.exports = {
  bizConsultant
}
