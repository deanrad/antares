import { applyMiddleware, compose, createStore, combineReducers } from 'redux'
import { createEpicMiddleware, combineEpics } from 'redux-observable'
import { fromJS, Map as iMap } from 'immutable'
// immutablediff -  RFC 6902 diff as immutable List
// mongodb-diff - mongo operator
import iDiffer from 'immutablediff'
import { diff as mongoDiffer } from 'mongodb-diff'
import Rx from 'rxjs/Rx'
import { Epics, ViewReducer, DispatchProxy, NewId } from './config'
import { inAgencyRun, isInAgency } from './agency'
import { KeyLookupFailed } from './errors'
import { enhanceActionMeta } from './action'

// handles storing, updating, and removing
export const antaresReducer = ({ ReducerForKey, onKeyNotDefined }) => (state, action) => {
  if (!state) return new iMap()

  // these are up to the client to manage - we perform no change
  if (action.type.startsWith('View.')) return state

  let { type, payload, meta } = action

  let { antares } = meta || {}
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

  // used for cache pre-warming. Throws KeyLookupFailed if the onKeyNotDefined function fails
  if (type === 'Antares.fetch') {
    if (state.getIn(providedKeyPath) !== undefined) {
      return state
    }
    try {
      let value = onKeyNotDefined(providedKeyPath)
      return state.setIn(providedKeyPath, fromJS(value))
    } catch (ex) {
      throw new KeyLookupFailed(ex)
    }
  }

  if (type === 'Antares.forget') {
    return state.deleteIn(providedKeyPath)
  }

  // An antares or other update which should target a specific key
  if (type === 'Antares.update' || providedKey) {
    // Try to populate it
    if (!state.hasIn(providedKeyPath)) {
        state.setIn(providedKeyPath, fromJS(onKeyNotDefined(providedKeyPath)))
    }

    let reducer = ReducerForKey(providedKey)
    return state.updateIn(providedKeyPath, state => reducer(state, action))
  }

  if (type === 'Antares.init') {
    // don't double-init if we resubscribe to remoteActions with a different criteria
    return state.size == 0 ? fromJS(action.payload || {}) : state
  }

  return state
}

// A utility function which incorporates Redux DevTools and optional middleware
const makeStoreFromReducer = (reducer, middleware) => {
  let composeEnhancers = compose

  // in browsers override compose to hook in DevTools
  inAgencyRun('client', function() {
    if (
      typeof window !== 'undefined' &&
      typeof window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ === 'function'
    )
      composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
  })

  return createStore(reducer, composeEnhancers(applyMiddleware(...middleware)))
}

const dispatchToOthers = action => {
  if (isInAgency('client')) {
    let dispatchProxy = DispatchProxy[0]
    dispatchProxy.call(null, action)
  } else {
    // so it appears to have come from us
    delete action.meta.antares.connectionId
    action.meta.antares.originAgentId = Antares.agentId
    remoteActions.next(action)
  }
}

// emits a stream of diff$ (paired with the actions that caused them and the resulting state)
// resulting from the stream of Actions (including those consequences from Epics)
// that have hit this store. It should be attached after epicMiddleware in the mw chain.
const diffMiddleware = ({
  antaresDiff$,
  viewDiff$
}) => store => next => action => {
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
      updateOp: mongoDiffer({}, action.payload || {})
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
    let before = preState.getIn(keyPath)
    let after = postState.getIn(keyPath)
    _mongoDiff = {
      collection,
      id,
      update: true,
      updateOp: (before &&
        after &&
        mongoDiffer(before.toJS(), after.toJS())) || {}
    }
  }

  const mongoDiff = _mongoDiff &&
    (_mongoDiff.remove || Object.keys(_mongoDiff.updateOp).length > 0)
    ? _mongoDiff
    : null

  // Reasons this line can fail:
  // - Reducer throws an error
  // - Renderer attached synchronously throws an error
  // if a synchronous renderer causes this to blow up, we do the least surprising thing and
  // resubscribe the renderer
  antaresDiff$.next({ action, iDiff, mongoDiff })
}

export const initializeStore = ({ ReducerForKey, onKeyNotDefined }) => {
  // the keys are only for documentation purposes now
  const userEpics = Object.values(Epics)
  const antaresDiff$ = new Rx.Subject()
  const viewDiff$ = new Rx.Subject()

  const middlewares = [diffMiddleware({ antaresDiff$, viewDiff$ })]
  if (userEpics) {
    // To each userEpic we append our own behaviors
    const antaresEnhancedEpics = userEpics.map(userEpic => {
      return (action$, state) =>
        userEpic(action$, state).map(enhanceActionMeta).do(dispatchToOthers)
    })

    const rootEpic = combineEpics(...antaresEnhancedEpics)
    const epicMiddleware = createEpicMiddleware(rootEpic)
//    middlewares.unshift(epicMiddleware)
  }

  const viewReducer = ViewReducer[0]
  const rootReducer = combineReducers({
    antares: antaresReducer({ ReducerForKey, onKeyNotDefined }),
    view: viewReducer
  })

  // Each middleware recieves actions produced by the previous
  const store = makeStoreFromReducer(rootReducer, middlewares)

  // Give the store magical observable properties
  return Object.assign(store, {
    diff$: antaresDiff$.asObservable(),
    viewDiff$: viewDiff$.asObservable()
  })
}
