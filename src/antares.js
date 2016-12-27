import { Agents, ReducerForKey } from './config'
import { initializeStore } from './store'
import { inAgencyRun } from './agency'
export * from './agency'

// Allow the caller to initialize us, extending their config onto ours
export const AntaresInit = (AntaresConfig) => {
  // Store provided config fields
  Object.assign(Agents, AntaresConfig.Agents)
  ReducerForKey.push(AntaresConfig.ReducerForKey)

  const store = initializeStore()

  const dispatchProxy = AntaresConfig.defineDispatchProxy(store)

  inAgencyRun('server', () => {
    AntaresConfig.defineDispatchEndpoint(store)
  })

  const Antares = {
    originate: (actionCreator, params) => {
      console.warn('TODO actually originate news.')
      return { type: 'Antares.test' }
    },
    dispatch: (actionCreator, params) => {
      let action = Antares.originate(actionCreator, params)

      // for all agents, reduce action into store
      store.dispatch(action)

      // for client agents (those with an upstream), invoke the proxy as well
      dispatchProxy(action)
    },
    publish: () => {

    },
    store,
    Config: { Agents }
  }

  console.info('Antares initialized.')
  return {Antares}
}
