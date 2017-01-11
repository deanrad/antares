import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import Rx from 'rxjs'

// allow consumers of the meteor package to skip having the npm dep as well
export * from '../src/antares'

export const newId = () => {
  return Random.id()
}

const remoteActions = new Rx.Subject

// Defines the upstream (aka server) implementation of dispatch which:
//   dispatches to local store
//   acks the client
//   and that is all.
// The publication of the dispatched, and consequent actions is done by a final middleware
// that runs after the epic middleware to ensure that every listener potentially can hear
export const defineDispatchEndpoint = (store) => {
  Meteor.methods({
    'antares.dispatch': function (action) {
      let client = this
      action.meta.antares.connectionId = client.connection.id
      store.dispatch(action)
      // publishes dispatched actions, not epic-created ones (yet)
      remoteActions.next(action)
    }
  })
}

// Defines the proxy (aka stub) which dispatches locally
export const defineDispatchProxy = () => (action) => {
  // we dont dispatch localOnly actions over the wire
  if (action.meta && action.meta.antares && action.meta.antares.localOnly) {
    return
  }

  return new Promise((resolve, reject) => {
    Meteor.call('antares.dispatch', action, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

// Exposes client-side DDP events as Antares actions
const defineRemoteActionsConsumer = () => {
  const action = new Rx.Subject

  Meteor.connection._stream.on('message', messageJSON => {
    action.next(messageJSON)
  })

  Meteor.subscribe('Antares.remoteActions')
  const action$ = action
    .map(JSON.parse)
    .filter(msg => msg.collection === 'Antares.remoteActions')
    .map(msg => msg.fields)
    .asObservable()

  return action$
}

const createPublisher = (store) => function(/* TODO subscription params */) {
  try {
  let client = this

  console.log('  --------------  ')
  console.log(`AP> got subscriber ${client.connection.id}`)
  client.onStop(() => console.log(`PUB> ddp subscriber ${client.connection.id} signed off`))

  const initAction = {
    type: 'Antares.init',
    payload: store.getState().antares.toJS()
  }

  client.added('Antares.remoteActions', newId(), initAction)

  remoteActions
    // the originating connection already has the action - dont publish back to it
    .filter(action => action.meta.antares.connectionId != client.connection.id)
    // this is a consequential action marked localOnly
    .filter(action => !(action.meta.antares.localOnly))
    .subscribe(action => {
      console.log('AP> ' + action.type)
      client.added('Antares.remoteActions', newId(), action)
    })

  client.ready()
  } catch (ex) {
    console.error('AP> ERROR: ', ex)
  }
}

// The remoteActionsProducer
const defineRemoteActionsProducer = (store) => {
  const publisher = createPublisher(store)
  Meteor.publish('Antares.remoteActions', publisher)
}

const noopReducer = (state = {}, action) => state
const mergeReducer = (state, action) => state.merge(action.payload)
const appendReducer = (state, action) => state.push(action.payload)

// The default antares init function
// Returns: an modified version of the initializer passed, extending its props with ours
export const AntaresMeteorInit = (antaresInit) => {
  return (AntaresConfig) => {
    const meteorArgs = {
      antaresWrapper: 'meteor',
      newId,
      defineDispatchProxy,
      defineDispatchEndpoint,
      defineRemoteActionsProducer,
      defineRemoteActionsConsumer
    }

    // Define default agency names 'any', 'server' and 'client' for familiarity within Meteor
    if (!AntaresConfig.Agents) AntaresConfig.Agents = {}
    Object.assign(AntaresConfig.Agents, {
      server: () => Meteor.isServer,
      client: () => Meteor.isClient,
      any: () => true
    })

    if (!AntaresConfig.ReducerForKey) {
      AntaresConfig.ReducerForKey = (key) => noopReducer
    }
    
    if (!AntaresConfig.MetaEnhancers) {
      AntaresConfig.MetaEnhancers = []
    }

    if (!AntaresConfig.ViewReducer) {
      AntaresConfig.ViewReducer = noopReducer
    }

    console.log('Initializing deanius:antares meteor interface.')
    let antares = antaresInit({ ...AntaresConfig, ...meteorArgs })
    return antares
  }
}
