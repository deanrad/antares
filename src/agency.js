import { Agents } from './config'
import { AntaresProto } from './AntaresProto'

export const isInAgency = (agencyType) => {
    let runOnThisAgent = Agents[agencyType] || (() => false)
    return runOnThisAgent()
}

export const inAgencyRun = (agencyType, fn) => {
    isInAgency(agencyType) && fn.call(this || global)
}

export const saveParentAgentId = (action$) => {
    var sub = action$
        .filter(({ type }) => type === 'Antares.init')
        .map(action => action.meta.parentAgentId)
        .do(parentAgentId => {
            Object.assign(AntaresProto, { parentAgentId })
            sub.unsubscribe()
        }).subscribe()
}
