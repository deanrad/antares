const { Agent } = require("antares-protocol")
const { empty, of } = require("rxjs")

const events = new Agent()
events.trigger = (type, payload) => {
  events.process({ type, payload })
}

module.exports = {
  events,
  empty,
  of
}
