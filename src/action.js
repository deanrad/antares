import { fromJS, Map as iMap } from "immutable"
import Rx from "rxjs"

import { MetaEnhancers } from "./config"

let { Observable } = Rx

export const enhanceActionMeta = (action, oneTimeMetaEnhancer, Antares) => {
  let iAction = fromJS(action || {}).updateIn(["meta", "antares"], p => {
    return p || new iMap()
  })

  let enhancers
  if (typeof oneTimeMetaEnhancer === "function") {
    enhancers = MetaEnhancers.concat(oneTimeMetaEnhancer)
  } else {
    enhancers = MetaEnhancers
  }

  // apply meta enhancers, making sure they dont mess with anything
  let enhancedIAction = enhancers.reduce((iAction, enhancer) => {
    if (typeof enhancer !== "function") {
      debugger
    }
    let newMeta = enhancer(iAction, Antares)
    return iAction.mergeIn(["meta", "antares"], newMeta)
  }, iAction)

  return enhancedIAction.toJS()
}

export const createConsequence = (parent, consequence) => {
  let { type, payload, meta } = consequence
  let antaresMeta = (meta || {}).antares
  let parentMeta = (parent.meta && parent.meta.antares) || {}

  return {
    type,
    payload,
    meta: {
      ...meta,
      antares: {
        ...parentMeta,
        ...antaresMeta,
        actionId: Math.floor(Math.random() * 1000000).toString(12),
        parentActionId: parent.meta.antares.actionId
      }
    }
  }
}

export const localConsequence = (parent, consequence) => {
  let { type, payload, meta } = consequence
  return createConsequence(parent, {
    type,
    payload,
    meta: {
      ...meta,
      antares: {
        ...(meta || {}).antares,
        localOnly: true
      }
    }
  })
}

const begins = action =>
  createConsequence(action, {
    type: `${action.type}.begin`,
    payload: action.payload,
    meta: {
      antares: { localOnly: true }
    }
  })
const ends = (action, result) =>
  createConsequence(action, {
    type: `${action.type}.end`,
    payload: result,
    meta: {
      antares: {
        localOnly: true,
        concludesEpic: action.meta.antares.actionId
      }
    }
  })
const errors = (action, err) =>
  createConsequence(action, {
    type: `${action.type}.error`,
    payload: err,
    meta: {
      antares: { localOnly: true }
    }
  })
const concludes = (action, promise) =>
  Observable.fromPromise(
    promise
      .then(result => ends(action, result))
      .catch(err => errors(action, err))
  )
export const createPromiseEpic = (type, promiseFactory) => action$ =>
  action$
    .ofType(type)
    .mergeMap(action =>
      Observable.of(begins(action)).concat(
        concludes(action, promiseFactory(action))
      )
    )
