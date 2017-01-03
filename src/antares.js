import { fromJS, Map as iMap } from 'immutable'
import { Agents, ReducerForKey, MetaEnhancers, Epics, DispatchProxy } from './config'
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
  ReducerForKey.push(AntaresConfig.ReducerForKey)
  MetaEnhancers.push(...AntaresConfig.MetaEnhancers)

  const store = initializeStore()

  const dispatchProxy = AntaresConfig.defineDispatchProxy()
  inAgencyRun('client', () => {
    DispatchProxy.push(dispatchProxy)
  })

  inAgencyRun('server', () => {
    AntaresConfig.defineDispatchEndpoint(store)
    AntaresConfig.defineRemoteActionsProducer()
  })

  // Ensure we're listening for remoteActions and applying them to our store
  inAgencyRun('client', () => {
    const remoteAction$ = AntaresConfig.defineRemoteActionsConsumer()
    remoteAction$.subscribe(action => store.dispatch(action))
  })

  const Antares = {
    announce: (actionCreator, payload) => {
      let action = actionCreator.call(null, payload)
      let enhancedAction = enhanceActionMeta(action)

      // record in our store (throwing if invalid)
      store.dispatch(enhancedAction)

      // send upstream
      dispatchProxy(enhancedAction)

      return enhancedAction
    },
    store,
    dispatchProxy,
    Config: { Agents }
  }

  console.info('Antares initialized.')
  return {Antares}
}
