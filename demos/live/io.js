const readline = require("readline")
const { fromEvent } = require("rxjs")

// Set up what we'll use
const lineReader = readline.createInterface({
  input: process.stdin
})

//--------- Consequence-Enacters (Renderers) -------//
function stdErrLogger({ action }) {
  process.stderr.write(`${action.type}: ${action.payload}\n`)
}
function stdOutPrinter({ action }) {
  process.stdout.write(`${action.payload}\n`)
}

const stdinObservable = fromEvent(lineReader, "line")

module.exports = {
  stdinReader: lineReader,
  stdinObservable,
  stdErrLogger,
  stdOutPrinter
}
