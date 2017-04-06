import { applyMiddleware, compose, createStore, combineReducers } from 'redux'
import { createEpicMiddleware, combineEpics } from 'redux-observable'
import { fromJS, Map as iMap } from 'immutable'
// immutablediff -  RFC 6902 diff as immutable List
// mongodb-diff - mongo operator
import iDiffer from 'immutablediff'
import { diff as mongoDiffer } from 'mongodb-diff'
import Rx from 'rxjs/Rx'
import { Epics, ReducerForKey, ViewReducer, DispatchProxy, NewId } from './config'
import { inAgencyRun, isInAgency } from './agency'
import { AntaresError } from './errors'
import { enhanceActionMeta } from './action'

// handles storing, updating, and removing
export const antaresReducer = (state, action) => {
    if (!state) return new iMap()

    // these are up to the client to manage - we perform no change
    if (action.type.startsWith('View.')) return state

    let { type, payload, meta } = action

    let { antares } = (meta || {})
    let providedKey = (antares || {}).key
    let providedKeyPath = [].concat(providedKey)

    // Fail if record cant be stored at this key
    if (type === 'Antares.store') {
        // provide an ID if they haven't
        let keyPath = providedKey ? providedKeyPath : [NewId[0]()]

        // OVERWRITE WHAT WAS THERE BEFORE
        // Justification being: if the server tells you to do it, you should do it
        return state.setIn(keyPath, fromJS(payload))
    }

    if (type === 'Antares.forget') {
        return state.deleteIn(providedKeyPath)
    }

    // An antares or other update which should target a specific key
    if (type === 'Antares.update' || providedKey) {
        // Gracefully ignore if we don't know how to apply this message
        if (!state.hasIn(providedKeyPath)) {
            console.info(`Antares.update: Store has no value at ${providedKeyPath}:
                                  ${JSON.stringify(action, null, 2)}`)
            return state
        }

        let reducer = ReducerForKey[0](providedKey)
        return state.updateIn(providedKeyPath, state => reducer(state, action))
    }

    if (type === 'Antares.init') {
        // don't double-init if we resubscribe to remoteActions with a different criteria
        return state.size == 0 ? fromJS(action.payload) : state
    }

    return state
}

// A utility function which incorporates Redux DevTools and optional middleware
const makeStoreFromReducer = (reducer, middleware) => {
    let composeEnhancers = compose

    // in browsers override compose to hook in DevTools
    inAgencyRun('client', function () {
        if (
            typeof window !== 'undefined' &&
            typeof window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ === 'function'
        )
            composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    })

    return createStore(reducer, composeEnhancers(
        applyMiddleware(...middleware)
    ))
}

const dispatchToServer = (action) => {
    if (isInAgency('client')) {
        let dispatchProxy = DispatchProxy[0]
        dispatchProxy.call(null, action)
    }
}

const antaresDiff$ = new Rx.Subject
const viewDiff$ = new Rx.Subject

// emits a stream of diff$ (paired with the actions that caused them and the resulting state)
// resulting from the stream of Actions (including those consequences from Epics)
// that have hit this store. It should be attached after epicMiddleware in the mw chain.
const diffMiddleware = store => next => action => {
    const preState = store.getState().antares
    const preViewState = store.getState().view

    next(action) // reduce / dispatch it
    const postState = store.getState().antares

    // TODO could measure and do most performant
    const iDiffList = iDiffer(preState, postState)
    const iDiff = iDiffList.size > 0 ? iDiffList.toJS() : null


    let key = action.meta && action.meta.antares && action.meta.antares.key
    let collection = key && key.length === 2 && key[0]
    let id = key instanceof Array ? key[key.length - 1] : key
    let keyPath = key instanceof Array ? key : [key]

    let _mongoDiff
    if (action.type === 'Antares.store') {
        _mongoDiff = {
            collection,
            id,
            update: true,
            upsert: true,
            updateOp: mongoDiffer({}, (action.payload || {}))
        }
    } else if (action.type === 'Antares.forget') {
        _mongoDiff = {
            collection,
            id,
            remove: true
        }
    } else if (action.type.startsWith('View.')) {
        let postViewState = store.getState().view
        let viewIDiff = iDiffer(preViewState, postViewState)
        const viewDiff = viewIDiff.size > 0 ? viewIDiff.toJS() : null
        // emit a change on a different stream
        viewDiff$.next({
            action,
            state: postViewState,
            iDiff: viewDiff
        })
    } else if (action.meta && action.meta.antares && action.meta.antares.key) {
        let before = preState.getIn(keyPath).toJS()
        let after = postState.getIn(keyPath).toJS()
        _mongoDiff = {
            collection,
            id,
            update: true,
            updateOp: mongoDiffer(before, after)
        }
    }

    const mongoDiff = (_mongoDiff && (_mongoDiff.remove || Object.keys(_mongoDiff.updateOp).length > 0)) ? _mongoDiff : null

    // Reasons this line can fail:
    // - Reducer throws an error
    // - Renderer attached synchronously throws an error
    // if a synchronous renderer causes this to blow up, we do the least surprising thing and
    // resubscribe the renderer
    antaresDiff$.next({ action, iDiff, mongoDiff })
}

export const initializeStore = () => {
    const userEpics = Object.values(Epics)

    // To each userEpic we append our own behaviors
    const antaresEnhancedEpics = userEpics.map(userEpic => {
        return (action$, state) =>
            userEpic(action$, state)
                .map(enhanceActionMeta)
                .do(dispatchToServer)
    })

    const rootEpic = combineEpics(...antaresEnhancedEpics)
    const epicMiddleware = createEpicMiddleware(rootEpic)

    const viewReducer = ViewReducer[0]
    const rootReducer = combineReducers({
        antares: antaresReducer,
        view: viewReducer
    })

    // Each middleware recieves actions produced by the previous
    const store = makeStoreFromReducer(rootReducer, [
        epicMiddleware,
        diffMiddleware
    ])
    console.log('Initialized Antares store')

    // Give the store magical observable properties
    return Object.assign(store, {
        diff$: antaresDiff$.asObservable(),
        viewDiff$: viewDiff$.asObservable()
    })
}
