import { default as Immutable, fromJS, Map as iMap } from 'immutable'
import Rx from 'rxjs'
export { default as Rx } from 'rxjs'
import { Agents, ReducerForKey, ViewReducer, MetaEnhancers, Epics, DispatchProxy, NewId, Types } from './config'
import { enhanceActionMeta } from './action'
import { initializeStore } from './store'
import { inAgencyRun } from './agency'
export * from './agency'
export * from './action'

// Allow the caller to initialize us, extending their config onto ours
export const AntaresInit = (AntaresConfig) => {

  // Store provided config fields
  Object.assign(Agents, AntaresConfig.Agents)
  Object.assign(Epics, AntaresConfig.Epics)
  Object.assign(Types, AntaresConfig.Types)
  ViewReducer.push(AntaresConfig.ViewReducer)
  NewId.push(AntaresConfig.newId)
  ReducerForKey.push(AntaresConfig.ReducerForKey)
  MetaEnhancers.push(...(AntaresConfig.MetaEnhancers || []))

  // Construct the store for this Agent!
  const store = initializeStore()
  // dispatcher is a location-unaware function to dispatch and return a Promise
  // Should accept an intent, and return a Promise for an ACK
  let dispatcher

  if (!AntaresConfig.defineDispatchProxy ||
      !AntaresConfig.defineDispatchEndpoint ||
      !AntaresConfig.defineRemoteActionsProducer ||
      !AntaresConfig.defineRemoteActionsConsumer
  ) {
    dispatcher = () => console.error('Antares: running without full config')
  } else {

    // on the client define the endpoint for server communication
    const userDispatchProxy = AntaresConfig.defineDispatchProxy()
    const dispatchProxy = action => {
      // Withhold localOnly actions from the wire
      if (action.meta && action.meta.antares && action.meta.antares.localOnly) {
        return Promise.resolve()
      }
      return userDispatchProxy(action)
    }

    // The dispatch endpoint on the server does
    // 1) dispatch action to the store
    // 2) notify other users
    inAgencyRun('server', () => {
      const dispatchEndpoint = AntaresConfig.defineDispatchEndpoint(store)
      dispatcher = intent => {
        return new Promise(resolve => dispatchEndpoint.call(null, intent))
      }
    })

    // The client side version must call the server, but only after first
    // synchronously reducing it into its own store, validating it.
    inAgencyRun('client', () => {
      DispatchProxy.push(dispatchProxy)

      // when Antares.announce is called on the client
      dispatcher = intent => {
        store.dispatch(intent)
        return dispatchProxy(intent)
      }
    })

    // Provide the publication endpoint
    inAgencyRun('server', () => {
      AntaresConfig.defineRemoteActionsProducer(store)
    })

    // Ensure we're listening for remoteActions and applying them to our store
    inAgencyRun('client', () => {
      const remoteAction$ = AntaresConfig.defineRemoteActionsConsumer()
      remoteAction$.subscribe(action => store.dispatch(action))
    })
  }

  const subscribeRenderer = (renderer, opts, alternateStream) => {
    // default to sync mode
    const { mode, xform } = opts || { mode: 'sync' }

    // a stream transformer for diffs (in lieu of providing an alternateStream)
    const modifier = xform ? xform : (same => same)
    const _stream = alternateStream ? alternateStream : modifier(store.diff$)

    // The final stream we subscribe to with scheduling 
    const observer = (mode === 'async') ? s => s.observeOn(Rx.Scheduler.asap) : s => s
    const stream = observer(_stream)

    return stream.subscribe(renderer)
  }

  const Antares = {
    originate: (actionCreatorOrType, payload, payloadEnhancer = (a => null), metaEnhancer = null) => {
      let action
      let stowaway = payloadEnhancer()

      // Can't enhance non-Object payload like Numbers
      let enhancedPayload = payload instanceof Object ? { ...stowaway, ...payload } : payload

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

      let enhancedAction = enhanceActionMeta(action, metaEnhancer)
      return enhancedAction
    },
    announce: (actionCreatorOrType, payload, payloadEnhancer = (a => null), metaEnhancer = null) => {
      let enhancedAction

      try {
        enhancedAction = Antares.originate(actionCreatorOrType, payload, payloadEnhancer, metaEnhancer)
      } catch (err) {
        return Promise.reject(err)
      }

      let returnPromise = dispatcher.call(null, enhancedAction)
      
      return Object.assign(returnPromise, {
        action: enhancedAction,
        startOfEpic: () => {
          return Antares.store.diff$.first(({ action }) =>
            action.type === `${enhancedAction.type}.begin`
          )
          .map(({ action }) => action)
          .toPromise()
        },
        endOfEpic: () => {
          return Antares.store.diff$.first(({ action }) =>
            action.type === `${enhancedAction.type}.end` ||
            action.type === `${enhancedAction.type}.error`
          )
          .map(({ action }) => {
            if (action.type.endsWith('.error')) {
              throw action
            }
            return action
          })
          .toPromise()
        }
      })
    },
    subscribeRenderer,
    store,
    getState: () => store.getState().antares,
    getViewState: () => store.getState().view,
    Rx,
    Immutable,
    Config: AntaresConfig
  }

  console.info('Antares initialized.')
  return Antares
}
