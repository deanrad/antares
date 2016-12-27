import { Agents, ReducerForKey } from './config'
import { initializeStore } from './store'
export * from './agency'

// Allow the caller to initialize us, extending their config onto ours
export const AntaresInit = (AntaresConfig) => {
  // Store provided config fields
  Object.assign(Agents, AntaresConfig.Agents)
  ReducerForKey.push(AntaresConfig.ReducerForKey)

  const store = initializeStore()

  const Antares = {
    originate: (actionCreator, params) => {
      console.warn('TODO actually originate news.')
      return { type: 'Antares.test' }
    },
    dispatch: (actionCreator, params) => {
      let action = Antares.originate(actionCreator, params)
      console.warn('TODO actually dispatch news.')
    },
    publish: () => {

    },
    store,
    Config: { Agents }
  }

  console.info('Antares initialized.')
  return {Antares}
}
