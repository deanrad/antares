import { applyMiddleware, compose, createStore, combineReducers } from 'redux'
import { createEpicMiddleware, combineEpics } from 'redux-observable'
import { fromJS, Map as iMap } from 'immutable'
import Rx from 'rxjs/Rx'
import { Epics, ReducerForKey, DispatchProxy } from './config'
import { inAgencyRun, isInAgency } from './agency'
import { AntaresError } from './errors'
import { enhanceActionMeta } from './action'

// handles storing, updating, and removing
export const antaresReducer = (state, action) => {
    if (!state) return new iMap()

    let { type, payload, meta } = action
    console.log('AR>', action)

    let { antares } = (meta || {})
    let { key } = (antares || {})

    // Fail if record cant be stored at this key
    if (type === 'Antares.storeAtKey') {
        // if (state.has(key)) throw new AntaresError(`Antares.storeAtKey: Store already has a value at ${key}`)
        return state.set(key, fromJS(payload))
    }

    // An antares or other update which should target a specific key
    if (type === 'Antares.updateAtKey' || key) {
        if (! state.has(key)) throw new AntaresError(`Antares.updateAtKey: Store has no value at ${key}`)

        let reducer = ReducerForKey[0](key)
        return state.update(key, state => reducer(state, action))
    }

    return state
}

const rootReducer = combineReducers({
    antares: antaresReducer
})

// A utility function which incorporates Redux DevTools and optional middleware
const makeStoreFromReducer = (reducer, ...middleware) => {
    let composeEnhancers = compose

    // in browsers override compose to hook in DevTools
    inAgencyRun('client', function() {
        composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    })

    return createStore(reducer, composeEnhancers(
        applyMiddleware(...middleware)
    ))
}

const onClientSendToServer = (action) => {
  if( isInAgency('client') ) {
    let dispatchProxy = DispatchProxy[0]
    dispatchProxy.call(null, action)
  }
}

export const initializeStore = () => {
  const userEpics = Object.values(Epics)

  // To each userEpic we append our own behaviors
  const antaresEnhancedEpics = userEpics.map(userEpic => {
    return (action$, state) =>
      userEpic(action$, state)
        .map(enhanceActionMeta)
        .do(onClientSendToServer)
  })
  const rootEpic = combineEpics(...antaresEnhancedEpics)
  const epicMiddleware = createEpicMiddleware(rootEpic)
  const store = makeStoreFromReducer(rootReducer, epicMiddleware)
  console.log('Initialized Antares store')
  return store
}
