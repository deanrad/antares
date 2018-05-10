import { expect } from "chai"

import { AntaresInit, iMap } from "../../src/antares"

// theres a newer better API for this if we update immutable
const isImmutable = iMap.isMap

describe("Antares Store", () => {
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

  it("is initialized to an empty immutable map", () => {
    let Antares = AntaresInit({ ReducerForKey, initialState })
    let antaresState = Antares.getState()
    expect(isImmutable(antaresState)).to.be.ok
    expect(antaresState.toJS()).to.eql({})
  })
})
