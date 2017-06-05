import { logger, ppAction } from './logger'
import { ReductionError } from './errors'

// Defines the upstream (aka server) implementation of dispatch which:
//   dispatches to local store
//   acks the client
//   and that is all.
// The publication of the dispatched, and consequent actions is done by a final middleware
// that runs after the epic middleware to ensure that every listener potentially can hear
export const dispatchEndpoint = store => action => {

  logger.log(action, {prefix: `AD (${action.meta.antares.actionId})`, xform: ppAction})

  // Now attempt to dispatch the action to the local store.
  // Any renderers that have been attached synchronously will run in the order subscribed.
  // Any exception in a synchronous renderer will blow the stack here and cause the store's
  // contents to remain unchanged. We'll need to resubscribe in that case.
  try {
    store.dispatch(action)
  } catch (ex) {
    logger.log(
      `AD Reduction Error (${action.meta.antares.actionId})> `,
      ex.message,
      ex.stack
    )
    throw new ReductionError(ex)
  }

  // TODO return results of all sync renderers
  // return action.meta.result
}
