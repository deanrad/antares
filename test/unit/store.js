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

  // the antares part of the store expects to have 1 or more objects stored under an objectkey
  const initialState = {
    objectKey: {
      simpleKey: 1,
      compoundKey: {
        toggle: false
      }
    }
  }

  const reducer = (state, action) => {
    return state
  }
  const ReducerForKey = key => reducer

  beforeEach(() => {
    callCount = 0
  })

  it('gets its initialState by invoking the fn returned by ReducerForKey with no args', () => {
    let Antares = AntaresInit({ ReducerForKey, initialState })
    expect(isImmutable(Antares.getState())).to.be.ok

    //expect(antaresState.toJS()).to.eql(initialState)
    Antares.process({ type: 'Antares.init', payload: initialState })
    expect(Antares.getState().toJS()).to.eql(initialState)
  });
});
