import './_polyfills'
import Rx from 'rxjs'
export { default as Rx } from 'rxjs'
export const { Observable } = Rx
export { default as Immutable, fromJS, Map as iMap, List as iList } from 'immutable'
export { createReducer } from 'redux-act'
import { Agents, ReducerForKey, ViewReducer, MetaEnhancers, Epics, DispatchProxy, NewId, Types } from './config'
import { enhanceActionMeta } from './action'
import { initializeStore } from './store'
import { inAgencyRun, isInAgency } from './agency'
import { createClass as createAsteroid } from 'asteroid'
export * from './agency'
export * from './action'
export * from './errors'

// TODO redundant to import in Meteor which has its own ddp lib already
const Asteroid = createAsteroid()
let asteroid

// Allow the caller to initialize us, extending their config onto ours
export const AntaresInit = (AntaresConfig) => {

    const noopReducer = (state = {}) => state

    // Store provided config fields
    Object.assign(Agents, AntaresConfig.Agents)
    Object.assign(Epics, AntaresConfig.Epics)
    Object.assign(Types, AntaresConfig.Types)
    ViewReducer.push(AntaresConfig.ViewReducer || noopReducer)
    NewId.push(AntaresConfig.newId)
    ReducerForKey.push(AntaresConfig.ReducerForKey || noopReducer)
    MetaEnhancers.push(...(AntaresConfig.MetaEnhancers || []))

    // Construct the store for this Agent!
    const store = initializeStore()
    // dispatcher is a location-unaware function to dispatch and return a Promise
    // Should accept an intent, and return a Promise for an ACK
    let dispatcher
    let remoteAction$

    if (isInAgency('client') &&
        !(AntaresConfig.defineDispatchProxy || AntaresConfig.connectionUrl)) {
        dispatcher = () => console.error('Antares: running without full config')
    } else {

        // on the client define the endpoint for server communication
        let userDispatchProxy
        if (AntaresConfig.defineDispatchProxy) {
            userDispatchProxy = AntaresConfig.defineDispatchProxy()
        } else if (AntaresConfig.connectionUrl) {
            // use Asteroid to make a connection
            asteroid = new Asteroid({
                endpoint: AntaresConfig.connectionUrl
            })
            userDispatchProxy = action => {
                return asteroid.call('antares.acknowledge', action)
            }
        }

        const dispatchProxy = action => {
            // Withhold localOnly actions from the wire
            if (action.meta && action.meta.antares && action.meta.antares.localOnly) {
                return Promise.resolve()
            }
            return userDispatchProxy(action)
        }

        // The dispatch endpoint on the server does
        // 1) dispatch action to the store
        // 2) notify other users
        inAgencyRun('server', () => {
            const dispatchEndpoint = AntaresConfig.defineDispatchEndpoint(store)
            dispatcher = intent => {
                return new Promise(resolve => dispatchEndpoint.call(null, intent))
            }
        })

        // The client side version must call the server, but only after first
        // synchronously reducing it into its own store, validating it.
        inAgencyRun('client', () => {
            DispatchProxy.push(dispatchProxy)

            // when Antares.announce is called on the client
            dispatcher = intent => {
                store.dispatch(intent)
                return dispatchProxy(intent)
            }
        })

        // Provide the publication endpoint
        inAgencyRun('server', () => {
            AntaresConfig.defineRemoteActionsProducer(store)
        })

        // Ensure we're listening for remoteActions and applying them to our store
        // Will create a "Hot" Observable of events, if defined
        // See https://github.com/Reactive-Extensions/RxJS/blob/master/doc/gettingstarted/creating.md
        inAgencyRun('client', () => {
            if (!AntaresConfig.defineRemoteActionsConsumer) {
                AntaresConfig.defineRemoteActionsConsumer = () => {
                    let actionSubject = new Rx.Subject()
                    // If Meteor didn't do it for us, lets define our own
                    asteroid.ddp.on('added', ({ collection, id, fields }) => {
                        if (collection === 'Antares.remoteActions') {
                            actionSubject.next(fields)
                            store.dispatch(fields)
                        }
                    })
                    return actionSubject.asObservable()
                }
            }

            remoteAction$ = AntaresConfig.defineRemoteActionsConsumer()

            // TODO - any store reduction error here will disconnect. Needs same fix as 1194.
            // Note - event emitter style ddp.on('added', cb) may be more appropriate than a
            // subscription that needs reattaching.
            remoteAction$.subscribe(action => store.dispatch(action))
        })
    }

    const subscribeRenderer = (renderer, opts, alternateStream) => {
        // default to sync mode
        const { mode, xform } = opts || { mode: 'sync' }

        // a stream transformer for diffs (in lieu of providing an alternateStream)
        const modifier = xform ? xform : (same => same)
        const _stream = alternateStream ? alternateStream : modifier(store.diff$)

        // The final stream we subscribe to with scheduling
        const observe = (mode === 'async') ? s => s.observeOn(Rx.Scheduler.asap) : s => s
        const stream = observe(_stream)
        const defer = (typeof setImmediate === 'function') ? setImmediate : fn => setTimeout(fn, 0)

        // NOTE: A stream will resubscribe in case of error, but the handle will be of no use to call unsubscribe on it
        // because we're subscribed on a new handle now. The fix would be to return a handle-getting function. Messy?
        const observer = {
            next: (action) => {
                try {
                    return renderer(action)
                } catch (ex) {
                    // reestablish our subscription in the next turn of the event loop
                    defer(() => stream.subscribe(observer))
                    // but let our caller see
                    throw ex
                }
            },
            error: (e) => console.warn('SR> saw error', e),
            complete: (e) => console.warn('SR> done')
        }
        return stream.subscribe(observer)
    }

    const Antares = {
        originate: (actionCreatorOrType, payload, payloadEnhancer = (a => null), metaEnhancer = null) => {
            let action
            let stowaway = payloadEnhancer()

            // Can't enhance non-Object payload like Numbers
            let enhancedPayload = payload instanceof Object ? { ...stowaway, ...payload } : payload

            // Use either of our syntaxes: ActionCreator, string, or action
            if (actionCreatorOrType.call) {
                action = actionCreatorOrType.call(null, enhancedPayload)
            } else if (actionCreatorOrType.substr) {
                action = { type: actionCreatorOrType, payload: enhancedPayload }
            } else {
                action = actionCreatorOrType
            }

            // Look up the validator and synchronously validate the payload, or throw
            const validator = Types[action.type] || (() => true)
            validator(action.payload)

            let enhancedAction = enhanceActionMeta(action, metaEnhancer)
            return enhancedAction
        },
        announce: (actionCreatorOrType, payload, payloadEnhancer = (a => null), metaEnhancer = null) => {
            // Synchronously validate the payload, or throw
            let enhancedAction = Antares.originate(actionCreatorOrType, payload, payloadEnhancer, metaEnhancer)

            let returnPromise = dispatcher.call(null, enhancedAction)

            return Object.assign(returnPromise, {
                action: enhancedAction,
                startOfEpic: () => {
                    return Antares.store.diff$.first(({ action }) =>
                        action.type === `${enhancedAction.type}.begin`
                    )
                        .map(({ action }) => action)
                        .toPromise()
                },
                endOfEpic: () => {
                    return Antares.store.diff$.first(({ action }) =>
                        action.type === `${enhancedAction.type}.end` ||
                        action.type === `${enhancedAction.type}.error`
                        // TODO 1195:  action.meta.antares.concludesEpic === enhancedAction.meta.antares.actionId
                    )
                        .map(({ action }) => {
                            if (action.type.endsWith('.error')) {
                                throw action
                            }
                            return action
                        })
                        .toPromise()
                }
            })
        },
        subscribe: (filter) => {
            asteroid.subscribe('Antares.remoteActions', filter)
        },
        subscribeRenderer,
        store,
        remoteAction$,
        asteroid,
        getState: () => store.getState().antares,
        getViewState: () => store.getState().view,
        Config: AntaresConfig
    }

    console.info('Antares initialized.')
    return Antares
}
