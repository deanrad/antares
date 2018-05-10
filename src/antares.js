import "./_polyfills"

import { createClass as createAsteroid } from "asteroid"
import Promise from "bluebird"
import Rx from "rxjs"

import { enhanceActionMeta } from "./action"
import { inAgencyRun } from "./agency"
import { Agents, MetaEnhancers, NewId, Types, ViewReducer } from "./config"
import { dispatchEndpoint as defaultDispatchEndpoint } from "./dispatchEndpoint"
import { ParentNotificationError, ReductionError, RenderError } from "./errors"
import { logger } from "./logger"
import { initializeStore } from "./store"

// Promise.config({
//     warnings: true,
//     longStackTraces: true,
//     cancellation: true
// })

export { default as Rx } from "rxjs"
export { default as Promise } from "bluebird"
export const { Observable } = Rx
export {
  default as Immutable,
  fromJS,
  Map as iMap,
  List as iList
} from "immutable"
export { createReducer } from "redux-act"
export { combineReducers } from "redux-immutable"
export * from "./agency"
export * from "./action"
export * from "./errors"
// Allow the caller to initialize us, extending their config onto ours
export const AntaresInit = AntaresConfig => {
  let Antares = {}
  // TODO redundant to import in Meteor which has its own ddp lib already
  const Asteroid = createAsteroid()
  let asteroid

  const noopReducer = (state = {}) => state

  // Store provided config fields
  Object.assign(Agents, AntaresConfig.Agents)
  Object.assign(Types, AntaresConfig.Types)
  ViewReducer.push(AntaresConfig.ViewReducer || noopReducer)
  MetaEnhancers.push(...(AntaresConfig.MetaEnhancers || []))

  if (AntaresConfig.newId) {
    NewId.pop()
    NewId.push(AntaresConfig.newId)
  }

  const ReducerForKey = AntaresConfig.ReducerForKey || (key => noopReducer)
  const onCacheMiss = AntaresConfig.onCacheMiss || (() => null)
  const Epics = AntaresConfig.Epics || {}

  // Identify this instance of this JS process
  const agentId = AntaresConfig.agentId || NewId[0]()
  const initialState = AntaresConfig.initialState

  // notifyParentAgent
  let notifier =
    AntaresConfig.notifyParentAgent ||
    (action => {
      logger.warn("No way to notify parent of action: ", action.type, agentId)
      return Promise.resolve(action)
    })

  let notifyParentAgent = action => {
    if (action.meta && action.meta.antares && action.meta.antares.localOnly) {
      return Promise.resolve()
    }
    return notifier(action)
  }

  // Construct the store for this Agent!
  const store = initializeStore({
    ReducerForKey,
    onCacheMiss,
    Epics,
    agentId,
    notifyParentAgent,
    initialState
  })

  // defineDispatchEndpoint
  if (AntaresConfig.defineDispatchEndpoint) {
    inAgencyRun("server", () => {
      AntaresConfig.defineDispatchEndpoint(defaultDispatchEndpoint(store))
    })
  }

  // defineRemoteActionsProducer
  if (AntaresConfig.defineRemoteActionsProducer) {
    inAgencyRun("server", () => {
      AntaresConfig.defineRemoteActionsProducer({ store, agentId, onCacheMiss })
    })
  }

  // defineRemoteActionsConsumer
  let remoteActionDispatcher = action => {
    store.dispatch(action)
  }

  if (AntaresConfig.defineRemoteActionsConsumer) {
    inAgencyRun("client", () => {
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
        if (ex instanceof RenderError) {
          reject(ex)
        } else {
          reject(new ReductionError(ex))
        }
      }
    })
      .then(action => {
        return notifyParentAgent(action).catch(ex => {
          throw new ParentNotificationError(ex)
        })
      })
      .catch(ex => {
        logger.error("Antares Exception: ", ex, ex.stack)
        throw ex
      })
  }

  // in order subscribed
  let allRenderersCount = 0

  const subscribeRenderer = (
    renderer = () => {},
    opts = {},
    alternateStream
  ) => {
    const {
      mode = "sync",
      xform = same => same,
      filter = () => true,
      actionStreamKey = `renderer[${allRenderersCount}]`
    } = opts

    allRenderersCount += 1

    // or provide an alternate stream
    const actionStream = alternateStream
      ? alternateStream
      : xform(store.diff$.filter(filter))

    // The final stream we subscribe to with scheduling
    // About RXJS5 schedulers: https://github.com/ReactiveX/rxjs/blob/master/doc/scheduler.md
    const scheduledStream =
      mode === "async"
        ? actionStream.observeOn(Rx.Scheduler.asap)
        : actionStream

    // This turns out to a great way to defer - it puts an item on
    // the microtask queue, executing ASAP in most cases
    // See https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/
    const defer = fn => Promise.resolve().then(fn)

    const observer = {
      next: streamItem => {
        try {
          let retVal = renderer(streamItem)
          // TODO in sync mode, await a promise, or whatever it is
          streamItem[actionStreamKey] = retVal
        } catch (ex) {
          // reestablish our subscription in the next turn of the event loop
          defer(() => scheduledStream.subscribe(observer))
          throw new RenderError(ex)
        }
      },
      error: e => logger.warn("SR> saw error", e),
      complete: e => logger.warn("SR> done")
    }
    return scheduledStream.subscribe(observer)
  }

  const saveParentAgentId = store.diff$
    .map(({ action }) => action)
    .filter(({ type }) => type === "Antares.init")
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
    let enhancedPayload =
      payload instanceof Object ? { ...stowaway, ...payload } : payload

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

  // TODO simplify this interface!
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

    logger.log(`Saw action of type: ${enhancedAction.type}`, {
      prefix: `AA (${enhancedAction.meta.antares.actionId})`,
      inAgency: "server"
    })

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
            if (action.type.endsWith(".error")) {
              throw action
            }
            return action
          })
          .toPromise(Promise)
      }
    })
  }

  // goes through the announce pipeline, but with localOnly flag set so its not shared with other agents
  const process = action => {
    action.meta = action.meta || {}
    action.meta.antares = action.meta.antares || {}
    action.meta.antares.localOnly = true

    return announce(action)
  }

  Object.assign(Antares, {
    originate,
    announce,
    process,
    agentId,
    subscribe: filter => {
      // TODO provide subscription tracking functions
      asteroid.subscribe("Antares.remoteActions", filter)
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
