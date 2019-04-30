const { events, empty, of } = require("./eventBus")
const { stdinReader, stdErrLogger, stdOutPrinter, stdinObservable } = require("./io")

// What are we searching on
const _pattern = new RegExp(process.argv[2] || "o", "i")

// stderr: Show us what grep's 'thoughts' are, as events.
// stdout: Pass only the lines which matched to stdout
events.filter(/./, stdErrLogger)
events.filter("match", stdOutPrinter)

// Upon events of type "line", trigger a "match" if we're matching the pattern
// 1. Imperatively invoking
events.on("line", ({ action }) => {
  const line = action.payload
  if (_pattern.test(line)) {
    events.trigger("match", line)
  }
})

// 2. Observable-returning
// events.on(
//   "line",
//   ({ event }) => {
//     const line = event.payload
//     return _pattern.test(line) ? of(line) : empty()
//   },
//   { type: "match" }
// )

// Start it up - trigger it all!
// 1. Imperative
stdinReader.on("line", line => {
  events.trigger("line", line)
})
// 2. Reactive - Subscription first
// const stdinObservable = fromEvent(stdinReader, "line")
// stdinObservable.subscribe(line => {
//   events.trigger("line", line)
// })
// 3. Reactive, Stream first
// const stdinObservable = fromEvent(stdinReader, "line")
// events.subscribe(stdinObservable, { type: "line" })
