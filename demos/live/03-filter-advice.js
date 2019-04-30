// Given: a pattern, printers and a reference to the bizConsultant service
const _pattern = new RegExp(process.argv[2] || "o", "i")

const { stdErrLogger, stdOutPrinter } = require("./io")

const { bizConsultant } = require("./consultant-svc")

// Given: an event procesor
const { events } = require("./eventBus")

// Tasks:
// 2. Visualize all events on stderr
// events.filter(/./, stdErrLogger)

// 3. For matching line events, create match events
// events.on("advice", ({ action: event }) => {
//   if (_pattern.test(event.payload)) {
//     events.trigger("moneyAdvice", event.payload)
//   }
// })

// 4. Print match events to stdout
// events.on("moneyAdvice", ({ action }) => {
//   action.payload = `$$$ : ${action.payload}`
//   stdOutPrinter({ action })
// })

// 1. Send bizConsultant events into system
// events.subscribe(bizConsultant, { type: "advice" })
