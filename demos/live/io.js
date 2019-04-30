const readline = require("readline")
const { fromEvent } = require("rxjs")

// Set up what we'll use
const lineReader = readline.createInterface({
  input: process.stdin
})

//--------- Consequence-Enacters (Renderers) -------//
function stdErrLogger({ action }) {
  process.stderr.write(`${action.type}: ${action.payload}`)
}
function stdOutPrinter({ action }) {
  process.stdout.write(`${action.payload}`)
}

const stdinObservable = fromEvent(lineReader, "line")

module.exports = {
  stdinReader: lineReader,
  stdinObservable,
  stdErrLogger,
  stdOutPrinter
}
