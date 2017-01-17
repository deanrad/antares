import { fromJS, Map as iMap } from 'immutable'
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

  const store = initializeStore()

  const userDispatchProxy = AntaresConfig.defineDispatchProxy()
  const dispatchProxy = action => {
    // Withhold localOnly actions from the wire
    if (action.meta && action.meta.antares && action.meta.antares.localOnly) {
      return
    }
    return userDispatchProxy(action)
  }

  // dispatcher is a location-unaware function to dispatch and return a Promise
  let dispatcher

  // The dispatch endpoint on the server does
  // 1) dispatch action to the store
  // 2) notify other users
  inAgencyRun('server', () => {
    const dispatchEndpoint = AntaresConfig.defineDispatchEndpoint(store)
    dispatcher = intent => {
      return new Promise(resolve => dispatchEndpoint.call(null, intent))
    }
  })

  // The client side version must do what the server does, but 
  // invoke the dispatchProxy, which presumes the action has been reduced to the local store
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

  const Antares = {
    announce: (actionCreatorOrType, payload, payloadEnhancer = (a => null), metaEnhancer) => {
      let action
      let stowaway = payloadEnhancer()

      // Can't enhance non-Object payload like Numbers
      let enhancedPayload = payload instanceof Object ? { ...stowaway, ...payload } : payload

      if (actionCreatorOrType.call) {
        action = actionCreatorOrType.call(null, enhancedPayload)
      } else {
        action = { type: actionCreatorOrType, payload: enhancedPayload }
      }
      let enhancedAction = enhanceActionMeta(action, metaEnhancer)

      // record in our store (throwing if invalid)
      return dispatcher.call(null, enhancedAction)      
    },
    store,
    dispatchProxy,
    Config: { Agents }
  }

  console.info('Antares initialized.')
  return Antares
}
