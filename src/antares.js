import { fromJS } from 'immutable'
import { applyMiddleware, compose, createStore, combineReducers } from 'redux'
import { createEpicMiddleware, combineEpics } from 'redux-observable'

const Agents = {}

// Allow the caller to initialize us, extending their config onto ours
export const AntaresInit = (AntaresConfig) => {
  console.info('Antares initialized.')

  Object.assign(Agents, AntaresConfig.Agents)

  const Antares = {
    originate: (actionCreator, params) => {
      console.warn('TODO actually originate news.')
      return { type: 'Antares.test' }
    },
    dispatch: (actionCreator, params) => {
      let action = Antares.originate(actionCreator, params)
      console.warn('TODO actually dispatch news.')
    },
    Config: { Agents }
  }

  return {Antares}
}

export const isInAgency = (agencyType) => {
    let runOnThisAgent = Agents[agencyType] || (() => false)
    return runOnThisAgent()
}

export const inAgencyRun = (agencyType, fn) => {
    isInAgency(agencyType) && fn.call(this)
}

export const getUserConfig = () => Config.userProvided
export const getConfig = () => Config

export class AntaresError extends Error {
    constructor({type}) { super(type) }
}

