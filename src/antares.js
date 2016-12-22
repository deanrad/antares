import { fromJS } from 'immutable'
import { applyMiddleware, compose, createStore, combineReducers } from 'redux'
import { createEpicMiddleware, combineEpics } from 'redux-observable'

const Config = {
  antaresDefault: {},
  userProvided: {}
}

// Allow the caller to initialize us, extending their config onto ours
export default (config) => {
  Config.userProvided = config


  return {
    News: {
      originate: (actionCreator, params) => {}
    }
  }
}

export const getUserConfig = () => Config.userProvided
export const getConfig = () => Config


export class AntaresError extends Error {
    constructor({type}) { super(type) }
}

