const { Agent } = require("antares-protocol")
const agent = new Agent()

const writeLine = text => ({
  payload: {
    text,
    encoding: "UTF8",
    path: "./demos/scratch/live-actors.yml"
  }
})

const fileRenderer = ({ action }) => {
  const { path, text, encoding } = action.payload
  const line = " - " + text + "\n"

  const fs = require("fs")
  fs.appendFileSync(path, line, encoding)
}
const logger = ({ action }) => {
  console.log(`Got ${action.payload.text}`)
}

// Make the fileRenderer responsible for certain actions
agent.addRenderer(fileRenderer)
agent.addRenderer(logger)

const action = writeLine("Jake Weary")
agent.process(action)