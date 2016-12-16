import { fromJS } from 'immutable'
import { applyMiddleware, compose, createStore, combineReducers } from 'redux'
import { createEpicMiddleware, combineEpics } from 'redux-observable'

// Allow the caller to initialize our variables; give them references to functions.
let _Agents
let _AgentEvents
let _newId
let _Types
let _Actions
let _reducerFromKey
let _Epics
let _Selectors


// bind these variables to what's been given us
export default ({
    Agents, AgentEvents,
    newId,
    Types,
    Actions,
    reducerFromKey,
    Epics,
    Selectors
}) => {
  _Agents = Agents
  _AgentEvents = AgentEvents
  _newId = newId
  _Types = Types
  _Actions = Actions
  _reducerFromKey = reducerFromKey
  _Epics = Epics
  _Selectors = Selectors

}

export class AntaresError extends Error {
    constructor({type}) { super(type) }
}

