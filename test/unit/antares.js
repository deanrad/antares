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
      it('should have a News.originate function', () => {
        expect(result).to.have.deep.property('News.originate')
        assert.isFunction(result.News.originate)
      })
    })
  })

  describe('.getUserConfig', () => {
    it('should return the config given to the initializer', () => {
      expect(getUserConfig()).to.equal(defaultConfig)
    })
  })

  describe('.getConfig', () => {
    it('should return an object with multiple keys', () => {
      expect(getConfig()).to.contain.all.keys('userProvided', 'antaresDefault')
    })
  })
})
