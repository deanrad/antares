import { shim } from 'object.values' // shim
shim()

import chai from 'chai'
import chaiSubset from 'chai-subset'
import chaiAsPromised from 'chai-as-promised'
chai.use(chaiSubset)
chai.use(chaiAsPromised)

export const minimalConfig = {
    // silences the message 'No way to notify parent of action'
    notifyParentAgent: action => Promise.resolve(action)
    // initialState can initialize { antares, view }
}
