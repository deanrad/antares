import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import Rx from 'rxjs'
import { logger } from '../src/logger'

import {
  default as Immutable,
  fromJS,
  Map as iMap,
  List as iList
} from 'immutable'

import { mongoRendererFor } from './mongoRendererFor'
import { DDPToStoreRendererFor } from './DDPToStoreRendererFor'
import { getFilterFor, antaresPublisher } from '../src/remoteActions'

export const newId = () => {
  return Random.id()
}

export const defineDispatchEndpoint = antaresDispatcher => {
  // Make this available at a DDP Endpoint
  Meteor.methods({
    'antares.acknowledge': function acknowledge(action) {
      // the client currently calling us is the context we run in at runtime
      let client = this

      if (!action || !action.type) {
        throw new Meteor.Error(
          'Antares accepts only actions in the FSA format, and type(String) is required'
        )
      }

      // LEFTOFF Lets check/load the cache here
      // let collName =
      //   collection.substring(0, 1).toUpperCase() + collection.substring(1)
      // let MongoColl = Collections[collName]
      // if (!MongoColl) throw new Error(`Collection ${collName} not found`)

      // record some facts about our receipt
      if (!action.meta) action.meta = { antares: {} }
      if (!action.meta.antares) action.meta.antares = {}
      ;(action.meta.antares.connectionId =
        client &&
        client.connection &&
        client.connection
          .id), (action.meta.antares.receivedAt = new Date().getTime())

      return antaresDispatcher(action)
    }
  })
}

// The function returned here will be the one which Antares.announce invokes
// on the client in order to send the message on the wire to the server.
// NOTE: It is assumed at this point that reduction into the local store has been done already.
export const notifyParentAgent = action => {
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
const DDPMessage = new Rx.Subject()

// Exposes client-side DDP events as Antares actions
// Must be subscribed to!
const defineRemoteActionsConsumer = () => {
  Meteor.connection._stream.on('message', messageJSON => {
    try {
      DDPMessage.next(JSON.parse(messageJSON))
    } catch (ex) {
      /* ignore non-parsing DDP messages that aren't ours */
    }
  })

  const action$ = DDPMessage.asObservable()
    .filter(msg => msg.collection === 'Antares.remoteActions')
    // of the fields in the DDP payload, the 'fields' one contains the action
    .map(msg => msg.fields)

  return action$
}

// The remoteActionsProducer
const defineRemoteActionsProducer = ({ store, agentId, onCacheMiss }) => {
  Meteor.publish('Antares.remoteActions', function publisher(pubFilter) {
    // an abstraction of the client
    let client = {
      connectionId: this.connection.id,
      agentId: null,
      sendAction: action => {
        let key = action.meta.antares && action.meta.antares.key
        logger.log(
          `${action.type} ${key ? `(key:${key})` : ''}`,
          {
            prefix: `AP (${this.connection.id.substring(0, 6)})`
          }
        )
        let sanitizedAction = fromJS(action)
          .deleteIn(['meta', 'antares', 'connectionId'])
          .deleteIn(['meta', 'antares', 'receivedAt'])
          .setIn(['meta', 'antares', 'originAgentId'], agentId)
          .toJS()
        this._session.sendAdded(
          'Antares.remoteActions',
          newId(),
          sanitizedAction
        )
      }
    }

    // an abstraction of the server
    let server = {
      agentId,
      action$: store.diff$.map(({ action }) => action),
      onCacheMiss
    }

    let clientAction$ = antaresPublisher({ server, client, pubFilter, store })
    let clientSub = clientAction$.subscribe(action => {
      client.sendAction(action)
    })

    this.onStop(() => {
      logger.log(
        `AP (${client.connectionId.substring(0, 6)})> unsub: key:${pubFilter.key}`
      )
      clientSub.unsubscribe()
    })

    let action$ = store.action$
  })
}

// Allow remote actions to flow to us, if they meet the filter given.
const subscribeToRemoteActions = pubFilter => {
  Meteor.subscribe('Antares.remoteActions', pubFilter)
}

const noopReducer = (state = {}, action) => state
const mergeReducer = (state, action) => state.merge(action.payload)
const deepMergeReducer = (state, action) => state.mergeDeep(action.payload)
const appendReducer = (state, action) => state.push(action.payload)
const noopiMapReducer = (state = new iMap(), action) => state

const remembererFor = store => cursor => {
  let collName = cursor._cursorDescription.collectionName

  cursor.observeChanges({
    added(id, fields) {
      let iState = store.getState().antares
      let keyPath = [collName, id]
      if (!iState.hasIn(keyPath)) {
        logger.log('AM> Remembering ', collName, id)
        store.dispatch({
          type: 'Antares.store',
          payload: fields,
          meta: {
            antares: {
              key: keyPath,
              localOnly: true
            }
          }
        })
      }
    }
  })

  return cursor
}

// The default antares init function
// Returns: an modified version of the initializer passed, extending its props with ours
export const AntaresMeteorInit = antaresInit => {
  return AntaresConfig => {
    const meteorArgs = {
      antaresWrapper: 'meteor',
      newId,
      notifyParentAgent,
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
      AntaresConfig.ReducerForKey = key => deepMergeReducer
    }

    if (!AntaresConfig.MetaEnhancers) {
      AntaresConfig.MetaEnhancers = []
    }

    if (!AntaresConfig.ViewReducer) {
      AntaresConfig.ViewReducer = noopiMapReducer
    }

    // define all our goodies
    let Antares = antaresInit({ ...AntaresConfig, ...meteorArgs })

    // add hooks for Meteor goodies
    Object.assign(Antares, {
      remember: remembererFor(Antares.store),
      mongoRendererFor,
      DDPToStoreRendererFor,
      ddpMessage$: DDPMessage.asObservable(),
      subscribe: subscribeToRemoteActions,
      startup: Promise.resolve()
    })
    return Antares
  }
}

// Export the identical interface as ../src/antares except AntaresInit
// will be wrapped by AntaresMeteorInit
import { AntaresInit as _init } from '../src/antares'
export const AntaresInit = AntaresMeteorInit(_init)
export * from '../src/agency'
export * from '../src/action'
export * from '../src/errors'
export { default as Rx } from 'rxjs'
export const { Observable } = Rx
export {
  default as Immutable,
  fromJS,
  Map as iMap,
  List as iList
} from 'immutable'
export { createReducer } from 'redux-act'
export { combineReducers } from 'redux-immutable'
