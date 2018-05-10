import { fromJS, Map as iMap } from "immutable"
import iDiffer from "immutablediff"
import { diff as mongoDiffer } from "mongodb-diff"
import { applyMiddleware, combineReducers, compose, createStore } from "redux"
import { combineEpics, createEpicMiddleware } from "redux-observable"
import Rx from "rxjs/Rx"

import { enhanceActionMeta } from "./action"
import { inAgencyRun } from "./agency"
import { NewId, ViewReducer } from "./config"
import { KeyLookupFailed } from "./errors"
import { logger } from "./logger"

// immutablediff -  RFC 6902 diff as immutable List
// mongodb-diff - mongo operator
// handles storing, updating, and removing
export const antaresReducer = ({ ReducerForKey, onCacheMiss }) => (
  state,
  action
) => {
  if (!state) return new iMap()

  // these are up to the client to manage - we perform no change
  if (action.type.startsWith("View.")) return state

  let { type, payload, meta } = action

  let { antares } = meta || {}
  let providedKey = (antares || {}).key
  let providedKeyPath = [].concat(providedKey)

  // Fail if record cant be stored at this key
  if (type === "Antares.store") {
    // provide an ID if they haven't
    let keyPath = providedKey ? providedKeyPath : [NewId[0]()]

    // OVERWRITE WHAT WAS THERE BEFORE
    // Justification being: if the server tells you to do it, you should do it
    return state.setIn(keyPath, fromJS(payload))
  }

  // used for cache pre-warming. Throws KeyLookupFailed if the onCacheMiss function fails
  if (type === "Antares.fetch") {
    if (state.getIn(providedKeyPath) !== undefined) {
      return state
    }
    try {
      let value = onCacheMiss(providedKeyPath)
      return state.setIn(providedKeyPath, fromJS(value))
    } catch (ex) {
      throw new KeyLookupFailed(ex)
    }
  }

  if (type === "Antares.forget") {
    return state.deleteIn(providedKeyPath)
  }

  // An antares or other update which should target a specific key
  if (type === "Antares.update" || providedKey) {
    // Try to populate it
    if (!state.hasIn(providedKeyPath)) {
      state.setIn(providedKeyPath, fromJS(onCacheMiss(providedKeyPath)))
    }

    let reducer = ReducerForKey(providedKey)
    return state.updateIn(providedKeyPath, state => reducer(state, action))
  }

  if (type === "Antares.init") {
    // clean-slate the entire store
    return fromJS(action.payload || {})
  }

  return state
}

// Must align with the combineReducers keys
const defaultInitial = {
  antares: new iMap(),
  view: {}
}

// A utility function which incorporates Redux DevTools and optional middleware
const makeStoreFromReducer = (reducer, initialState, middleware) => {
  let composeEnhancers = compose

  // in browsers override compose to hook in DevTools
  inAgencyRun("client", function() {
    if (
      typeof window !== "undefined" &&
      typeof window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ === "function"
    )
      composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
  })

  return createStore(
    reducer,
    initialState,
    composeEnhancers(applyMiddleware(...middleware))
  )
}

const getUpdateOp = (before, after) => {
  try {
    return (before && after && mongoDiffer(before.toJS(), after.toJS())) || {}
  } catch (ex) {
    return {}
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

  logger.log(
    `Reducing ${action.type}${
      action.meta.antares.localOnly ? " (localOnly:true)" : ""
    }`,
    {
      prefix: `AS (${action.meta.antares.actionId})`
    }
  )

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
  if (action.type === "Antares.store") {
    _mongoDiff = {
      collection,
      id,
      update: true,
      upsert: true,
      updateOp: mongoDiffer({}, action.payload || {})
    }
  } else if (action.type === "Antares.forget") {
    _mongoDiff = {
      collection,
      id,
      remove: true
    }
  } else if (action.type.startsWith("View.")) {
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
      updateOp: getUpdateOp(before, after)
    }
  }

  const mongoDiff =
    _mongoDiff &&
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

export const initializeStore = ({
  ReducerForKey,
  onCacheMiss,
  Epics,
  agentId,
  notifyParentAgent,
  initialState
}) => {
  // the keys of Epics are only for documentation purposes now
  const userEpics = Object.values(Epics)
  const antaresDiff$ = new Rx.Subject()
  const viewDiff$ = new Rx.Subject()

  const middlewares = [diffMiddleware({ antaresDiff$, viewDiff$ })]
  if (userEpics) {
    // To each userEpic we append our own behaviors
    const antaresEnhancedEpics = userEpics
      .filter(userEpic => !!userEpic)
      .map(userEpic => {
        return (action$, state) => {
          const agentMatchedAction$ = action$.filter(action => {
            if (action.meta.antares.epicAgent)
              return action.meta.antares.epicAgent === agentId
            else return true
          })
          return userEpic(agentMatchedAction$, state)
            .map(action => enhanceActionMeta(action, null, { agentId }))
            .do(action =>
              logger.log(action, {
                prefix: `AEp (${action.meta.antares.actionId})`
              })
            )
            .do(notifyParentAgent)
        }
      })

    const rootEpic = combineEpics(...antaresEnhancedEpics)
    const epicMiddleware = createEpicMiddleware(rootEpic)
    middlewares.unshift(epicMiddleware)
  }

  const viewReducer = ViewReducer[0]
  const rootReducer = combineReducers({
    ...initialState,
    antares: antaresReducer({ ReducerForKey, onCacheMiss }),
    view: viewReducer
  })

  // Each middleware recieves actions produced by the previous
  const store = makeStoreFromReducer(rootReducer, initialState, middlewares)

  // Give the store magical observable properties
  return Object.assign(store, {
    diff$: antaresDiff$.asObservable(),
    viewDiff$: viewDiff$.asObservable()
  })
}
