import {
  AntaresInit,
  getConfig,
  getUserConfig,
  Observable,
  fromJS,
  iList,
  iMap,
  ReductionError,
  TypeValidationError,
  ParentNotificationError
} from '../../src/antares'

import { minimalConfig } from '../helpers/factories'

// theres a newer better API for this if we update immutable
const isImmutable = iMap.isMap

describe('Antares Store', () => {
  let callCount = 0

  const initialState = {
    simpleKey: 1,
    compoundKey: {
      toggle: false
    }
  }

  const reducer = (state = initialState, action) => {
    return state
  }
  const ReducerForKey = key => reducer

  beforeEach(() => {
    callCount = 0
  })

  it('gets initialized via ReducerForKey', () => {
    let Antares = AntaresInit({ ReducerForKey })
    let antaresState = Antares.getState()
    expect(isImmutable(antaresState)).to.be.ok
  });
});
