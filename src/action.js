import { fromJS, Map as iMap } from 'immutable'
import { MetaEnhancers } from './config'

export const enhanceActionMeta = (action) => {
    let iAction = fromJS(action).updateIn(['meta', 'antares'], p => {
      return p || new iMap()
    })

    // apply meta enhancers, making sure they dont mess with anything
    let enhancedIAction = MetaEnhancers.reduce((iAction, enhancer) => {
      let newMeta = enhancer(iAction)
      return iAction.mergeIn(['meta', 'antares'], newMeta)
    }, iAction)

    return enhancedIAction.toJS()
}

export const createConsequence = (parent, consequence) => {
  let { type, payload, meta } = consequence
  let antaresMeta = (meta || {}).antares

  return {
    type,
    payload,
    meta: {
      ...meta,
      antares: {
        ...antaresMeta,
        parentActionId: parent.meta.antares.actionId
      }
    }
  }
}



