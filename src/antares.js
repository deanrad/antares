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

  const dispatchProxy = AntaresConfig.defineDispatchProxy()

  inAgencyRun('server', () => {
    AntaresConfig.defineDispatchEndpoint(store)
  })

  const Antares = {
    announce: (actionCreator, payload, metaEnhancer) => {
      let action = actionCreator.call(null, argObject)

      return action
    },
    store,
    Config: { Agents }
  }

  console.info('Antares initialized.')
  return {Antares}
}
