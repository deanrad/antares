import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

export const newId = () => {
    return Random.id()
}

// Defines the upstream (aka server) implementation of dispatch which:
//   dispatches to local store
//   acks the client
//   and that is all.
// The publication of the dispatched, and consequent actions is done by a final middleware
// that runs after the epic middleware to ensure that every listener potentially can hear
export const defineDispatchEndpoint = (store) => {
  Meteor.methods({
    'antares.dispatch': (action) => {
      store.dispatch(action)
      //console.log('TODO handle dispatch on server')
    }
  })
}

// Defines the proxy (aka stub) which dispatches locally
export const defineDispatchProxy = (action) => {
  return new Promise((resolve, reject) => {
    Meteor.call('antares.dispatch', action, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

const mergeReducer = (state, action) => state.merge(action.payload)
const appendReducer = (state, action) => state.push(action.payload)

// The default antares init function
// Returns: an modified version of the initializer passed, extending its props with ours
export const AntaresMeteorInit = (antaresInit) => {
    return (AntaresConfig) => {
        const meteorArgs = {
            antaresWrapper: 'meteor',
            newId,
            defineDispatchEndpoint,
            defineDispatchProxy
        }

        // Define default agency names 'any', 'server' and 'client' for familiarity within Meteor
        if (!AntaresConfig.Agents) AntaresConfig.Agents = {}
        Object.assign(AntaresConfig.Agents, {
          server: () => Meteor.isServer,
          client: () => Meteor.isClient,
          any: () => true
        })

        if (!AntaresConfig.ReducerForKey) AntaresConfig.ReducerForKey = (key) => appendReducer

        console.log('Initializing deanius:antares meteor interface.')
        let antares = antaresInit({ ...AntaresConfig, ...meteorArgs })
        return antares
    }
}
