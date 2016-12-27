import { Agents } from './config'

export const isInAgency = (agencyType) => {
    let runOnThisAgent = Agents[agencyType] || (() => false)
    return runOnThisAgent()
}

export const inAgencyRun = (agencyType, fn) => {
    isInAgency(agencyType) && fn.call(this)
}
