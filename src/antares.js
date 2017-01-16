import { fromJS, Map as iMap } from 'immutable'
import { Agents, ReducerForKey, ViewReducer, MetaEnhancers, Epics, DispatchProxy } from './config'
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

  inAgencyRun('client', () => {
    DispatchProxy.push(dispatchProxy)
  })

  inAgencyRun('server', () => {
    AntaresConfig.defineDispatchEndpoint(store)
    AntaresConfig.defineRemoteActionsProducer(store)
  })

  // Ensure we're listening for remoteActions and applying them to our store
  inAgencyRun('client', () => {
    const remoteAction$ = AntaresConfig.defineRemoteActionsConsumer()
    remoteAction$.subscribe(action => store.dispatch(action))
  })

  const Antares = {
    announce: (actionCreatorOrType, payload) => {
      let action
      if (actionCreatorOrType.call) {
        action = actionCreatorOrType.call(null, payload)
      } else {
        action = {type: actionCreatorOrType, payload}
      }
      let enhancedAction = enhanceActionMeta(action)

      // record in our store (throwing if invalid)
      store.dispatch(enhancedAction)

      // send upstream, returning a promise for server acknowledgement
      return dispatchProxy(enhancedAction)
    },
    store,
    dispatchProxy,
    Config: { Agents }
  }

  console.info('Antares initialized.')
  return Antares
}
