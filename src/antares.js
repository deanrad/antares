import './_polyfills'
import Rx from 'rxjs'
import Promise from 'bluebird'
// Promise.config({
//     warnings: true,
//     longStackTraces: true,
//     cancellation: true
// })

export { default as Rx } from 'rxjs'
export const { Observable } = Rx
export {
  default as Immutable,
  fromJS,
  Map as iMap,
  List as iList
} from 'immutable'
export { createReducer } from 'redux-act'
export { combineReducers } from 'redux-immutable'
import {
  Agents,
  ViewReducer,
  MetaEnhancers,
  Epics,
  DispatchProxy,
  NewId,
  Types
} from './config'
import { enhanceActionMeta } from './action'
import { initializeStore } from './store'
import { inAgencyRun, isInAgency } from './agency'
import { createClass as createAsteroid } from 'asteroid'
import { dispatchEndpoint as defaultDispatchEndpoint } from './dispatchEndpoint'
export * from './agency'
export * from './action'
export * from './errors'
import {
  ReductionError,
  TypeValidationError,
  ParentNotificationError
} from './errors'

// Allow the caller to initialize us, extending their config onto ours
export const AntaresInit = AntaresConfig => {
  let Antares = {}
  // TODO redundant to import in Meteor which has its own ddp lib already
  const Asteroid = createAsteroid()
  let asteroid

  const noopReducer = (state = {}) => state

  // Store provided config fields
  Object.assign(Agents, AntaresConfig.Agents)
  Object.assign(Epics, AntaresConfig.Epics)
  Object.assign(Types, AntaresConfig.Types)
  ViewReducer.push(AntaresConfig.ViewReducer || noopReducer)
  MetaEnhancers.push(...(AntaresConfig.MetaEnhancers || []))

  if (AntaresConfig.newId) {
    NewId.pop()
    NewId.push(AntaresConfig.newId)
  }

  const ReducerForKey = AntaresConfig.ReducerForKey || (key => noopReducer)

  // Construct the store for this Agent!
  const store = initializeStore({ ReducerForKey })

  // Identify this instance of this JS process
  const agentId = AntaresConfig.agentId || NewId[0]()

  // notifyParentAgent
  let notifier =
    AntaresConfig.notifyParentAgent ||
    (action => {
      console.warn('No way to notify parent of action: ', action.type, agentId)
      return Promise.resolve(action)
    })

  let notifyParentAgent = action => {
    if (action.meta && action.meta.antares && action.meta.antares.localOnly) {
      return Promise.resolve()
    }
    return notifier(action)
  }

  // defineDispatchEndpoint
  if (AntaresConfig.defineDispatchEndpoint) {
    inAgencyRun('server', () => {
      AntaresConfig.defineDispatchEndpoint(defaultDispatchEndpoint(store))
    })
  }

  // defineRemoteActionsProducer
  if (AntaresConfig.defineRemoteActionsProducer) {
    inAgencyRun('server', () => {
      AntaresConfig.defineRemoteActionsProducer(store, agentId)
    })
  }

  // defineRemoteActionsConsumer
  let remoteActionDispatcher = action => {
    if (
      !(action.meta && action.meta.antares && action.meta.antares.localOnly)
    ) {
      store.dispatch(action)
    }
  }

  if (AntaresConfig.defineRemoteActionsConsumer) {
    inAgencyRun('client', () => {
      // TODO subscribe and handle resubscribing if exception occurs
      let remoteAction$ = AntaresConfig.defineRemoteActionsConsumer()
      let remoteActionsSub = remoteAction$
        .do(remoteActionDispatcher)
        .subscribe()
    })
  }

  // announce
  let dispatchAloud = action => {
    return new Promise((resolve, reject) => {
      try {
        store.dispatch(action)
        resolve(action)
      } catch (ex) {
        reject(new ReductionError(ex))
      }
    }).then(action => {
      return notifyParentAgent(action).catch(ex => {
        throw new ParentNotificationError(ex)
      })
    })
  }

  const subscribeRenderer = (renderer, opts, alternateStream) => {
    // default to sync mode
    const { mode, xform } = opts || { mode: 'sync' }

    // a stream transformer for diffs (in lieu of providing an alternateStream)
    const modifier = xform ? xform : same => same
    const _stream = alternateStream ? alternateStream : modifier(store.diff$)

    // The final stream we subscribe to with scheduling
    const observe = mode === 'async'
      ? s => s.observeOn(Rx.Scheduler.asap)
      : s => s
    const stream = observe(_stream)
    const defer = typeof setImmediate === 'function'
      ? setImmediate
      : fn => setTimeout(fn, 0)

    // NOTE: A stream will resubscribe in case of error, but the handle will be of no use to call unsubscribe on it
    // because we're subscribed on a new handle now. The fix would be to return a handle-getting function. Messy?
    const observer = {
      next: action => {
        try {
          return renderer(action)
        } catch (ex) {
          // reestablish our subscription in the next turn of the event loop
          defer(() => stream.subscribe(observer))
          // but let our caller see
          throw ex
        }
      },
      error: e => console.warn('SR> saw error', e),
      complete: e => console.warn('SR> done')
    }
    return stream.subscribe(observer)
  }

  const saveParentAgentId = store.diff$
    .map(({ action }) => action)
    .filter(({ type }) => type === 'Antares.init')
    .map(action => action.meta.antares.parentAgentId)
    .do(parentAgentId => {
      Object.assign(Antares, { parentAgentId })
      saveParentAgentId.unsubscribe()
    })
    .subscribe()

  const originate = (
    actionCreatorOrType,
    payload,
    payloadEnhancer = a => null,
    metaEnhancer = null
  ) => {
    let action
    let stowaway = payloadEnhancer()

    // Can't enhance non-Object payload like Numbers
    let enhancedPayload = payload instanceof Object
      ? { ...stowaway, ...payload }
      : payload

    // Use either of our syntaxes: ActionCreator, string, or action
    if (actionCreatorOrType.call) {
      action = actionCreatorOrType.call(null, enhancedPayload)
    } else if (actionCreatorOrType.substr) {
      action = { type: actionCreatorOrType, payload: enhancedPayload }
    } else {
      action = actionCreatorOrType
    }

    // Look up the validator and synchronously validate the payload, or throw
    const validator = Types[action.type] || (() => true)
    validator(action.payload)

    let enhancedAction = enhanceActionMeta(action, metaEnhancer, Antares)
    return enhancedAction
  }

  const announce = (
    actionCreatorOrType,
    payload,
    payloadEnhancer = a => null,
    metaEnhancer = null
  ) => {
    // Synchronously validate the payload, or throw - TODO no, keep the promise interface
    let enhancedAction = Antares.originate(
      actionCreatorOrType,
      payload,
      payloadEnhancer,
      metaEnhancer
    )
    let returnPromise = dispatchAloud(enhancedAction)

    return Object.assign(returnPromise, {
      action: enhancedAction,
      startOfEpic: () => {
        return Antares.store.diff$
          .first(({ action }) => action.type === `${enhancedAction.type}.begin`)
          .map(({ action }) => action)
          .toPromise(Promise)
      },
      endOfEpic: () => {
        return Antares.store.diff$
          .first(
            ({ action }) =>
              action.type === `${enhancedAction.type}.end` ||
              action.type === `${enhancedAction.type}.error`
            // TODO 1195:  action.meta.antares.concludesEpic === enhancedAction.meta.antares.actionId
          )
          .map(({ action }) => {
            if (action.type.endsWith('.error')) {
              throw action
            }
            return action
          })
          .toPromise(Promise)
      }
    })
  }

  Object.assign(Antares, {
    originate,
    announce,
    agentId,
    subscribe: filter => {
      // TODO provide subscription tracking functions
      asteroid.subscribe('Antares.remoteActions', filter)
    },
    subscribeRenderer,
    store,
    action$: store.diff$,
    asteroid,
    getState: () => store.getState().antares,
    getViewState: () => store.getState().view,
    Config: AntaresConfig
  })

  return Antares
}
