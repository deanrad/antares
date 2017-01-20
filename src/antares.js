import { fromJS, Map as iMap } from 'immutable'
import Rx from 'rxjs'
import { Agents, ReducerForKey, ViewReducer, MetaEnhancers, Epics, DispatchProxy, NewId } from './config'
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
  ViewReducer.push(AntaresConfig.ViewReducer)
  NewId.push(AntaresConfig.newId)
  ReducerForKey.push(AntaresConfig.ReducerForKey)
  MetaEnhancers.push(...AntaresConfig.MetaEnhancers)

  // Construct the store for this Agent!
  const store = initializeStore()

  // dispatcher is a location-unaware function to dispatch and return a Promise
  // Should accept an intent, and return a Promise for an ACK
  let dispatcher

  // on the client define the endpoint for server communication
  const userDispatchProxy = AntaresConfig.defineDispatchProxy()
  const dispatchProxy = action => {
    // Withhold localOnly actions from the wire
    if (action.meta && action.meta.antares && action.meta.antares.localOnly) {
      return
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

  const subscribeRenderer = (renderer, { mode, xform }, alternateStream) => {
    const diff$ = alternateStream ? alternateStream : store.diff$
    const modifier = xform ? xform : same => same
    const observer = (mode === 'async') ? s => s.observeOn(Rx.Scheduler.asap) : s => s
    const stream = observer(modifier(diff$))
      //.observeOn(mode === 'async' ? Rx.Scheduler.async : Rx.Scheduler.immediate)

    return stream.subscribe(renderer)
  }

  const Antares = {
    announce: (actionCreatorOrType, payload, payloadEnhancer = (a => null), metaEnhancer = null) => {
      let action
      let stowaway = payloadEnhancer()

      // Can't enhance non-Object payload like Numbers
      let enhancedPayload = payload instanceof Object ? { ...stowaway, ...payload } : payload

      // Use either of our syntaxes: ActionCreator, string, or action
      if (actionCreatorOrType.call) {
        action = actionCreatorOrType.call(null, enhancedPayload)
      } else if (actionCreatorOrType instanceof String) {
        action = { type: actionCreatorOrType, payload: enhancedPayload }
      } else {
        action = actionCreatorOrType
      }

      let enhancedAction = enhanceActionMeta(action, metaEnhancer)

      // record in our store (throwing if invalid)
      return dispatcher.call(null, enhancedAction)      
    },
    Actions: AntaresConfig.Actions,
    subscribeRenderer,
    store,
    dispatchProxy,
    Config: { Agents }
  }

  console.info('Antares initialized.')
  return Antares
}
