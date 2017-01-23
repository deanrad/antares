import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import Rx from 'rxjs'
import { Map as iMap } from 'immutable'

// allow consumers of the meteor package to skip having the npm dep as well
export * from '../src/antares'
import { mongoRendererFor } from './mongoRendererFor'
import { DDPToStoreRendererFor } from './DDPToStoreRendererFor'

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

  const serverDispatcher = function (intent) {
      let client = this
      let action = intent

      // record the connection this came in on (a default MetaEnhancer)
      if (!action.meta) action.meta = { antares: {} }
      action.meta.antares.connectionId = client && client.connection && client.connection.id
      
      // simulate delay in Development to test optimistic UI
      if (Meteor.isDevelopment) {
        Promise.await(new Promise(resolve => setTimeout(resolve, 250)))
      }

      let key = action.meta.antares.key
      // Dispatching to the store may throw exception so log beforehand
      console.log(`AD (${action.meta.antares.actionId})> ${action.type} `,
        {
          payload: action.payload,
          meta: {
            ...action.meta,
            antares: {
              ...action.meta.antares,
              key: key && (key.join ? '[' + key.join(', ') + ']' : key)
            }
          }
        })

      // Now attempt to dispatch the action to the local store.
      // Any renderers that have been attached synchronously will run in the order subscribed.
      // Any exception in a synchronous renderer will blow the stack here and cause the store's
      // contents to remain unchanged
      store.dispatch(action)

      // Add this intent to the remoteActions stream for subscribers
      console.log(`AP (${action.meta.antares.actionId})> Sending ${action.type} upstream`)
      remoteActions.next(action)

      // In case a sync renderer has put a result in, return it
      // TODO document or eliminate this edge-case
      return action.meta.result
    }
    
    // Make this available at a DDP Endpoint
    Meteor.methods({
      'antares.dispatch': function (intent) {
        return serverDispatcher.call(this, intent)
      }
    })

    return serverDispatcher
}

// The function returned here will be the one which Antares.announce invokes
// on the client in order to send the message on the wire to the server.
// NOTE: It is assumed at this point that reduction into the local store has been done already.
export const defineDispatchProxy = () => (action) => {
  // Return a Promise-wrapped DDP Meteor call
  return new Promise((resolve, reject) => {
    Meteor.call('antares.dispatch', action, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

// Analgous to ReactiveVar, but all (future) values available via .asObservable()
// For past values as well - ReplaySubject
const DDPMessage = new Rx.Subject

// Exposes client-side DDP events as Antares actions
const defineRemoteActionsConsumer = () => {

  Meteor.connection._stream.on('message', messageJSON => {
    try {
      DDPMessage.next(JSON.parse(messageJSON))
    } catch (ex) {
      console.log('Antares:DDP:nonparsable')
    }
  })

  // TODO 7 - Allow limiting of this subscription ?
  Meteor.subscribe('Antares.remoteActions')

  const action$ = DDPMessage.asObservable()
    .filter(msg => msg.collection === 'Antares.remoteActions')
    .map(msg => msg.fields)
    

  return action$
}

// Close over a store, returning a Meteor.publish function over that store
const createPublisher = (store) =>
  function(/* TODO 7 Allow limiting of publication */) {
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
        // /* TODO 7 Allow filtering per-client of remoteActions */
        .subscribe(action => {
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
const deepMergeReducer = (state, action) => state.mergeDeep(action.payload)
const appendReducer = (state, action) => state.push(action.payload)
const noopiMapReducer = (state = new iMap(), action ) => state

const remembererFor = store => cursor => {
  let collName = cursor._cursorDescription.collectionName

  cursor.observeChanges({
    added(id, fields) {
      let iState = store.getState().antares
      let keyPath = [collName, id]
      if (! iState.hasIn(keyPath)) {
        console.log('AM> Remembering ', collName, id)
        store.dispatch({ type: 'Antares.store', payload: fields, 
          meta: { antares: {
            key: keyPath,
            localOnly: true
          }} })
      }
    }
  })

  return cursor
}

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
      AntaresConfig.ReducerForKey = (key) => deepMergeReducer
    }
    
    if (!AntaresConfig.MetaEnhancers) {
      AntaresConfig.MetaEnhancers = []
    }

    if (!AntaresConfig.ViewReducer) {
      AntaresConfig.ViewReducer = noopiMapReducer
    }

    // define all our goodies
    console.log('Initializing deanius:antares meteor interface.')
    let Antares = antaresInit({ ...AntaresConfig, ...meteorArgs })

    // add hooks for Meteor goodies
    Object.assign(Antares, {
      remember: remembererFor(Antares.store),
      mongoRendererFor,
      DDPToStoreRendererFor,
      DDPMessage$: DDPMessage.asObservable()
    })
    return Antares
  }
}
