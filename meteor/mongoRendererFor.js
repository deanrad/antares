import { Meteor } from 'meteor/meteor'
import { logger, ppAction } from '../src/logger'

export const mongoRendererFor = Collections =>
  Meteor.bindEnvironment(({ action, mongoDiff }) => {
    if (!mongoDiff) return
    if (action.meta && action.meta.antares && action.meta.antares.localOnly)
      return
    let key = action.meta && action.meta.antares && action.meta.antares.key

    logger.log(`MDB (${action.meta.antares.actionId})`, {
      type: action.type,
      key: key.join ? '[' + key.join(', ') + ']' : key,
      ...mongoDiff
    })

    let { id, collection, update, upsert, updateOp } = mongoDiff

    let collName =
      collection.substring(0, 1).toUpperCase() + collection.substring(1)
    let MongoColl = Collections[collName]
    if (!MongoColl) throw new Error(`Collection ${collName} not found`)

    if (update) {
      MongoColl.update({ _id: id }, updateOp, {
        upsert
      })
    }
  })
