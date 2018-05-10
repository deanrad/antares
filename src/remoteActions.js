import { fromJS } from "immutable"

import { logger } from "./logger"

// Returns a function implementing our remoteActions filter rules:
// Subscription styles:
// '*' - match all remote Actions (this can be VERY chatty on the network!)
//
// Matching fields of action.meta.antares:
// { key: 'foo' } - match actions having key: 'foo'
// { key: ['coll'] } - match actions having key: ['coll', *], or ['coll']
//
export const getFilterFor = pubFilter => action => {
  // must explicitly pass the wildcard to be unlimited
  if (pubFilter === "*") return true

  // actions without antares meta at all do not pass
  let actionMeta = action.meta && action.meta.antares
  if (!actionMeta) return false

  // for any key specified in the filter
  for (let key of Object.keys(pubFilter)) {
    let actionKey = actionMeta[key]
    let filterKey = pubFilter[key]

    // actions without this key don't pass
    if (!actionKey) return false

    // actions that exactly match pass
    if (actionKey === filterKey) continue

    // array keys pass if they match up to the filter specified
    for (let i = 0; i < filterKey.length; i++) {
      if (actionKey[i] != filterKey[i]) return false
    }
  }
  return true
}

// Given all actions on a server, Returns an Observable of actions
// that are considered remote from the given client, and which match
// the provided filter
export const antaresPublisher = ({ server, client, store, pubFilter }) => {
  let { action$, agentId, onCacheMiss } = server

  logger.log(
    `New subscriber: ${client.connectionId.substring(0, 6)} (key:${
      pubFilter.key
    })`,
    {
      prefix: "AP",
      newSection: true
    }
  )

  const initAction = {
    type: "Antares.init",
    payload: {}, // sets, but will not overwrite, the contents of store.antares
    meta: {
      antares: {
        actionId: Math.floor(Math.random() * 1000000).toString(16),
        parentAgentId: agentId
      }
    }
  }
  client.sendAction(initAction)

  // send the current state of the data at that key
  let dataAtKey = store.getState().antares.getIn(pubFilter.key)
  let rawObject

  let populationAction = {
    type: "Antares.store",
    payload: null,
    meta: {
      antares: {
        actionId: Math.floor(Math.random() * 1000000).toString(16),
        key: pubFilter.key,
        localOnly: true
      }
    }
  }

  if (!dataAtKey) {
    rawObject = onCacheMiss(pubFilter.key)
    dataAtKey = fromJS(rawObject)
    populationAction.payload = rawObject
    store.dispatch(populationAction)
  } else {
    populationAction.payload = dataAtKey.toJS()
  }

  client.sendAction(populationAction)

  return (
    action$
      // the originating connection already has the action - dont publish back to it
      .filter(
        action =>
          action.meta.antares.connectionId !== client.connectionId ||
          action.meta.antares.reflectAction
      )
      // this is a consequential action marked localOnly
      .filter(action => !action.meta.antares.localOnly)
      .filter(getFilterFor(pubFilter))
  )
}
