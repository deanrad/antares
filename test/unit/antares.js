import { AntaresInit, getConfig, getUserConfig } from '../../src/antares'
import { assert } from 'chai'
import defaultConfig from './factories'

describe('antares', () => {
  let result = AntaresInit(defaultConfig)

  describe('default export', () => {
    it('should be the initializer function', () => {
      assert.isFunction(AntaresInit)
    })

    describe('return value', () => {
      it('should have a Antares.originate function', () => {
        expect(result).to.have.deep.property('Antares.originate')
        assert.isFunction(result.Antares.originate)
      })
      it('should have a Antares.dispatch function', () => {
        expect(result).to.have.deep.property('Antares.dispatch')
        assert.isFunction(result.Antares.dispatch)
      })
    })
  })
})
