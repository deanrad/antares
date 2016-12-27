import { applyMiddleware, compose, createStore, combineReducers } from 'redux'
import { createEpicMiddleware, combineEpics } from 'redux-observable'
import { fromJS, Map as iMap } from 'immutable'
import { Epics } from './config'
import { inAgencyRun } from './agency'

export const antaresReducer = (state, action) => {
    if (!state) return new iMap()

    let { type, payload, meta } = action
    console.log('AR>', { type })

    let { antares } = (meta || {})
    let { createAtKey, key } = (antares || {})

    // meta.antares.createAtKey - fail if record cant be stored using this key
    if (createAtKey) {
        if (state.has(createAtKey)) throw new AntaresError({type: 'createAtKey'})
        return state.set(createAtKey, fromJS(payload))
    }

    // meta.antares.key - updates should be targeted to this key
    if (key) {
        if (! state.has(key)) throw new AntaresError({type: 'updateKey'})

        let reducer = ReducerFromKey(key)
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
