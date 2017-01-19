import { Meteor } from 'meteor/meteor'

export const mongoRendererFor = (Collections) =>
    Meteor.bindEnvironment(({ mongoDiff }) => {
        console.log('AMONG>', mongoDiff)
        if (!mongoDiff) return
        let { id, collection, update, upsert, updateOp } = mongoDiff

        let MongoColl = Collections[collection]
        if (!MongoColl) throw new Error(`Collection ${collection} not found`)

        if (update) {
            MongoColl.update(
                { _id: id },
                updateOp,
                {
                    upsert
                }
            )
        }
    })