import { fromJS, Map as iMap } from 'immutable'
import { Agents, ReducerForKey, MetaEnhancers, Epics } from './config'
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

  inAgencyRun('server', () => {
    AntaresConfig.defineDispatchEndpoint(store)
  })

  const Antares = {
    announce: (actionCreator, payload) => {
      let action = actionCreator.call(null, payload)
      let enhancedAction = enhanceActionMeta(action)
      store.dispatch(enhancedAction)
      return enhancedAction
    },
    store,
    Config: { Agents }
  }

  console.info('Antares initialized.')
  return {Antares}
}
