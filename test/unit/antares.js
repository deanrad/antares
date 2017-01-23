import { AntaresInit, getConfig, getUserConfig } from '../../src/antares'
import { assert } from 'chai'
import { minimalConfig } from './factories'
import { shim } from 'object.values' // shim
shim()

describe('Antares.Init', () => {
  it('should be a function', () => {
    assert.isFunction(AntaresInit)
  })

  describe('whose return value', () => {
    it('should have an "announce" function', () => {
      let result = AntaresInit(minimalConfig)
      expect(result).to.have.property('announce')
      assert.isFunction(result.announce)
    })
  })
})
