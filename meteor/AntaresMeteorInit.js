import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import Rx from 'rxjs'
import { Map as iMap } from 'immutable'

// allow consumers of the meteor package to skip having the npm dep as well
export * from '../src/antares'
import { mongoRendererFor } from './mongoRendererFor'
import { DDPToStoreRendererFor } from './DDPToStoreRendererFor'
import { remoteActions, getFilterFor } from './remoteActions'

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

  const serverDispatcher = function (intent) {
      let client = this
      let action = intent

      // record the connection this came in on (a default MetaEnhancer)
      if (!action.meta) action.meta = { antares: {} }
      action.meta.antares.connectionId = client && client.connection && client.connection.id

      let key = action.meta.antares.key
      let metaLog = {
        ...action.meta,
        antares: {
          ...action.meta.antares,
          key: key && (key.join ? '[' + key.join(', ') + ']' : key)
        }
      }
      // Dispatching to the store may throw exception so log beforehand
      console.log(`AD (${action.meta.antares.actionId})> ${action.type}
payload: ${JSON.stringify(action.payload, null, 2)}
meta: ${JSON.stringify(metaLog, null, 2)}`)

      // Now attempt to dispatch the action to the local store.
      // Any renderers that have been attached synchronously will run in the order subscribed.
      // Any exception in a synchronous renderer will blow the stack here and cause the store's
      // contents to remain unchanged
      try {
        store.dispatch(action)
      } catch (ex) {
        console.log(`AD Reduction Error (${action.meta.antares.actionId})> `, ex.message, ex.stack )
        throw ex
      }

      // Add this intent to the remoteActions stream for subscribers
      console.log(`AP (${action.meta.antares.actionId})> Sending ${action.type} upstream`)
      remoteActions.next(action)

      // In case a sync renderer has put a result in, return it
      return action.meta.result
    }

    // Make this available at a DDP Endpoint
    Meteor.methods({
      'antares.acknowledge': function (intent) {

        // if it throws, sanitized error is returned over DDP
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
    Meteor.call('antares.acknowledge', action, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

// Analgous to ReactiveVar, but all (future) values available via .asObservable()
// For past values as well - ReplaySubject
const DDPMessage = new Rx.Subject
const Subscriber = new Rx.Subject

// Exposes client-side DDP events as Antares actions
// Must be subscribed to!
const defineRemoteActionsConsumer = () => {

  Meteor.connection._stream.on('message', messageJSON => {
    try {
      DDPMessage.next(JSON.parse(messageJSON))
    } catch (ex) { /* ignore non-parsing DDP messages that aren't ours */ }
  })

  const action$ = DDPMessage.asObservable()
    .filter(msg => msg.collection === 'Antares.remoteActions')
    .map(msg => msg.fields)


  return action$
}

// Close over a store, returning a Meteor.publish function over that store
const createPublisher = (store) =>
  function (pubFilter) {
    try {
      let client = this
      let sub

      console.log('  --------------  ')
      console.log(`AP> got subscriber ${client.connection.id}`)
      Subscriber.next(client.connection)

      client.onStop(() => {
        console.log(`AP> ddp subscriber ${client.connection.id} signed off`)
        if (sub) sub.unsubscribe()
      })

      // To send over DDP, you call the added method, and pass a brand-new ID
      // to ensure mergebox will not drop it
      const sendToClient = action => {
        client.added('Antares.remoteActions', newId(), action)
      }

      const initAction = {
        type: 'Antares.init',
        payload: {} // sets, but will not overwrite, the contents of store.antares
      }

      sendToClient(initAction)

      if (pubFilter && pubFilter.key) {
        let record = store.getState().antares.getIn([].concat(pubFilter.key))
        if (record) {
          sendToClient({
            type: 'Antares.store',
            payload: record.toJS(),
            meta: {
              antares: {
                key: pubFilter.key
              }
            }
          })
        }
      }

      sub = remoteActions
        // the originating connection already has the action - dont publish back to it
        .filter(action => action.meta.antares.connectionId != client.connection.id)
        // this is a consequential action marked localOnly
        .filter(action => !(action.meta.antares.localOnly))
        .filter(getFilterFor(pubFilter))
        .subscribe(action => {
          sendToClient(action)
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

// Allow remote actions to flow to us, if they meet the filter given.
const subscribeToRemoteActions = (pubFilter) => {
  Meteor.subscribe('Antares.remoteActions', pubFilter)
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
      defineRemoteActionsConsumer,
      subscribeToRemoteActions
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

    // make sure our firstSubscriberPromise fires
    let firstSub = new Promise(resolve => {
      let handle = Subscriber.asObservable().subscribe(() => {
        handle.unsubscribe()
        resolve()
      })
    })

    // add hooks for Meteor goodies
    Object.assign(Antares, {
      remember: remembererFor(Antares.store),
      mongoRendererFor,
      DDPToStoreRendererFor,
      DDPMessage$: DDPMessage.asObservable(),
      subscribe: subscribeToRemoteActions,
      firstSubscriber: firstSub,
      startup: Promise.resolve()
    })
    return Antares
  }
}
