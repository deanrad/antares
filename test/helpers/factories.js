import { shim } from 'object.values' // shim
shim()

import chai from 'chai'
import chaiSubset from 'chai-subset'
import chaiAsPromised from 'chai-as-promised'
chai.use(chaiSubset)
chai.use(chaiAsPromised)

export const minimalConfig = {
    client: () => true,
    defineDispatchEndpoint: () => null,
    defineRemoteActionsProducer: () => null,
    notifyParentAgent: action => Promise.resolve(action)
}
