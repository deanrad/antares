const { stdinReader, stdErrLogger, stdOutPrinter } = require("./io")
const { events } = require("./eventBus")

// What are we searching on
const _pattern = new RegExp(process.argv[2] || "o", "i")

// 2. Visualize all events on stderr
// 3. For matching line events, create match events
// 4. Print match events to stdout
// 1. Send line events into system
stdinReader.on("line", line => {
  events.trigger("line", line)
})
