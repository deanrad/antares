import { fromJS } from 'immutable'
import { applyMiddleware, compose, createStore, combineReducers } from 'redux'
import { createEpicMiddleware, combineEpics } from 'redux-observable'

const Config = {
  antaresDefault: {},
  userProvided: {}
}

// Allow the caller to initialize us, extending their config onto ours
export const AntaresInit = (config) => {
  Config.userProvided = config

  console.info('Antares initialized.')
  return {
    News: {
      originate: (actionCreator, params) => {
        console.warn('TODO actually originate news.')
      }
    }
  }
}

export const getUserConfig = () => Config.userProvided
export const getConfig = () => Config


export class AntaresError extends Error {
    constructor({type}) { super(type) }
}

