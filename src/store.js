import { applyMiddleware, compose, createStore, combineReducers } from 'redux'
import { createEpicMiddleware, combineEpics } from 'redux-observable'
import { fromJS, Map as iMap } from 'immutable'
import { Epics, ReducerForKey } from './config'
import { inAgencyRun } from './agency'
import { AntaresError } from './errors'

// handles storing, updating, and removing
export const antaresReducer = (state, action) => {
    if (!state) return new iMap()

    let { type, payload, meta } = action
    console.log('AR>', { type })

    let { antares } = (meta || {})
    let { key } = (antares || {})

    // Fail if record cant be stored at this key
    if (type === 'Antares.storeAtKey') {
        if (state.has(key)) throw new AntaresError({type: 'storeAtKey'})
        return state.set(key, fromJS(payload))
    }

    // An antares or other update which should target a specific key
    if (type === 'Antares.updateAtKey' || key) {
        if (! state.has(key)) throw new AntaresError({type: 'updateAtKey'})

        let reducer = ReducerForKey[0](key)
        return state.update(key, state => reducer(state, action))
    }

    return state
}

const rootReducer = combineReducers({
    antares: antaresReducer
})

const rootEpic = combineEpics(...Object.values(Epics))
const epicMiddleware = createEpicMiddleware(rootEpic)

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

export const initializeStore = () => {
  const store = makeStoreFromReducer(rootReducer, epicMiddleware)
  console.log('Initialized Antares store')
  return store
}
