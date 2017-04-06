import Rx from 'rxjs'

export const remoteActions = new Rx.Subject

// Returns a function implementing our remoteActions filter rules:
// Subscription styles:
// '*' - match all remote Actions (this can be VERY chatty on the network!)
//
// Matching fields of action.meta.antares:
// { key: 'foo' } - match actions having key: 'foo'
// { key: ['coll'] } - match actions having key: ['coll', *], or ['coll']
//
export const getFilterFor = (pubFilter) => action => {
    // must explicitly pass the wildcard to be unlimited
    if (pubFilter === '*') return true

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
