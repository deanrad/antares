import { Meteor } from 'meteor/meteor'

export const DDPToStoreRendererFor = (Collections, store, nameMapper = (n => n)) => {
    const renderer = ddpMsg => {
        let { collection, msg, fields, id } = ddpMsg
        let prop = collection && nameMapper(collection)

        // Only those we care about
        if (!Collections[prop]) return
        // if (prop === 'Creations' ) { debugger }

        let action
        if (msg === 'added') {
            action = {
                type: 'Antares.store',
                payload: fields,
                meta: {
                    antares: {
                        key: [collection, id],
                        source: 'DDPToStoreRenderer'
                    }
                }
            }
        }
        if (msg === 'changed') {
            action = {
                type: 'Antares.update',
                payload: fields,
                meta: {
                    antares: {
                        key: [collection, id],
                        source: 'DDPToStoreRenderer'
                    }
                }
            }
        }
        if (msg === 'removed') {
            action = {
                type: 'Antares.forget',
                meta: {
                    antares: {
                        key: [collection, id],
                        source: 'DDPToStoreRenderer'
                    }
                }
            }
        }

        if (action) {
            return store.dispatch(action)
        }
    }
    return Meteor.bindEnvironment(renderer)
}
