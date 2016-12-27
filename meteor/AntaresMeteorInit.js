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
export const defineDispatchImpl = () => {
  Meteor.methods({
    'antares.dispatch': () => {}
  })
}

// Defines the proxy (aka stub) which
export const defineDispatchProxy = () => {

}

const mergeReducer = (state, action) => state.merge(action.payload)
const appendReducer = (state, action) => state.push(action.payload)

// The default antares init function
// Returns: an modified version of the initializer passed, extending its props with ours
export const AntaresMeteorInit = (antaresInit) => {
    return (AntaresConfig) => {
        const meteorArgs = {
            antaresWrapper: 'meteor',
            newId
        }

        // Define default agency names 'any', 'server' and 'client' for familiarity within Meteor
        if (!AntaresConfig.Agents) AntaresConfig.Agents = {}
        Object.assign(AntaresConfig.Agents, {
          server: () => Meteor.isServer,
          client: () => Meteor.isClient,
          any: () => true
        })

        if (!AntaresConfig.ReducerForKey) AntaresConfig.ReducerForKey = (key) => appendReducer

        console.log('Initializing deanius:antares dispatch.')
        if (Meteor.isClient) defineDispatchProxy()
        if (Meteor.isServer) defineDispatchImpl()

        console.log('Initializing deanius:antares meteor interface.')
        let antares = antaresInit({ ...AntaresConfig, ...meteorArgs })
        return antares
    }
}
