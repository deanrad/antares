import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

export const newId = () => {
    return Random.id()
}

// The default antares init function
// Returns: an modified version of the initializer passed, passing it
export const AntaresMeteorInit = (antaresInit) => {
    return (params) => {
        const meteorArgs = {
            antaresWrapper: 'meteor',
            newId
        }
        console.log('Initializing deanius:antares meteor interface.')
        let antares = antaresInit({ ...params, ...meteorArgs })
        return antares
    }
}
