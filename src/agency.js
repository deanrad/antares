import { Agents } from "./config"

export const isInAgency = agencyType => {
  let runOnThisAgent = Agents[agencyType] || (() => false)
  return runOnThisAgent()
}

export const inAgencyRun = (givenType, fn) => {
  const agencyType = givenType === "*" ? "any" : givenType
  isInAgency(agencyType) && fn.call(this || global)
}
